# gpt-image-2（302 /v1/images/edits）图片质量如何调整

> 结论先行：当前 `gpt-image-2` 这条接口的质量相关参数在代码里是**硬编码常量**，
> 没有配置界面、也没有走 `YUNWU_*` 系列环境变量（那套变量只作用于另一个 Yunwu 端点）。
> 要调整质量，唯一位置是 `lib/server/generation-provider.ts` 里的 `fast302ImageOptions()`，
> 以及 `invokeOpenAiCompatibleImageEdit` 中对 `size` / `input_fidelity` 的处理。

> ⚠️ **现状已变更（2026-08-07，DESIGN-20260807-001）**：上述「只能改代码」的结论已被取代。
> 画质参数现已迁移为**管理后台 Provider 级「画质参数」配置**，参数名（`key`）与枚举值（`options`）双可配，平台内置默认模板。
> `gpt-image-2`（A 类 OpenAI 兼容 `/images/edits`）的 `quality` 等参数可在后台直接调整，无需修改 `generation-provider.ts`；
> 注入逻辑统一由 `lib/server/provider-param-injector.ts` 按 Provider 协议类型映射。保留值 `''` 表示不传、`'__auto__'` 表示自适应，二者不等同于 API 字面量 `auto`。
> 本文保留作为「代码层原始参数」的参考，但与后台配置冲突时以**后台配置为准**。

## 一、接口文档定义的「质量相关」参数（gpt-image-2）

| 参数 | 文档取值 | 作用 |
|------|----------|------|
| `quality` | `low` / `medium` / `high` / `auto` | 生成精细度，最核心的质量杠杆；越高越贵越慢 |
| `size` | 同「生成接口」尺寸表（方形 + 1536 系） | 输出分辨率，越高细节越多、越贵 |
| `input_fidelity` | `low` / `high` | `high` 可更好保留人脸 / Logo / 车辆品牌特征 |
| `output_format` | `png` / `jpeg` / `webp` | `png` 无损最高质；`jpeg/webp` 有损 |
| `output_compression` | `0–100`（仅 jpeg/webp） | 越低文件越小（越损） |
| `background` | `transparent` / `opaque` / `auto` | 透明背景适配设计场景 |
| `n` | `1–10` | 一次生成张数（非单图清晰度，但可出变体挑优） |
| `moderation` | `low` / `auto` | 审核严格度，间接影响出图成功率 |

## 二、当前项目实际传入的值（问题所在）

读取链路：`invokeOpenAiCompatibleImageEdit`（`generation-provider.ts:121`）
→ `is302ImageEndpoint` 命中 → `append302FastImageOptions`（`:133`）→ `fast302ImageOptions()`（`:1448`）。

| 参数 | 当前实际值 | 来源（文件:行） | 说明 |
|------|-----------|----------------|------|
| `quality` | **`"low"`（最低档！）** | `generation-provider.ts:1450` | 写死在常量里，最大质量杠杆被压到最低 |
| `output_format` | `"webp"` | `:1452` | 写死 |
| `output_compression` | `85` | `:1453` | 写死（webp 下 85 可接受） |
| `background` | `"opaque"` | `:1451` | 写死 |
| `size` | 由原图宽高比自动映射：`>1.1→1536x1024`；`<0.9→1024x1536`；否则 `1024x1024` | `:142-143` + `:1457` + `:1488` | 非用户指定 |
| `input_fidelity` | **未传入** | — | 302 分支不进 `supportsInputFidelity` 分支（`:136`），文档参数被遗漏 |
| `n` | `1` | `:130` | 固定 1 张 |
| `moderation` | 未传（走平台默认 `auto`） | — | 未设 |

> 注意：`YUNWU_IMAGE_QUALITY` / `YUNWU_IMAGE_OUTPUT_FORMAT` / `YUNWU_IMAGE_OUTPUT_COMPRESSION` / `YUNWU_IMAGE_SIZE`
> 这些环境变量**只被 Yunwu 端点（`appendYunwuImageEditOptions` / `yunwuImageQuality` 等）读取**，
> 对 `gpt-image-2`（302 端点）**完全不生效**。改环境变量调不动 gpt-image-2 的质量。

## 三、如何调整（改代码，精确到位置）

### 1. 提升核心质量：`quality`
`lib/server/generation-provider.ts` 的 `fast302ImageOptions()`（`:1448`）：
```ts
function fast302ImageOptions() {
  return {
    quality: "low",          // ← 改成 "high" 或 "auto" 提升清晰度
    background: "opaque",
    output_format: "webp",
    output_compression: 85,
  }
}
```
建议改为 `"high"`（最高质量）或 `"auto"`（让平台按提示词自动选）。
代价：`gpt-image-2` 输出价为 30 PTC/1M Tokens，`high` 比 `low` 明显更贵、更慢。

### 2. 锁定无损格式（设计/对比场景）
把 `output_format` 改为 `"png"`（无损，文件大）；若想兼顾体积与质量，保留 `"webp"` + 把 `output_compression` 提到 `95~100`。

### 3. 提高输出分辨率
`providerOutputImageSize`（`:1457`）目前只映射到 `1024/1536` 三档。若文档尺寸表允许更大尺寸（如 `2048x2048`），可在此扩展枚举；或直接在 `:131` 把默认 `size` 写死为更高档。

### 4. 补上 `input_fidelity=high`（强烈建议，针对车辆品牌保真）
当前 302 分支没有传 `input_fidelity`，而文档明确 `high` 可更好保留人脸/Logo——对汽车改装（保留车标、轮毂、车型线条）很关键。
在 `append302FastImageOptions`（`:1432`）里加一行即可：
```ts
function append302FastImageOptions(formData: FormData) {
  for (const [key, value] of Object.entries(fast302ImageOptions())) {
    formData.append(key, String(value))
  }
  formData.append("input_fidelity", "high") // ← 新增：保留车辆品牌/车型特征
}
```

### 5. 透明背景（如需抠图/合成）
把 `background` 改为 `"transparent"` 或 `"auto"`。

## 四、推荐的一键高质量配置（示例）
将 `fast302ImageOptions()` 改为：
```ts
function fast302ImageOptions() {
  return {
    quality: "high",
    background: "opaque",
    output_format: "png",
    output_compression: 100,
  }
}
```
并在 `append302FastImageOptions` 内追加 `formData.append("input_fidelity", "high")`。
若还需更高分辨率，同步放宽 `providerOutputImageSize` 的尺寸枚举。

## 五、验证方式
改完后需把 `provider_80fce082` 的 `enabled/active/hasApiKey` 置为 `true`（当前均为 false，接口不会被实际调用），
然后在 car-mod 配置模式上传车辆图点击生成，观察返回图清晰度与 `quality`/`size` 是否随配置变化。

> 最后更新时间：2026-08-07
>
> 关联方案ID：DESIGN-20260807-001
