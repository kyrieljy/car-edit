# Chat Mode Strategy Guide

维护日期: 2026-05-29

Context note: this is a subsystem reference, not a default handoff document. Read it only when touching Chat Mode parser, fallback, follow-up, prompt, reference allocation, color policy, or dry-run tests.

本文档是 Chat Mode 对话策略的当前推荐入口。`docs/CHAT_MODE_RULES.md` 保留为历史规则和补充材料；后续只要修改 Chat Mode 的 parser、LLM fallback、追问、prompt、reference allocation、colorPolicy 或 dry-run 测试，都必须同步维护本文档。

## 1. 先说结论: 不能保证用户怎么问都准确输出

Chat Mode 不是“自然语言直接进生图模型”。当前目标是把用户文本、车辆画布、配件参考图、会话上下文和资产库候选，尽量稳定地收敛成 `GenerationStandardJson`，再复用 Config Mode 的 prompt builder、参考图分配和 provider 生图链路。

因此这版不能承诺“用户怎么问都能准确输出”。它能做到的是:

- 本地确定性规则能命中的，直接生成标准 JSON。
- 本地规则低置信、但缺失项可由自然语言补全的，调用窄口径 LLM fallback 辅助提取。
- LLM fallback 结果必须回流本地 parser 和 validator，不能直接生成最终 JSON。
- 仍不确定或缺少硬条件时追问，不猜。
- 明确越界、文件非法或缺少车辆画布时拒绝或要求补充，不进入生图。

这套策略的工程目标是减少漏判和减少穷举测试压力，而不是取消追问、取消规则维护或让 LLM 成为最终裁判。

## 2. 完整链路

API 入口是 `POST /api/chat/messages`，主流程在 `app/api/chat/messages/route.ts`，标准 JSON 和本地 parser 在 `lib/generation-core.ts`。

一次请求大致经过这些阶段:

1. 表单和文件校验: 文本、车辆图、配件参考图、文件类型、数量限制。
2. 车辆画布解析: 本次车辆图优先，其次 session 原图或 latest 生成图。
3. Guardrail: Chat Mode 跳过改车关键词白名单，但保留 blocked terms、车辆画布和文件限制。
4. 视觉识别: 车辆图走 `vehicle_detection`，配件图走 `part_detection`。
5. 本地 parser: 识别颜色、车高、配件类别、上传参考图类别、资产库精确命中、结果修正等。
6. LLM fallback: 仅在本地返回可补全型 `needs_followup` 时尝试，不在 `ready` 后增强，不在 `rejected` 后翻案。
7. 本地二次解析: 将 fallback 的窄结果合并回输入，再跑 `parseChatIntent()`。
8. 确定性追问: context choice、缺配件参考图、碳纤维 colorPolicy 等硬条件仍由本地逻辑决定。
9. 标准 JSON: 由本地 `buildChatStandardJson()` 产出最终 `GenerationStandardJson`。
10. Prompt 和 reference allocation: 继续使用统一 prompt builder 和 provider-aware reference allocator。
11. Dry run 或真实生成: dry run 返回 preview；真实生成才检查权益、调用 provider、持久化消息和 generation。

## 3. 四类输出

### 3.1 Ready

当车辆画布存在、guardrail 通过、用户意图足够明确，并且所有配件来源都来自上传参考图或资产库精确命中时，输出 `status=ready` 和 `standardJson`。

典型例子:

- 上传原车图，说“改成纳多灰”。
- 上传原车图，说“降低一点”。
- 上传原车图，输入能精确命中资产库关键字的配件型号。
- 上传原车图和可识别的配件参考图，文本为空或只说“装这个”。

### 3.2 Needs Follow-Up

当用户有改装意图，但缺少必要信息时，输出 `needs_followup`，不进入生图。

典型缺失项:

- `modification_request`: 没有有效改装意图。
- `paint_color`: 说了颜色修正，但目标颜色不明确。
- `part_category`: 上传了配件图但类别无法确认。
- `uploaded_part_category`: 上传参考图类别需要补充。
- `part_reference:<category>`: 说了某类配件，但没有上传参考图，也没有资产库精确命中。
- `part_color_policy:hood` 或 `part_color_policy:mirrors`: 机盖/后视镜有碳纤维信号，但用户未确认车身同色或裸碳。

### 3.3 Rejected

当请求违反硬约束时，直接拒绝或返回 400，不调用 LLM fallback。

典型场景:

- 第一轮没有车辆画布。
- 上传超过 1 张车辆图。
- 上传超过 8 张配件参考图。
- 文件类型不是 jpg/png/webp。
- 命中 guardrail blocked terms。

### 3.4 Fallback Unable

本地 parser 返回可补全型 `needs_followup`，但 LLM fallback 没能给出高置信可用要素时，使用统一追问:

- 中文: `请先补充一个更明确的信息，再继续生成。`
- 英文: `Please add one clearer modification detail before generating.`

## 4. 策略地图

### 4.1 上传和画布

- 第一轮必须有车辆图。
- 每次请求最多 1 张车辆图。
- 每次请求最多 8 张配件参考图。
- 第一张车辆图是唯一画布；配件图只用于对应配件的造型、材质、比例和安装关系。
- 后续同一 session 可以复用原始画布或 latest 生成图。
- 如果已有生成结果且本次没有上传新车辆图，新的有效生成请求需要先让用户选择 `original / latest`。

### 4.2 Guardrail

- Chat Mode 不用“改车关键词白名单”拒绝模糊表达。
- blocked terms 仍然生效。
- guardrail 拒绝后不调用 LLM fallback。
- 文件和画布硬约束在 parser 之前执行。

### 4.3 视觉识别

- 车辆识别只用于确认图片是车辆、记录 view/confidence 等信息。
- Chat Mode 最终 prompt 不把未确认车型识别当成权威车型身份。
- `standardJson.vehicle.model` 固定为 `User uploaded vehicle, preserve exact identity`。
- 配件识别的关键字段是 category；brand/model/variant 只是辅助展示和 prompt 信息。

### 4.4 本地 parser

本地 parser 是主链路，优先处理这些确定性策略:

- 颜色: 识别明确车身改色，默认只改车身漆面。
- 自由颜色: Chat Mode 可以保存安全的自然语言颜色短语，例如 `midnight teal`、`champagne gold`、`墨绿色`；不确定时仍追问或走 LLM fallback。
- 姿态: 识别降低、低趴、齐边、stance、ride height 等车高意图。
- 配件类别: 使用后台 category 配置和 `lib/part-category-aliases.ts` 的近似词。
- 上传参考图分组: 同类别多图合并为一个 part，第一张为 primary reference。
- 资产库匹配: 只用后台维护的 required keywords 做精确命中，不用品牌泛词默认选资产。
- 缺配件参考: 文本提到配件但无上传图、无资产命中时，追问 `part_reference:<category>`。
- 卡钳局部改色: 用户明确说“把卡钳改成/喷成某颜色”时，生成 `calipers/free_text` 局部重涂，不要求上传卡钳参考图；如果目标颜色不明确，追问 `paint_color`。
- 结果修正: 对已有 generation 的局部修正，例如后视镜颜色修正，默认基于 latest。

### 4.5 配件来源优先级

配件最终来源只允许来自:

1. 用户上传的配件参考图。
2. 后台资产库 required keywords 精确命中的资产。
3. 受限的局部重涂或结果修正，例如后视镜颜色修正、卡钳颜色重涂。

禁止策略:

- 不因为用户只说“换轮毂”就默认取资产库第一个轮毂。
- 不让 LLM 自造 `assetId`、品牌、型号、reference URL。
- 不用参考图里的背景、车辆、角度、灯光、轮毂或贴纸污染原车画布。

### 4.6 碳纤维和 colorPolicy

当前需要明确选择的类别是 `hood` 和 `mirrors`。

触发条件:

- 资产或上传参考图属于机盖/后视镜。
- 文件名、识别类别、categoryLabel、model、variant 或 visualFeatures 有 carbon/碳纤维/裸碳/露碳/visible carbon 等信号。
- 用户没有明确选择 `body_color` 或 `exposed_carbon`。

处理方式:

- 返回 `part_color_policy:<category>` 追问。
- 如果同一轮同时命中多个类别，例如碳纤维机盖和碳纤维后视镜，返回多个 `part_color_policy:<category>`，并一次性展示多行 `车身同色 / 裸碳`。
- 新接口字段为 `partColorPolicyChoicesRequired` 和 `partColorPolicyChoices`；旧的 `partColorPolicyChoiceRequired` / `partColorPolicyCategory` 保留为兼容字段。
- 不因为型号里有 `Carbon Hood` 就自动裸碳。
- 用户明确说裸碳、露碳、exposed carbon、bare carbon、visible carbon、raw carbon 时才使用 `exposed_carbon`。
- 默认保护规则要求车身改色不污染玻璃、灯、轮毂、轮胎、牌照、黑色塑料饰条、碳纤维件、进气格栅、尾翼和未选配件。

## 5. LLM Fallback 边界

LLM fallback 是“低置信自然语言补全器”，不是最终裁判。

### 5.1 触发条件

只在本地 `parseChatIntent()` 返回 `needs_followup` 且所有 `missingFields` 都属于以下集合时触发:

- `modification_request`
- `part_category`
- `paint_color`
- `uploaded_part_category`

本地 `ready` 时不调用 fallback。本地 `rejected` 时不调用 fallback。

### 5.2 禁止触发

以下情况不允许 fallback 绕过:

- 缺少车辆画布。
- 文件类型或数量校验失败。
- guardrail rejected。
- `part_reference:<category>`。
- `part_color_policy:<category>`。
- context choice 未确认。
- 缺少用户明确上传或 catalog 精确命中的配件参考。

### 5.3 输出契约

LLM 只允许输出窄结构 `ChatFallbackIntent`:

```ts
{
  hasModificationIntent: boolean
  paint?: { action: "change"; target: string; confidence: number }
  stance?: { value: number; label: string; confidence: number }
  requestedCategories?: Array<{ categoryId: string; confidence: number }>
  uploadedReferenceCategories?: Array<{ fileName: string; categoryId: string; confidence: number }>
  clarificationQuestion?: string
  reason?: string
  confidence: number
}
```

不允许输出完整 `GenerationStandardJson`。

### 5.4 置信度和回流

- 总体 `confidence < 0.72` 时丢弃 fallback。
- 单字段 `confidence < 0.72` 时丢弃该字段。
- category 必须映射到现有 category id。
- uploaded reference category 必须对应实际上传的 `partReferences.fileName`。
- fallback 结果通过 `applyFallbackIntentToChatParseInput()` 合并回本地输入。
- 合并后重新跑 `parseChatIntent()`；最终 JSON 仍由本地 builder 生成。

### 5.5 Dry Run 和测试

- `dryRun=1`、`CHAT_DRY_RUN_DEFAULT=1` 或 `DISABLE_EXTERNAL_AI=1` 时不调用外部 LLM。
- dry-run 测试用 `CHAT_LLM_FALLBACK_FIXTURES=1` 模拟 fallback。
- 自动测试中 L 组覆盖 fallback 行为。

## 6. Prompt 和标准 JSON 不变量

无论用户怎么说，最终 prompt 和标准 JSON 都要守住这些不变量:

- `mode="chat"`。
- `vehicle.model="User uploaded vehicle, preserve exact identity"`。
- `vehicle.sourceImageUrl` 必须是当前选定画布。
- `constraints.preserveVehicleIdentity=true`。
- `constraints.preserveBackground=true`。
- `constraints.preserveCameraAngle=true`。
- `constraints.preserveLighting=true`。
- `constraints.preserveUnselectedParts=true`。
- `constraints.selectedOnly=true`。
- 没有明确车高请求时，最终 prompt 不写入车身姿态段。
- 没有明确配件来源时，不生成该配件。
- 配件 `source` 只能来自上传参考图、资产库精确命中或受限的结果修正。

## 7. Reference Allocation

参考图分配原则:

- 原车图永远是唯一画布。
- 每个 selected part 或 uploaded part group 优先保留 1 张 primary reference。
- 剩余预算优先补高风险类别，再补普通类别。
- 高风险类别由 category 配置和默认规则共同决定。
- GPT Image 类 provider 更保守，每个配件最多 1 张参考图。
- `avoid_upload` role 不上传。

当前 Chat Mode 上传限制是 1 张车辆图 + 8 张配件参考图；provider 实际发送数量再按工作流模型预算裁剪。

真实 provider 仍可能在本地规则通过后触发安全拦截。对 302 Nano Banana 2，发送前会复用 Config Mode 的安全版 prompt 处理：不把 negative prompt 作为独立负向字段传入，并清洗容易误触发的敏感词。若 provider 仍返回 `Content flagged` / `potentially sensitive` 等安全拦截，Chat Mode 不把原始英文错误直接展示给用户，而是提示更换更干净的原车图或参考图，避开图片里的敏感文字、贴纸、背景人物、武器、政治标识等元素。

## 8. 测试索引

自动测试入口:

```powershell
node scripts\chat-mode-dry-run-tests.mjs
```

最新通过事实:

- `node scripts\chat-mode-dry-run-tests.mjs`: 76/76 passed.
- `npx.cmd tsc --noEmit`: passed.

测试组映射:

- A: 上传限制、空文本规则、文件校验。
- B: 基础生成、颜色、车高、模糊颜色追问、卡钳局部改色。
- E: 未上传配件追问、资产库命中、上传配件分组、类别近似词。
- F: 多轮追问和 Config Mode 引导。
- G: latest/original 上下文画布选择。
- H: 宽松 Chat guardrail 和 blocked terms。
- L: LLM fallback fixture，验证窄意图补全和本地回流。
- S: 车身高度 preset，验证升高、降低、齐边、气动避震和冲突追问。
- P: 碳纤维机盖/后视镜 colorPolicy 追问和确认。

Config Mode 颜色补充:

- Config Mode 支持预设色和 request-only 自定义色。
- 自定义色通过 `paintId=custom` 加 `customPaintJson` 传入，格式为 `{ "label": "Custom #RRGGBB", "hex": "#RRGGBB", "rgb": "r,g,b" }`。
- Config Mode 还支持 request-only 车漆效果 `paintFinishEffect`: `gloss`、`metallic`、`matte`、`satin`、`pearl`、`chrome`、`gradient`。
- `gloss` 为默认亮面，不额外写效果 prompt；其它单色效果会追加到 `standardJson.paint.prompt`。
- `gradient` 通过 `gradientPaintJson` 传入 `{ "fromHex": "#006DFF", "toHex": "#7A2CFF", "direction": "front_to_rear" }`，并忽略普通单色 custom prompt。
- 自定义色不写入 SQLite catalog，不影响 Admin 色表。
- Config Mode 车身高度默认 `{ value: 0, label: "保持原车高度", prompt: "" }`，默认不输出 `## 车身姿态`；只有高度预设被主动选择时才写姿态 prompt。

## 9. 维护规则

任何 Chat Mode 策略变更都要同步做三件事:

1. 更新本文档。
2. 补或更新 dry-run case。
3. 如果影响 prompt 或 provider reference，检查有效 prompt 和 reference allocation 输出。

新增策略时按这个模板记录:

```md
### 策略名称

- 用户问题:
- 触发条件:
- 本地确定性规则:
- LLM fallback 行为:
- 标准 JSON 影响:
- Prompt 影响:
- 追问或拒绝文案:
- Dry-run 用例 ID:
- 不允许发生的误判:
```

如果某个策略只是运营词库扩展，优先维护后台 category aliases 或 `lib/part-category-aliases.ts`，不要在多个 parser 分支里重复硬编码。

## 10. 常见误区

- 不要把“LLM fallback 加了”理解成“用户怎么说都能直接生成”。
- 不要让 fallback 跳过缺参考图、碳纤维确认或 context choice。
- 不要把车辆识别车型写成 Chat Mode 权威车型 identity。
- 不要把资产库第一个候选当默认配件。
- 不要因为参考图里有其它车、背景、轮毂或贴纸，就把这些内容带到原车图。
- 不要只改代码不补 dry-run case；Chat Mode 的可靠性主要靠规则和测试一起收敛。

## 11. 车身高度 preset 策略

Config Mode 和 Chat Mode 共用四档车身高度语义，默认不选就是保持原车高度且不输出 `## 车身姿态`。

- `25 / 轻微升高`: 用户说升高、抬高、raise、lift、higher 时命中。Prompt 只轻微增加轮拱间隙和离地间隙，不做越野升高。
- `50 / 轻微降低`: 用户说降低一点、低一点、lower、drop、lowered 时命中。Prompt 明确减少轮胎上沿与轮拱间隙，但不藏轮、不压轮胎。
- `70 / 齐边低趴`: 用户说齐边、贴齐、轮眉齐边、flush、flush fitment 时命中。Prompt 目标是轮胎上沿接近轮眉，轮拱间隙接近 0 到 1 指宽。
- `90 / 气动避震`: 用户说气动、气动低趴、趴地、极低、藏轮、air suspension、aired out、bagged、slammed、tire tuck 时命中。Prompt 允许轮眉轻微盖住轮胎上沿，形成 aired-out / tire tuck 效果。

强度优先级是 `气动避震 > 齐边低趴 > 轻微降低 > 轻微升高`。如果同一句话同时明确要求升高和低趴/气动，例如“升高但趴地”，本地 parser 返回 `needs_followup`，要求用户确认方向。

LLM fallback 不能自由编写车高 prompt。它最多返回 stance value，本地会 snap 到上述四档 preset，再使用本地固定 prompt。所有 preset prompt 都必须强调不缩放整车、不移动地面和轮胎接地点、不改变画布/相机角度/背景/轮毂尺寸，只改变悬挂高度、轮拱间隙和车身相对地面的关系。
