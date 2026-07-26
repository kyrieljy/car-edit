# DESIGN-20260725-001：配置界面添加 Dry run 选项

## 元信息
- **创建日期**：2026-07-25
- **状态**：已实施
- **关联需求**：在配置模式（Studio）的配置界面"生成"按钮上方添加 Dry run 复选框，与对话模式已有的 Dry run 功能行为对齐

---

## 1. 背景

当前系统的对话模式（chat-mode）已实现 Dry run 功能——通过复选框开关，可以在调试时跳过外部 AI 调用（视觉识别、LLM 回退、生图 API），仅返回 JSON / Prompt 预览且不消耗用户配额。这大幅降低了调试成本。

然而，配置模式（car-mod-studio）尚不支持 Dry run。调试配置模式时，每次点击"生成"都会实际调用生图 API 并扣费，成本较高。需要在配置界面也添加 Dry run 选项，使两种模式的调试体验一致。

## 2. 功能描述

### 核心用户故事

作为开发者/调试者，我希望在配置模式的配置界面中通过一个 Dry run 开关来控制是否调用生图 API，以便在不消耗配额的情况下调试配置流程。

### 功能细节

1. **UI 位置**：在配置面板（`.config-column`）中，"生成"按钮（`.run-button`）的正上方添加一个 Dry run 复选框
2. **UI 样式**：复用对话模式的 `chat-dry-run-toggle` 样式，保持视觉一致性（label + checkbox，带 title 提示）
3. **默认状态**：默认关闭（`false`），因为配置模式面向正式使用场景
4. **Dry run 开启时的行为**：
   - 不扣费（跳过 `checkAndConsumeEntitlement`）
   - 不调用 `runGenerationWorkflow`（不调生图 API）
   - 调用 `previewGenerationWorkflow` 构建 prompt 预览
   - 返回预览 JSON（包含 workflowId、provider、promptSummary 等），不返回结果图片
5. **Dry run 关闭时**：行为与当前完全一致，无任何变化

### 非功能性需求

- 不影响现有生成流程的性能
- 复用已有的 `previewGenerationWorkflow` 函数，不引入新逻辑

## 3. 技术实现思路

### 整体策略

采用与对话模式完全一致的 Dry run 架构模式，分三层实现：

1. **前端层**（car-mod-studio.tsx）：添加 dryRun 状态 + 复选框 UI + FormData 传参
2. **API 路由层**（generations/route.ts）：解析 dryRun 参数，在扣费前分支处理
3. **引擎层**：复用已有的 `previewGenerationWorkflow`，无需改动

### 前端实现逻辑

- 在 `car-mod-studio.tsx` 中声明 `useState(false)` 管理 dryRun 状态（默认关闭）
- 在"生成"按钮上方渲染 `<label>` + `<input type="checkbox">` 复选框，样式与对话模式对齐
- 在 `generate()` 函数中，将 dryRun 值通过 `formData.append("dryRun", dryRun ? "1" : "0")` 传递
- 当 dryRun 开启时，生成按钮文案可考虑加 "(Dry run)" 后缀以示区分（可选）

### API 路由实现逻辑

- 在 `handleGenerationPost` 函数入口处，解析 `dryRun` 参数：`const dryRun = isDryRunRequest(formData)`（复用对话模式的解析逻辑，或内联一个等价的判断）
- 在扣费步骤（`checkAndConsumeEntitlement`）之前插入 dry run 分支
- dry run 分支的执行流程：
  1. 仍执行上传校验、参数解析、guardrail 检查（这些不涉及外部调用）
  2. 仍执行 `buildConfigStandardJson` 构建 standardJson
  3. **跳过**图片上传保存（dry run 无需持久化）
  4. **跳过** `checkAndConsumeEntitlement` 扣费
  5. 调用 `previewGenerationWorkflow({ mode: "config", ... })` 获取预览
  6. 通过 `emitProgress({ step: "complete" })` 发送完成进度
  7. 返回 JSON 响应，包含 `dryRun: true` 和预览信息

### 关键交互说明

- `previewGenerationWorkflow` 已支持 `mode: "config"` 参数（现有对话模式 dry run 传 `mode: "chat"`），无需修改引擎代码
- 对话模式的 `isDryRunRequest` 函数定义在 `chat/messages/route.ts` 中，配置模式可内联一个等价判断，或提取为共享工具函数（推荐内联，避免不必要的耦合）

## 4. 涉及的模块与文件

### 代码变更

| 文件（相对路径） | 操作（新增/修改/删除） | 说明 |
|-------------------|------------------------|------|
| `components/car-mod-studio.tsx` | 修改 | 添加 dryRun 状态声明、复选框 UI、generate() 中传参 |
| `app/api/generations/route.ts` | 修改 | 添加 dryRun 参数解析、扣费前分支逻辑、dry run 响应 |

### 数据库变更

无

### 接口变更

| 接口路径 | 操作（新增/修改/废弃） | 说明 |
|----------|------------------------|------|
| `POST /api/generations` | 修改 | 新增可选参数 `dryRun`（"1" 或 "0"），响应中新增 `dryRun` 字段和 `generationPreview` 字段（仅 dryRun=true 时） |

## 5. 影响分析

### 文档影响

| 文档 | 优先级 | 需更新的内容 |
|------|--------|-------------|
| API_REFERENCE.md | P1 | generations 接口新增 dryRun 请求参数及响应字段说明 |
| DB_SCHEMA.md | 无 | 无数据库变更 |
| ARCHITECTURE.md | 无 | 不涉及架构变更 |
| BUSINESS_DOMAIN.md | 无 | 不涉及业务概念变更 |
| README.md | 无 | 不涉及启动方式或目录结构变更 |
| CHANGELOG.md | P0 | 必须记录此次变更 |

### 模块影响

- `lib/server/generation-engine.ts`：无代码变更，但 `previewGenerationWorkflow` 将新增 `mode: "config"` 的调用路径，需验证其在 config 模式下的行为正确性
- `components/car-mod-studio.tsx`：新增约 20 行代码（状态声明 + UI + 传参），不影响现有功能
- `app/api/generations/route.ts`：新增约 30 行代码（dryRun 解析 + 分支逻辑），现有代码路径不变

## 6. 风险与应对

| 风险 | 可能性 | 影响 | 应对措施 |
|------|--------|------|----------|
| `previewGenerationWorkflow` 在 `mode: "config"` 下行为与 `mode: "chat"` 存在差异导致预览不准确 | 低 | 中 | 实施时验证 config 模式下的 preview 输出是否合理，必要时在引擎层做适配 |
| 移动端（mobile-studio-app.tsx）同步显示配置界面，dry run 复选框可能需要移动端适配 | 中 | 低 | 初步实施方案仅影响桌面端 car-mod-studio.tsx，移动端可在后续单独适配 |

## 7. 实施步骤

1. 在 `components/car-mod-studio.tsx` 中声明 `dryRun` 状态（`useState(false)`）
2. 在"生成"按钮上方添加 Dry run 复选框 UI（label + checkbox + title 提示）
3. 在 `generate()` 函数中将 `dryRun` 参数追加到 FormData
4. 在 `app/api/generations/route.ts` 的 `handleGenerationPost` 函数入口处解析 `dryRun` 参数
5. 在扣费步骤之前插入 dry run 分支：执行参数解析和 guardrail 后，调用 `previewGenerationWorkflow` 并返回预览结果
6. 验证 dry run 关闭时现有流程不受影响
7. 验证 dry run 开启时不扣费、不调生图 API、正确返回预览
8. 更新 CHANGELOG.md

## 8. 验收标准

- [ ] 配置界面的"生成"按钮上方出现 Dry run 复选框
- [ ] 复选框默认状态为未选中（关闭）
- [ ] 勾选 Dry run 后点击"生成"，不消耗用户配额
- [ ] Dry run 返回的 JSON 包含 `dryRun: true` 和 `generationPreview` 对象（含 promptSummary、provider 等信息）
- [ ] Dry run 返回的 JSON 不包含结果图片 URL
- [ ] 取消勾选 Dry run 后点击"生成"，行为与变更前完全一致（正常扣费、正常生图）
- [ ] CHANGELOG.md 已更新

> 最后更新时间：2026-07-25
