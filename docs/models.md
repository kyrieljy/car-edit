# 模型使用情况

> 最后更新时间：2026-08-07
>
> 关联方案ID：DESIGN-20260807-001
>
> 数据来源：`lib/catalog.ts` 中的 `providerSeed`、`scripts/switch-yunwu-default.mjs`、`lib/server/generation-provider.ts`、`lib/server/llm-provider.ts`、`lib/server/vision-provider.ts`。

## 一、供应商及管理后台链接

项目通过以下外部平台调用底层大模型 API。登录各平台管理后台后可查看 API 用量、余额和账单。

| 供应商 | API 调用域名 | 管理后台链接（查看 API 用量） | 平台说明 |
|--------|------------|---------------------------|---------|
| 胜算云 | `router.shengsuanyun.com` | [shengsuanyun.com](https://shengsuanyun.com) | AI 模型智能路由平台，统一 API 接入多家底层模型 |
| 云雾 AI | `yunwu.ai` | [yunwu.ai](https://yunwu.ai) | AI 模型中转/代理平台 |
| 302.AI | `api.302ai.cn` | [app.302.ai](https://app.302.ai) | 汇集全球顶级 AI 的自助服务平台（当前已禁用） |
| OpenAI 官方 | `api.openai.com` | [platform.openai.com](https://platform.openai.com) | OpenAI 官方平台（当前已禁用） |

## 二、各供应商当前使用的模型

### 1. 胜算云（shengsuanyun.com）— 默认启用

| Provider ID | 标签 | 模型 | 能力 | 用途 | 启用状态 | 画质配置 |
|-------------|------|------|------|------|---------|----------|
| `openai-llm` | GPT-5.4-mini | `openai/gpt-5.4-mini` | vision, llm | 对话意图解析、车型识别、配件识别、结果质量检查 | 启用 | — |
| `provider_d77cadd5` | QWEN-3.6 | `ali/qwen3.6-plus` | vision, llm | LLM 对话意图解析（备选） | 启用 | — |
| `openai` | GPT Image 2 | `openai/gpt-image-2` | image_generation | 配置模式 / 对话模式生图 | 启用 | A 类（quality）：管理后台「画质参数」可配（DESIGN-20260807-001） |
| `nano` | Nano Banana 2 | `google/gemini-3.1-flash-image-preview` | image_generation | Gemini 图像编辑生图 | 启用 | B 类（imageSize/resolution）：管理后台「画质参数」可配（DESIGN-20260807-001） |

### 2. 云雾 AI（yunwu.ai）— 默认启用

| Provider ID | 标签 | 模型 | 能力 | 用途 | 启用状态 | 画质配置 |
|-------------|------|------|------|------|---------|----------|
| `provider_yunwu_nano2_edit` | Yunwu Nano Banana 2 | `gemini-3.1-flash-image-preview` | image_generation | 生图（当前默认激活的工作流生图 Provider） | 启用 | B 类（imageSize/resolution）：管理后台「画质参数」可配（DESIGN-20260807-001） |
| `provider_yunwu_image_edit` | Yunwu GPT Image 2 | `gpt-image-2` | image_generation | GPT Image 2 图像编辑（备选生图） | 启用 | A 类（quality）：管理后台「画质参数」可配（DESIGN-20260807-001） |

### 3. 302.AI（302.ai）— 当前已禁用

| Provider ID | 标签 | 模型 | 能力 | 用途 | 启用状态 | 画质配置 |
|-------------|------|------|------|------|---------|----------|
| `provider_302_nano_banana2_async_edit` | 302-Nano Banana 2 | `gemini-3.1-flash-image-preview` | image_generation | 异步图像编辑（已由脚本批量禁用） | 已禁用 | B 类（imageSize/resolution）：管理后台「画质参数」可配（DESIGN-20260807-001） |
| `provider_80fce082` | 302-GPT Image 2 | `gpt-image-2` | image_generation | GPT Image 2 图像编辑（已由脚本批量禁用） | 已禁用 | A 类（quality）：管理后台「画质参数」可配（DESIGN-20260807-001） |

### 4. OpenAI 官方（openai.com）— 当前已禁用

| Provider ID | 标签 | 模型 | 能力 | 用途 | 启用状态 | 画质配置 |
|-------------|------|------|------|------|---------|----------|
| `openai-vision` | OpenAI Vision | `gpt-4.1-mini` | vision | 视觉识别（车型/配件），实际已由胜算云 `openai-llm` 替代 | 已禁用 | — |

## 三、涉及的底层大模型汇总

| 底层模型 | 提供方 | 经由供应商 | 能力类型 |
|---------|--------|----------|---------|
| Google Gemini 3.1 Flash Image Preview（Nano Banana 2） | Google | 云雾 AI / 胜算云 / 302.AI | 图像生成 |
| OpenAI GPT Image 2 | OpenAI | 云雾 AI / 胜算云 / 302.AI | 图像生成 |
| OpenAI GPT-5.4-mini | OpenAI | 胜算云 | LLM / 视觉 |
| 阿里通义千问 QWEN-3.6 Plus | 阿里云 | 胜算云 | LLM / 视觉 |
| OpenAI GPT-4.1-mini | OpenAI | OpenAI 官方 | 视觉（已禁用） |

## 四、当前实际生效的调用链

根据 `scripts/switch-yunwu-default.mjs` 切换脚本和工作流种子配置（`workflowSeed`）：

- **生图**：默认走 `provider_yunwu_nano2_edit`（云雾 AI 的 Gemini Nano Banana 2）
- **车型/配件识别、结果检查、对话意图解析**：走 `openai-llm`（胜算云的 GPT-5.4-mini）
- 302.AI 的两个 Provider 已被脚本批量禁用（`enabled=0, active=0`）

> 注：Provider ID `openai` 并非直连 OpenAI 官方，而是经胜算云路由的 `openai/gpt-image-2`；真正直连 OpenAI 官方的只有 `openai-vision`（且已禁用）。
