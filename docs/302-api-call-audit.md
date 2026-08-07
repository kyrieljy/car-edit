# 302.AI 图片编辑接口（/v1/images/edits）调用合规审计

> 审计依据：`https://doc.302.ai/288853817e0`
> 审计范围：`E:\AI-project\car-edit` 源码与 Provider 配置
> 审计日期：2026-08-07

## 一、接口文档要点（doc.302.ai/288853817e0）

| 项目 | 内容 |
|------|------|
| 接口路径 | `POST /v1/images/edits` |
| 合法 Base URL | `https://api.302.ai`（海外）<br>`https://api.302ai.cn`（国内 1）<br>`https://api.302ai.com`（国内 2） |
| 请求格式 | `multipart/form-data` |
| 认证方式 | `Authorization: Bearer <API_KEY>`（放在请求头） |
| 必填字段 | `image`（文件）、`prompt`（文本）、`model`（枚举） |
| 可选字段 | `mask`、`quality`(auto/high/medium/low)、`size`(1024x1024/1536x1024/1024x1536/auto 等)、`n`(1-10)、`background`(transparent/opaque/auto)、`output_format`(png/jpeg/webp,默认 png)、`output_compression`(0-100,仅 jpeg/webp)、`partial_images`、`stream`、`input_fidelity`、`moderation` |
| 查询参数 | `response_format`：**仅 DALL-E 2 适用**，取值 `url` / `b64_json`（url 有效期 60 分钟） |
| 文档枚举模型 | `gpt-image-1`、`gpt-image-1-mini`、`gpt-image-1.5`、`gpt-image-2`（默认）、`DALL-E 2` |

## 二、匹配分析：哪些模型 API 调用应基于本文档

判定条件：**接口域名属于 302.ai 三域名之一** 且 **model 名称出现在文档枚举中**。

源码中（含 `lib/catalog.ts`）所有命中 302.ai 域名的 Provider 仅有 2 个：

| Provider ID | model | baseUrl | 命中条件 |
|-------------|-------|---------|----------|
| `provider_80fce082` | `gpt-image-2` | `https://api.302ai.cn/v1/images/edits` | ✅ 同域名 + 模型在文档枚举 |
| `provider_302_nano_banana2_async_edit` | `gemini-3.1-flash-image-preview` | `https://api.302ai.cn/ws/api/v3/google/nano-banana-2/edit` | ❌ 模型不在文档枚举，且路径非 `/v1/images/edits`（属 nano-banana-2 另一份文档） |

→ 满足「同 URL + 模型在文档提及」的模型调用只有 **`gpt-image-2`**。

## 三、当前调用正确性结论（核心表格）

| 模型名称 | Provider ID | 接口 URL | 是否应基于本文档 | 当前调用是否正确 | 说明 |
|----------|-------------|----------|------------------|------------------|------|
| `gpt-image-2` | `provider_80fce082` | `https://api.302ai.cn/v1/images/edits` | ✅ 是 | ⚠️ **基本正确，存在 1 处文档偏差** | 见下方逐条核对 |

### `gpt-image-2` 调用逐条核对（实现位于 `lib/server/generation-provider.ts` → `invokeOpenAiCompatibleImageEdit`）

| 检查项 | 文档要求 | 代码实现 | 结果 |
|--------|----------|----------|------|
| HTTP 方法 | `POST` | `fetch(..., { method: "POST" })` | ✅ |
| 路径 | `/v1/images/edits` | Provider baseUrl 即该路径，经 `generationEndpoint` 识别为 `image_edit` 类型 | ✅ |
| 域名 | 302.ai 三域名之一 | `api.302ai.cn`（国内 1，文档认可） | ✅ |
| Content-Type | `multipart/form-data` | 使用 `FormData` 作 body，浏览器/Node 自动带 boundary | ✅ |
| `model` 必填 | 枚举值之一 | `formData.append("model", "gpt-image-2")`，值合法 | ✅ |
| `prompt` 必填 | 文本 | `formData.append("prompt", ...)` | ✅ |
| `image` 必填 | 文件 | `formData.append("image", new Blob(...), fileName)` | ✅ |
| 认证 | `Authorization: Bearer <key>` | `providerRequestHeaders` 返回 `Authorization: Bearer ${apiKey}` | ✅ |
| `size` | 合法枚举 | 由 `supported302ImageSize` 计算为 1024x1024 / 1536x1024 / 1024x1536，均合法 | ✅ |
| `quality` / `background` / `output_format` / `output_compression` | 合法枚举 | `fast302ImageOptions()` 设为 `quality=low` / `background=opaque` / `output_format=webp` / `output_compression=85`，全部在文档允许范围 | ✅ |
| **`response_format` 查询参数** | **文档注明仅 DALL-E 2 适用** | 代码对所有 302 图片端点无条件追加 `?response_format=b64_json`（`responseFormatParamsFor302Images`），**未区分模型** | ⚠️ **偏差**：gpt-image-2 应通过 `output_format`（代码已设为 webp）控制返回格式，而非 `response_format`。302.ai 代理大概率兼容，但严格按文档属越界使用。 |

### 其他需要注意的事实

- **该 Provider 当前处于禁用状态**：`provider_80fce082` 的 `enabled=false`、`active=false`、`hasApiKey=false`（见 `lib/catalog.ts` 与 `docs/models.md`），因此实际运行不会被调用，但代码路径本身已就绪。
- **文档提及但项目未使用的模型**：`gpt-image-1`、`gpt-image-1-mini`、`gpt-image-1.5`、`DALL-E 2` 在源码中均无对应 Provider 调用。
- **同域名但不属于本文档的调用**：`provider_302_nano_banana2_async_edit`（model=`gemini-3.1-flash-image-preview`，路径 `/ws/api/v3/google/nano-banana-2/edit`）走 `invoke302NanoBananaWsEdit` 独立分支，应依据 nano-banana-2 接口文档，而非本文档。

## 四、建议

1. 将 `response_format=b64_json` 的追加逻辑限定为仅当 `model === "dall-e-2"`（或 `DALL-E 2`）时生效，其余模型（如 `gpt-image-2`）改用 `output_format` + 读取 `b64_json`/`url` 字段，以严格符合文档。
2. 若需启用 `gpt-image-2` 直连 302.ai，先在管理后台补全 API Key 并将 `enabled`/`active` 置为 true（当前为禁用）。
