import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { setDefaultResultOrder } from "node:dns"
import { getProviderApiKey } from "./db"
import type { GenerationMode, GenerationStandardJson, ProviderConfig, ProviderId } from "../types"

try {
  setDefaultResultOrder("ipv4first")
} catch {
  // Older Node runtimes may not support this option; fetch will use the runtime default.
}

export type GenerationProviderRequest = {
  mode: GenerationMode
  provider: ProviderConfig
  vehicleImageUrl: string
  partImageUrls: string[]
  prompt: string
  negativePrompt: string
  standardJson: GenerationStandardJson
  retryAttempt: number
}

export type GenerationProviderResponse = {
  ok: boolean
  provider: ProviderId
  resultImageUrl: string
  latencyMs: number
  usageUnits: number
  costCents: number
  rawResponse: Record<string, unknown>
  error?: string
}

const FIXED_MOCK_RESULT_URL = "/assets/results/fixed-m3-render.png"
const NANO_BANANA_WS_POLL_INTERVAL_MS = 4000
const MAX_NANO_BANANA_WS_INPUT_IMAGES = 14
const PROVIDER_SAFETY_BLOCK_MESSAGE =
  "The image provider safety check blocked this request. Try a cleaner vehicle or reference image, or remove sensitive-looking text, decals, background people, weapons, politics, or other sensitive visual elements before retrying."
const NANO_BANANA_EN_SAFETY_TERMS =
  /\b(no\s+)?(people|persons?|portraits?|humans?|faces?|nudes?|nudity|nsfw|weapons?|violence|violent|politics|political|sensitive|unsafe|blood|gore|hate|sexual|minors?)\b/gi
const NANO_BANANA_CJK_SAFETY_TERMS =
  /(\u4eba\u7269|\u4eba\u50cf|\u771f\u4eba|\u884c\u4eba|\u4eba\u8138|\u6b66\u5668|\u66b4\u529b|\u653f\u6cbb|\u88f8\u9732|\u8272\u60c5|\u8840\u8165|\u4ec7\u6068|\u654f\u611f)/g

export function isProviderSafetyBlockMessage(value: unknown) {
  const text = safetyCheckText(value).toLowerCase()
  if (!text) return false
  return [
    "content flagged",
    "potentially sensitive",
    "sensitive content",
    "safety check",
    "safety system",
    "content policy",
    "policy violation",
    "blocked by safety",
    "unsafe content",
  ].some((term) => text.includes(term))
}

export function providerSafetyBlockMessage(language: "en" | "zh" = "en") {
  if (language === "zh") {
    return "\u5916\u90e8\u751f\u56fe\u6a21\u578b\u7684\u5b89\u5168\u68c0\u6d4b\u62e6\u622a\u4e86\u8fd9\u6b21\u8bf7\u6c42\u3002\u672c\u5730\u5bf9\u8bdd\u89e3\u6790\u5df2\u901a\u8fc7\uff1b\u8bf7\u5c1d\u8bd5\u6362\u4e00\u5f20\u66f4\u5e72\u51c0\u7684\u539f\u8f66\u56fe\u6216\u53c2\u8003\u56fe\uff0c\u6216\u907f\u5f00\u56fe\u7247\u91cc\u7684\u654f\u611f\u6587\u5b57\u3001\u8d34\u7eb8\u3001\u80cc\u666f\u4eba\u7269\u3001\u6b66\u5668\u3001\u653f\u6cbb\u6807\u8bc6\u7b49\u5143\u7d20\u540e\u91cd\u8bd5\u3002"
  }
  return PROVIDER_SAFETY_BLOCK_MESSAGE
}

export async function invokeGenerationProvider(input: GenerationProviderRequest): Promise<GenerationProviderResponse> {
  const started = Date.now()
  if (input.provider.id === "mock" || input.provider.baseUrl.startsWith("local://")) {
    return mockResponse(input, started)
  }
  if (process.env.DISABLE_EXTERNAL_AI === "1") {
    return providerError(input.provider, started, "External AI calls are disabled by DISABLE_EXTERNAL_AI=1.")
  }
  if (!input.provider.enabled) {
    return providerError(input.provider, started, "生图 Provider 未启用。")
  }
  if (!input.provider.modelName.trim()) {
    return providerError(input.provider, started, "生图 Provider 未配置模型名称。")
  }
  const apiKey = getProviderApiKey(input.provider.id)
  if (!apiKey) {
    return providerError(input.provider, started, "生图 Provider API Key 为空或需要重新保存。")
  }

  try {
    return await invokeOpenAiCompatibleGeneration(input, apiKey, started)
  } catch (error) {
    const recovered = await recover302TransportFailure(input.provider, apiKey, started, error)
    if (recovered) return recovered
    return providerError(input.provider, started, providerTransportErrorMessage(input.provider, error), providerTransportErrorRaw(input.provider, error))
  }
}

async function invokeOpenAiCompatibleGeneration(
  input: GenerationProviderRequest,
  apiKey: string,
  started: number,
): Promise<GenerationProviderResponse> {
  const endpoint = generationEndpoint(input.provider.baseUrl)
  if (endpoint.kind === "chat_completions") {
    return invokeOpenAiCompatibleChatImage(input, apiKey, started, endpoint.url)
  }
  if (endpoint.kind === "image_generation") {
    return invokeOpenAiCompatibleImageGeneration(input, apiKey, started, endpoint.url)
  }
  return invokeOpenAiCompatibleImageEdit(input, apiKey, started, endpoint.url)
}

async function invokeOpenAiCompatibleImageEdit(
  input: GenerationProviderRequest,
  apiKey: string,
  started: number,
  endpoint: string,
): Promise<GenerationProviderResponse> {
  const formData = new FormData()
  formData.append("model", input.provider.modelName)
  formData.append("prompt", [input.prompt, input.negativePrompt ? `Negative Prompt:\n${input.negativePrompt}` : ""].filter(Boolean).join("\n\n"))
  formData.append("n", "1")
  formData.append("size", "1024x1024")
  if (is302ImageEndpoint(endpoint)) {
    append302FastImageOptions(formData)
  } else if (supportsInputFidelity(input.provider.modelName)) {
    formData.append("input_fidelity", "high")
  }

  const images = await Promise.all([input.vehicleImageUrl, ...input.partImageUrls].filter(Boolean).map(readImageSource))
  if (!images.length) throw new Error("没有可发送给生图 Provider 的车辆图片。")
  formData.set("size", providerOutputImageSize(endpoint, images[0]))
  images.forEach((image) => {
    formData.append("image", new Blob([image.bytes], { type: image.mime }), image.fileName)
  })

  const requestEndpoint = is302ImageEndpoint(endpoint) ? withQueryParams(canonical302Endpoint(endpoint), { response_format: "url" }) : endpoint
  const response = await fetch(requestEndpoint, {
    method: "POST",
    headers: providerRequestHeaders(apiKey, requestEndpoint),
    body: formData,
  })
  const payload = await readProviderPayload(response)
  const raw = payload.raw
  if (!response.ok) {
    Object.assign(raw, {
      error: { message: providerHttpErrorMessageForUi(raw, payload, response, endpoint) },
      endpoint,
      httpStatus: response.status,
      statusText: response.statusText,
    })
  }
  if (!response.ok) {
    return providerError(
      input.provider,
      started,
      providerErrorMessage(raw) || `生图 Provider 调用失败：HTTP ${response.status}`,
      sanitizeRawResponse(raw),
    )
  }

  const imageResult = findImageResult(raw)
  if (!imageResult) {
    return providerError(input.provider, started, "生图 Provider 未返回可识别的图片 URL 或 base64。", sanitizeRawResponse(raw))
  }
  const resultImageUrl = await saveProviderImage(imageResult, input.provider.id)
  const usageUnits = estimateUsageUnits(raw)
  return {
    ok: true,
    provider: input.provider.id,
    resultImageUrl,
    latencyMs: Date.now() - started,
    usageUnits,
    costCents: estimateCostCents(input.provider.id, usageUnits),
    rawResponse: sanitizeRawResponse(raw),
  }
}

async function invokeOpenAiCompatibleImageGeneration(
  input: GenerationProviderRequest,
  apiKey: string,
  started: number,
  endpoint: string,
): Promise<GenerationProviderResponse> {
  if (is302NanoBananaWsEditEndpoint(endpoint)) {
    return invoke302NanoBananaWsEdit(input, apiKey, started, endpoint)
  }
  if (is302GeminiOriginalImageEndpoint(endpoint)) {
    return invoke302GeminiOriginalImageEdit(input, apiKey, started, endpoint)
  }
  const images = await Promise.all([input.vehicleImageUrl, ...input.partImageUrls].filter(Boolean).map(readImageSource))
  if (!images.length) throw new Error("没有可发送给生图 Provider 的车辆图片。")
  const imageReferences = images.map(imageDataUrl)
  const requestEndpoint = is302ImageEndpoint(endpoint) ? withQueryParams(canonical302Endpoint(endpoint), { response_format: "url" }) : endpoint
  const response = await fetch(requestEndpoint, {
    method: "POST",
    headers: providerRequestHeaders(apiKey, requestEndpoint, { "Content-Type": "application/json" }),
    body: JSON.stringify(
      imageGenerationPayload({
        modelName: input.provider.modelName,
        prompt: input.prompt,
        negativePrompt: input.negativePrompt,
        imageReferences,
        size: providerOutputImageSize(endpoint, images[0]),
        fast302: is302ImageEndpoint(endpoint),
      }),
    ),
  })
  const payload = await readProviderPayload(response)
  const raw = payload.raw
  if (!response.ok) {
    return providerError(
      input.provider,
      started,
      providerHttpErrorMessageForUi(raw, payload, response, endpoint),
      providerHttpErrorRaw(raw, payload, response, endpoint),
    )
  }

  const imageResult = findImageResult(raw)
  if (!imageResult) {
    return providerError(input.provider, started, "生图 Provider 已返回成功，但没有返回可识别的图片 URL 或 base64。", sanitizeRawResponse({ endpoint, response: raw }))
  }
  const resultImageUrl = await saveProviderImage(imageResult, input.provider.id)
  const usageUnits = estimateUsageUnits(raw)
  return {
    ok: true,
    provider: input.provider.id,
    resultImageUrl,
    latencyMs: Date.now() - started,
    usageUnits,
    costCents: estimateCostCents(input.provider.id, usageUnits),
    rawResponse: sanitizeRawResponse({ endpoint, response: raw }),
  }
}

async function invoke302GeminiOriginalImageEdit(
  input: GenerationProviderRequest,
  apiKey: string,
  started: number,
  endpoint: string,
): Promise<GenerationProviderResponse> {
  const images = await Promise.all([input.vehicleImageUrl, ...input.partImageUrls].filter(Boolean).map(readImageSource))
  if (!images.length) throw new Error("No image was available for Gemini image edit.")
  const requestEndpoint = withQueryParams(endpoint, { response_format: "url" })
  const response = await fetch(requestEndpoint, {
    method: "POST",
    headers: providerRequestHeaders(apiKey, requestEndpoint, { "Content-Type": "application/json" }),
    body: JSON.stringify(geminiOriginalImageEditPayload(input.prompt, input.negativePrompt, images)),
  })
  const payload = await readProviderPayload(response)
  const raw = payload.raw
  if (!response.ok) {
    return providerError(
      input.provider,
      started,
      providerHttpErrorMessageForUi(raw, payload, response, endpoint),
      providerHttpErrorRaw(raw, payload, response, endpoint),
    )
  }

  const imageResult = findImageResult(raw)
  if (!imageResult) {
    return providerError(input.provider, started, "Gemini image edit returned no recognizable image URL or base64 image.", sanitizeRawResponse({ endpoint, response: raw }))
  }
  const resultImageUrl = await saveProviderImage(imageResult, input.provider.id)
  const usageUnits = estimateUsageUnits(raw)
  return {
    ok: true,
    provider: input.provider.id,
    resultImageUrl,
    latencyMs: Date.now() - started,
    usageUnits,
    costCents: estimateCostCents(input.provider.id, usageUnits),
    rawResponse: sanitizeRawResponse({ endpoint, response: raw }),
  }
}

async function invoke302NanoBananaWsEdit(
  input: GenerationProviderRequest,
  apiKey: string,
  started: number,
  endpoint: string,
): Promise<GenerationProviderResponse> {
  const imageUrls = [input.vehicleImageUrl, ...input.partImageUrls].filter(Boolean).slice(0, MAX_NANO_BANANA_WS_INPUT_IMAGES)
  const images = await Promise.all(imageUrls.map(readImageSource))
  if (!images.length) throw new Error("No image was available for Nano-Banana-2 edit.")
  const prompt = nanoBananaSafePrompt(input.prompt)
  const body = JSON.stringify(nanoBananaWsEditPayload(prompt, "", images))
  const payloadBytes = Buffer.byteLength(body)
  const imageSummary = images.map((image, index) => `#${index + 1}:${image.mime}:${formatBytes(image.bytes.byteLength)}`).join(", ")
  let requestEndpoint = endpoint
  let response: Response | undefined
  let lastTransportError: unknown
  const transportFailures: string[] = []
  for (const candidateEndpoint of nanoBananaWsEndpointCandidates(endpoint)) {
    try {
      requestEndpoint = candidateEndpoint
      response = await fetch(requestEndpoint, {
        method: "POST",
        headers: providerRequestHeaders(apiKey, requestEndpoint, { "Content-Type": "application/json" }),
        body,
      })
      break
    } catch (error) {
      lastTransportError = error
      transportFailures.push(`${candidateEndpoint}: ${transportErrorSummary(error)}`)
    }
  }
  if (!response) {
    const details = [
      `payload=${formatBytes(payloadBytes)}`,
      `images=${images.length} [${imageSummary}]`,
      transportFailures.length ? `failures=${transportFailures.join(" | ")}` : "",
    ].filter(Boolean).join("; ")
    throw new Error(`Nano-Banana-2 request failed before HTTP response. ${details}`, { cause: lastTransportError })
  }
  const payload = await readProviderPayload(response)
  const raw = payload.raw
  if (!response.ok) {
    return providerError(
      input.provider,
      started,
      providerHttpErrorMessageForUi(raw, payload, response, requestEndpoint),
      providerHttpErrorRaw(raw, payload, response, requestEndpoint),
    )
  }

  let settled: Record<string, unknown>
  try {
    settled = await waitFor302NanoBananaResult(raw, apiKey, requestEndpoint)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return providerError(input.provider, started, message, sanitizeRawResponse({ endpoint: requestEndpoint, configuredEndpoint: endpoint, error: message, initialResponse: raw }))
  }
  const imageResult = findImageResult(settled)
  if (!imageResult) {
    return providerError(input.provider, started, "Nano-Banana-2 edit returned no recognizable image URL or base64 image.", sanitizeRawResponse({ endpoint: requestEndpoint, configuredEndpoint: endpoint, response: settled }))
  }
  const resultImageUrl = await saveProviderImage(imageResult, input.provider.id)
  const usageUnits = estimateUsageUnits(settled)
  return {
    ok: true,
    provider: input.provider.id,
    resultImageUrl,
    latencyMs: Date.now() - started,
    usageUnits,
    costCents: estimateCostCents(input.provider.id, usageUnits),
    rawResponse: sanitizeRawResponse({ endpoint: requestEndpoint, configuredEndpoint: endpoint, response: settled }),
  }
}

async function invokeOpenAiCompatibleChatImage(
  input: GenerationProviderRequest,
  apiKey: string,
  started: number,
  endpoint: string,
): Promise<GenerationProviderResponse> {
  const images = await Promise.all([input.vehicleImageUrl, ...input.partImageUrls].filter(Boolean).map(readImageSource))
  if (!images.length) throw new Error("没有可发送给生图 Provider 的车辆图片。")
  const prompt = [
    input.prompt,
    input.negativePrompt ? `Negative Prompt:\n${input.negativePrompt}` : "",
    "第一张图片是用户上传的原车图，其余图片是配件参考图。请输出最终改装效果图，不要只返回文字说明。",
  ]
    .filter(Boolean)
    .join("\n\n")
  const response = await fetch(endpoint, {
    method: "POST",
    headers: providerRequestHeaders(apiKey, endpoint, { "Content-Type": "application/json" }),
    body: JSON.stringify({
      model: input.provider.modelName,
      temperature: 0.2,
      stream: false,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            ...images.map((image) => ({
              type: "image_url",
              image_url: { url: imageDataUrl(image) },
            })),
          ],
        },
      ],
    }),
  })
  const payload = await readProviderPayload(response)
  const raw = payload.raw
  if (!response.ok) {
    return providerError(
      input.provider,
      started,
      providerHttpErrorMessageForUi(raw, payload, response, endpoint),
      providerHttpErrorRaw(raw, payload, response, endpoint),
    )
  }

  const imageResult = findImageResult(raw)
  if (!imageResult) {
    return providerError(input.provider, started, "生图 Provider 已返回成功，但没有返回可识别的图片 URL 或 base64。", sanitizeRawResponse({ endpoint, response: raw }))
  }
  const resultImageUrl = await saveProviderImage(imageResult, input.provider.id)
  const usageUnits = estimateUsageUnits(raw)
  return {
    ok: true,
    provider: input.provider.id,
    resultImageUrl,
    latencyMs: Date.now() - started,
    usageUnits,
    costCents: estimateCostCents(input.provider.id, usageUnits),
    rawResponse: sanitizeRawResponse({ endpoint, response: raw }),
  }
}

function mockResponse(input: GenerationProviderRequest, started: number): GenerationProviderResponse {
  const nonMockUnits = input.provider.id === "mock" ? 1 : 4
  return {
    ok: true,
    provider: input.provider.id,
    resultImageUrl: FIXED_MOCK_RESULT_URL,
    latencyMs: Date.now() - started,
    usageUnits: nonMockUnits,
    costCents: input.provider.id === "mock" ? 0 : 90,
    rawResponse: {
      provider: input.provider.id,
      model: input.provider.modelName,
      fixedDemoImage: FIXED_MOCK_RESULT_URL,
      retryAttempt: input.retryAttempt,
    },
  }
}

function providerError(
  provider: ProviderConfig,
  started: number,
  error: string,
  rawResponse: Record<string, unknown> = {},
): GenerationProviderResponse {
  const normalizedError = isProviderSafetyBlockMessage([error, rawResponse]) ? providerSafetyBlockMessage("en") : error
  return {
    ok: false,
    provider: provider.id,
    resultImageUrl: "",
    latencyMs: Date.now() - started,
    usageUnits: 0,
    costCents: 0,
    rawResponse: Object.keys(rawResponse).length ? rawResponse : { reason: normalizedError },
    error: normalizedError,
  }
}

function providerRequestHeaders(apiKey: string, endpoint: string, extra: Record<string, string> = {}) {
  const headers: Record<string, string> = {
    ...extra,
    Authorization: `Bearer ${apiKey}`,
  }
  if (is302ImageEndpoint(endpoint) || is302GeminiOriginalImageEndpoint(endpoint) || is302NanoBananaWsEditEndpoint(endpoint)) {
    headers.Connection = "close"
  }
  return headers
}

function generationEndpoint(baseUrl: string): { kind: "image_edit" | "image_generation" | "chat_completions"; url: string } {
  const normalized = (baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "")
  if (normalized.endsWith("/chat/completions")) return { kind: "chat_completions", url: normalized }
  if (normalized.endsWith("/images/generations")) return { kind: "image_generation", url: normalized }
  if (normalized.endsWith("/images/edits")) return { kind: "image_edit", url: normalized }
  if (is302GeminiOriginalImageEndpoint(normalized)) return { kind: "image_generation", url: normalized }
  if (is302NanoBananaWsEditEndpoint(normalized)) return { kind: "image_generation", url: normalized }
  return { kind: "image_edit", url: `${normalized}/images/edits` }
}

function is302GeminiOriginalImageEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint)
    const host = url.hostname.toLowerCase()
    return is302ApiHost(host) && url.pathname.includes("/google/v1/models/gemini-")
  } catch {
    return false
  }
}

function is302NanoBananaWsEditEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint)
    const host = url.hostname.toLowerCase()
    return is302ApiHost(host) && url.pathname.endsWith("/ws/api/v3/google/nano-banana-2/edit")
  } catch {
    return false
  }
}

function is302ImageEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint)
    const host = url.hostname.toLowerCase()
    return is302ApiHost(host) && (url.pathname.endsWith("/images/edits") || url.pathname.endsWith("/images/generations"))
  } catch {
    return false
  }
}

function is302ApiHost(host: string) {
  return host === "api.302.ai" || host === "api.302ai.cn" || host === "api.302ai.com"
}

function canonical302Endpoint(endpoint: string) {
  const url = new URL(endpoint)
  const host = url.hostname.toLowerCase()
  if (host === "api.302.ai" || host === "api.302ai.cn") {
    url.protocol = "https:"
    url.hostname = "api.302.ai"
  }
  return url.toString()
}

function nanoBananaWsEndpointCandidates(endpoint: string) {
  try {
    const url = new URL(endpoint)
    const host = url.hostname.toLowerCase()
    if (!url.pathname.endsWith("/ws/api/v3/google/nano-banana-2/edit")) return [endpoint]
    if (host !== "api.302ai.cn" && host !== "api.302ai.com" && host !== "api.302.ai") return [endpoint]
    const orderedHosts =
      host === "api.302ai.com"
        ? ["api.302ai.com", "api.302ai.cn"]
        : ["api.302ai.cn", "api.302ai.com"]
    return orderedHosts.map((hostname) => {
      const candidate = new URL(endpoint)
      candidate.protocol = "https:"
      candidate.hostname = hostname
      return candidate.toString()
    })
  } catch {
    return [endpoint]
  }
}

function withQueryParams(endpoint: string, params: Record<string, string>) {
  const url = new URL(endpoint)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return url.toString()
}

async function recover302TransportFailure(
  provider: ProviderConfig,
  apiKey: string,
  started: number,
  error: unknown,
): Promise<GenerationProviderResponse | null> {
  const endpoint = generationEndpoint(provider.baseUrl).url
  if (!is302ImageEndpoint(endpoint)) return null
  const deadline = Date.now() + 300_000
  let lastRaw: Record<string, unknown> | null = null
  while (Date.now() < deadline) {
    try {
      const raw = await fetch302LatestImageRecord(provider, apiKey, started)
      if (raw) {
        const imageResult = findImageResult(raw)
        if (!imageResult) return null
        const resultImageUrl = await saveProviderImage(imageResult, provider.id)
        const usageUnits = estimateUsageUnits(raw)
        return {
          ok: true,
          provider: provider.id,
          resultImageUrl,
          latencyMs: Date.now() - started,
          usageUnits,
          costCents: estimateCostCents(provider.id, usageUnits),
          rawResponse: sanitizeRawResponse({
            recoveredAfterTransportError: error instanceof Error ? error.message : String(error),
            endpoint,
            response: raw,
          }),
        }
      }
    } catch (recoverError) {
      lastRaw = {
        recoverError: recoverError instanceof Error ? recoverError.message : String(recoverError),
      }
      break
    }
    await delay(5000)
  }
  if (lastRaw) {
    Object.assign(lastRaw, { endpoint })
  }
  return null
}

async function fetch302LatestImageRecord(provider: ProviderConfig, apiKey: string, started: number) {
  const nowSeconds = Math.floor(Date.now() / 1000) + 60
  const startSeconds = Math.max(0, Math.floor((started - 60_000) / 1000))
  const url = `https://api.302.ai/dashboard/api-record?page=1&limit=20&start_time=${startSeconds}&end_time=${nowSeconds}`
  const response = await fetch(url, {
    method: "GET",
    headers: providerRequestHeaders(apiKey, url),
  })
  const payload = await readProviderPayload(response)
  if (!response.ok) return null
  const items = Array.isArray(payload.raw.items) ? payload.raw.items : Array.isArray(payload.raw.data) ? payload.raw.data : []
  for (const item of items) {
    const record = item && typeof item === "object" ? (item as Record<string, unknown>) : null
    if (!record || !apiRecordMatchesModel(record, provider.modelName)) continue
    const raw = apiRecordResponseRaw(record)
    if (!raw || !findImageResult(raw)) continue
    if (!apiRecordIsNearStart(record, raw, started)) continue
    return raw
  }
  return null
}

function apiRecordMatchesModel(record: Record<string, unknown>, modelName: string) {
  return [record.model, record.model_name, record.modelName].some((value) => String(value || "") === modelName)
}

function apiRecordResponseRaw(record: Record<string, unknown>): Record<string, unknown> | null {
  const response = record.resp || record.response
  if (response && typeof response === "object" && !Array.isArray(response)) return response as Record<string, unknown>
  if (typeof response === "string" && response.trim()) {
    try {
      const parsed = JSON.parse(response) as unknown
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed as Record<string, unknown>
    } catch {
      return null
    }
  }
  return null
}

function apiRecordIsNearStart(record: Record<string, unknown>, raw: Record<string, unknown>, started: number) {
  const createdMs = apiRecordTimeMs(record) || apiRecordTimeMs(raw)
  return !createdMs || createdMs >= started - 60_000
}

function apiRecordTimeMs(record: Record<string, unknown>) {
  for (const key of ["created", "created_at", "createdAt", "time", "timestamp"]) {
    const value = Number(record[key] || 0)
    if (Number.isFinite(value) && value > 0) return value > 10_000_000_000 ? value : value * 1000
  }
  return 0
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function imageGenerationPayload(input: { modelName: string; prompt: string; negativePrompt: string; imageReferences: string[]; size?: string; fast302?: boolean }) {
  const payload: Record<string, unknown> = {
    model: input.modelName,
    prompt: input.prompt,
    n: 1,
  }
  if (input.negativePrompt) payload.negative_prompt = input.negativePrompt
  if (input.imageReferences.length) payload.image = input.imageReferences.length === 1 ? input.imageReferences[0] : input.imageReferences
  if (input.modelName.startsWith("google/")) {
    payload.image_size = "1K"
  } else {
    payload.size = input.size || "1024x1024"
  }
  if (input.fast302) {
    Object.assign(payload, fast302ImageOptions())
  }
  return payload
}

function geminiOriginalImageEditPayload(prompt: string, negativePrompt: string, images: Array<{ bytes: Uint8Array; mime: string }>) {
  const text = [prompt, negativePrompt ? `Negative Prompt:\n${negativePrompt}` : ""].filter(Boolean).join("\n\n")
  return {
    contents: [
      {
        parts: [
          { text },
          ...images.map((image) => ({
            inlineData: {
              mimeType: image.mime,
              data: Buffer.from(image.bytes).toString("base64"),
            },
          })),
        ],
      },
    ],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
    },
  }
}

function nanoBananaWsEditPayload(prompt: string, negativePrompt: string, images: Array<{ bytes: Uint8Array; mime: string }>) {
  const text = [prompt, negativePrompt ? `Negative Prompt:\n${negativePrompt}` : ""].filter(Boolean).join("\n\n")
  const dimensions = imageDimensions(images[0].bytes)
  return {
    prompt: text,
    images: images.map(imageDataUrl),
    aspect_ratio: dimensions ? closestNanoBananaAspectRatio(dimensions) : "4:3",
    resolution: "0.5k",
    enable_sync_mode: true,
    enable_base64_output: false,
  }
}

function nanoBananaSafePrompt(prompt: string) {
  return prompt
    .replace(/裸露碳纤维/g, "可见碳纤维")
    .replace(/裸碳/g, "可见碳纤维")
    .replace(/裸露/g, "可见")
    .replace(/exposed carbon/gi, "visible carbon fiber")
    .replace(/bare carbon/gi, "visible carbon fiber")
    .split(/\r?\n/)
    .map((line) => sanitizeNanoBananaPromptLine(line))
    .filter((line) => line.trim())
    .join("\n")
}

function sanitizeNanoBananaPromptLine(line: string) {
  return line
    .replace(/[，,;；]?\s*不要人物/g, "")
    .replace(/[，,;；]?\s*不要人像/g, "")
    .replace(/[，,;；]?\s*不要真人/g, "")
    .replace(/[，,;；]?\s*不要行人/g, "")
    .replace(/[，,;；]\s*\u4e0d\u8981(\u4eba\u7269|\u4eba\u50cf|\u771f\u4eba|\u884c\u4eba|\u4eba\u8138|\u6b66\u5668|\u66b4\u529b|\u653f\u6cbb|\u88f8\u9732|\u8272\u60c5|\u8840\u8165|\u4ec7\u6068|\u654f\u611f)/g, "")
    .replace(NANO_BANANA_EN_SAFETY_TERMS, "")
    .replace(NANO_BANANA_CJK_SAFETY_TERMS, "")
}

function closestNanoBananaAspectRatio(dimensions: { width: number; height: number }) {
  const options = [
    ["1:1", 1],
    ["3:2", 3 / 2],
    ["2:3", 2 / 3],
    ["3:4", 3 / 4],
    ["4:3", 4 / 3],
    ["4:5", 4 / 5],
    ["5:4", 5 / 4],
    ["9:16", 9 / 16],
    ["16:9", 16 / 9],
    ["21:9", 21 / 9],
  ] as const
  const sourceAspect = dimensions.width / dimensions.height
  return options.reduce((best, current) => (Math.abs(current[1] - sourceAspect) < Math.abs(best[1] - sourceAspect) ? current : best))[0]
}

async function waitFor302NanoBananaResult(raw: Record<string, unknown>, apiKey: string, endpoint: string): Promise<Record<string, unknown>> {
  let current = raw
  let completedWithoutImagePolls = 0
  while (true) {
    const status = predictionStatus(current)
    if (findImageResult(current) && (!status || predictionCompleted(status))) return current
    if (predictionFailed(status)) throw new Error(predictionError(current) || `Nano-Banana-2 task failed with status: ${status}`)
    if (predictionCompleted(status)) {
      completedWithoutImagePolls += 1
      if (completedWithoutImagePolls >= 3) {
        throw new Error("Nano-Banana-2 task completed but did not return a recognizable image URL.")
      }
    } else {
      completedWithoutImagePolls = 0
    }

    const resultUrl = predictionResultUrl(current, endpoint)
    if (!resultUrl) return current
    await delay(NANO_BANANA_WS_POLL_INTERVAL_MS)
    const response = await fetch(resultUrl, {
      method: "GET",
      headers: providerRequestHeaders(apiKey, resultUrl),
    })
    const payload = await readProviderPayload(response)
    if (!response.ok) {
      throw new Error(providerHttpErrorMessageForUi(payload.raw, payload, response, resultUrl))
    }
    current = payload.raw
  }
}

function predictionData(raw: Record<string, unknown>) {
  return raw.data && typeof raw.data === "object" && !Array.isArray(raw.data) ? (raw.data as Record<string, unknown>) : raw
}

function predictionStatus(raw: Record<string, unknown>) {
  return String(predictionData(raw).status || "").toLowerCase()
}

function predictionCompleted(status: string) {
  return ["completed", "succeeded", "success"].includes(status)
}

function predictionFailed(status: string) {
  return ["failed", "error", "canceled", "cancelled"].includes(status)
}

function predictionError(raw: Record<string, unknown>) {
  const data = predictionData(raw)
  const value = data.error
  if (typeof value === "string") return value
  if (value && typeof value === "object" && "message" in value) return String((value as { message?: unknown }).message ?? "")
  return providerErrorMessage(data)
}

function predictionResultUrl(raw: Record<string, unknown>, endpoint: string) {
  const data = predictionData(raw)
  const urls = data.urls && typeof data.urls === "object" ? (data.urls as Record<string, unknown>) : {}
  if (typeof urls.get === "string" && urls.get) return urls.get
  const id = typeof data.id === "string" ? data.id : ""
  if (!id) return ""
  const url = new URL(endpoint)
  url.pathname = `/ws/api/v3/predictions/${id}/result`
  url.search = ""
  return url.toString()
}

function append302FastImageOptions(formData: FormData) {
  for (const [key, value] of Object.entries(fast302ImageOptions())) {
    formData.append(key, String(value))
  }
}

function fast302ImageOptions() {
  return {
    quality: "low",
    background: "opaque",
    output_format: "webp",
    output_compression: 85,
  }
}

function providerOutputImageSize(endpoint: string, vehicleImage?: { bytes: Uint8Array }) {
  if (!is302ImageEndpoint(endpoint) || !vehicleImage) return "1024x1024"
  const dimensions = imageDimensions(vehicleImage.bytes)
  return dimensions ? supported302ImageSize(dimensions) : "1024x1024"
}

function supported302ImageSize(dimensions: { width: number; height: number }) {
  const aspect = dimensions.width / dimensions.height
  if (aspect > 1.1) return "1536x1024"
  if (aspect < 0.9) return "1024x1536"
  return "1024x1024"
}

function imageDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  return pngDimensions(bytes) || jpegDimensions(bytes) || webpDimensions(bytes)
}

function pngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (
    bytes.length < 24 ||
    bytes[0] !== 0x89 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x4e ||
    bytes[3] !== 0x47 ||
    bytes[4] !== 0x0d ||
    bytes[5] !== 0x0a ||
    bytes[6] !== 0x1a ||
    bytes[7] !== 0x0a
  ) {
    return null
  }
  return validDimensions(readUInt32BE(bytes, 16), readUInt32BE(bytes, 20))
}

function jpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null
  let offset = 2
  while (offset < bytes.length) {
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1
    const marker = bytes[offset]
    offset += 1
    if (marker === 0xd9 || marker === 0xda) break
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue
    if (offset + 2 > bytes.length) break
    const segmentLength = readUInt16BE(bytes, offset)
    if (segmentLength < 2 || offset + segmentLength > bytes.length) break
    if (isJpegStartOfFrame(marker) && segmentLength >= 7) {
      return validDimensions(readUInt16BE(bytes, offset + 5), readUInt16BE(bytes, offset + 3))
    }
    offset += segmentLength
  }
  return null
}

function webpDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  if (bytes.length < 30 || ascii(bytes, 0, 4) !== "RIFF" || ascii(bytes, 8, 4) !== "WEBP") return null
  let offset = 12
  while (offset + 8 <= bytes.length) {
    const chunkType = ascii(bytes, offset, 4)
    const chunkSize = readUInt32LE(bytes, offset + 4)
    const dataOffset = offset + 8
    if (dataOffset + chunkSize > bytes.length) break
    if (chunkType === "VP8X" && chunkSize >= 10) {
      return validDimensions(readUInt24LE(bytes, dataOffset + 4) + 1, readUInt24LE(bytes, dataOffset + 7) + 1)
    }
    if (chunkType === "VP8L" && chunkSize >= 5 && bytes[dataOffset] === 0x2f) {
      const bits = readUInt32LE(bytes, dataOffset + 1)
      return validDimensions((bits & 0x3fff) + 1, ((bits >> 14) & 0x3fff) + 1)
    }
    if (
      chunkType === "VP8 " &&
      chunkSize >= 10 &&
      bytes[dataOffset + 3] === 0x9d &&
      bytes[dataOffset + 4] === 0x01 &&
      bytes[dataOffset + 5] === 0x2a
    ) {
      return validDimensions(readUInt16LE(bytes, dataOffset + 6) & 0x3fff, readUInt16LE(bytes, dataOffset + 8) & 0x3fff)
    }
    offset = dataOffset + chunkSize + (chunkSize % 2)
  }
  return null
}

function isJpegStartOfFrame(marker: number) {
  return (
    (marker >= 0xc0 && marker <= 0xc3) ||
    (marker >= 0xc5 && marker <= 0xc7) ||
    (marker >= 0xc9 && marker <= 0xcb) ||
    (marker >= 0xcd && marker <= 0xcf)
  )
}

function validDimensions(width: number, height: number) {
  return Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0 ? { width, height } : null
}

function readUInt16BE(bytes: Uint8Array, offset: number) {
  return (bytes[offset] << 8) | bytes[offset + 1]
}

function readUInt16LE(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8)
}

function readUInt24LE(bytes: Uint8Array, offset: number) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16)
}

function readUInt32BE(bytes: Uint8Array, offset: number) {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0
}

function readUInt32LE(bytes: Uint8Array, offset: number) {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0
}

function ascii(bytes: Uint8Array, offset: number, length: number) {
  return String.fromCharCode(...bytes.slice(offset, offset + length))
}

function supportsInputFidelity(modelName: string) {
  const normalized = modelName.toLowerCase()
  return normalized.includes("gpt-image-1") || normalized.includes("gpt-image-1.5") || normalized.includes("gpt-image-2")
}

function providerTransportErrorMessage(provider: ProviderConfig, error: unknown) {
  const endpoint = effectiveTransportEndpoint(provider)
  const message = error instanceof Error ? error.message : "Image provider transport failed."
  const cause = transportCause(error)
  const detail = cause ? `${message}; cause: ${cause}` : message
  return `Image provider request failed before HTTP response: ${detail}. Provider: ${provider.label || provider.id}; model: ${provider.modelName}; endpoint: ${endpoint}.`
}

function providerTransportErrorRaw(provider: ProviderConfig, error: unknown) {
  return sanitizeRawResponse({
    provider: provider.id,
    label: provider.label,
    model: provider.modelName,
    endpoint: effectiveTransportEndpoint(provider),
    configuredEndpoint: generationEndpoint(provider.baseUrl).url,
    error: error instanceof Error ? error.message : String(error),
    cause: transportCause(error),
  })
}

function effectiveTransportEndpoint(provider: ProviderConfig) {
  const endpoint = generationEndpoint(provider.baseUrl).url
  try {
    if (is302NanoBananaWsEditEndpoint(endpoint)) {
      return nanoBananaWsEndpointCandidates(endpoint).join(" -> ")
    }
    if (is302ImageEndpoint(endpoint) || is302GeminiOriginalImageEndpoint(endpoint)) {
      return canonical302Endpoint(endpoint)
    }
  } catch {
    return endpoint
  }
  return endpoint
}

function transportCause(error: unknown) {
  const cause = error && typeof error === "object" && "cause" in error ? (error as { cause?: unknown }).cause : undefined
  if (!cause) return ""
  if (typeof cause === "string") return cause
  if (cause instanceof AggregateError) return aggregateErrorSummary(cause)
  if (cause instanceof Error) return [cause.name, cause.message].filter(Boolean).join(": ")
  if (typeof cause === "object") {
    const record = cause as Record<string, unknown>
    return [record.code, record.errno, record.message].filter(Boolean).map(String).join(" ")
  }
  return String(cause)
}

function transportErrorSummary(error: unknown): string {
  if (error instanceof AggregateError) return aggregateErrorSummary(error)
  if (error instanceof Error) {
    const cause = transportCause(error)
    return [error.message, cause ? `cause=${cause}` : ""].filter(Boolean).join("; ")
  }
  return String(error)
}

function aggregateErrorSummary(error: AggregateError) {
  const items = Array.from(error.errors ?? []).map((item) => {
    if (item instanceof Error) {
      const record = item as Error & { code?: string; errno?: string; address?: string; port?: number }
      return [record.code, record.errno, record.address, record.port, item.message].filter(Boolean).map(String).join(" ")
    }
    if (item && typeof item === "object") {
      const record = item as Record<string, unknown>
      return [record.code, record.errno, record.address, record.port, record.message].filter(Boolean).map(String).join(" ")
    }
    return String(item)
  }).filter(Boolean)
  return [`AggregateError`, ...items].join(" | ")
}

async function readProviderPayload(response: Response) {
  const text = await response.text()
  if (!text.trim()) return { raw: {} as Record<string, unknown>, text: "" }
  try {
    const parsed = JSON.parse(text) as unknown
    return {
      raw: parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : { value: parsed },
      text,
    }
  } catch {
    return { raw: { body: textSnippet(text) }, text }
  }
}

function providerHttpErrorMessage(raw: Record<string, unknown>, payload: { text: string }, response: Response, endpoint: string) {
  const detail = providerErrorMessage(raw) || textSnippet(payload.text) || response.statusText
  const suffix = detail ? ` - ${detail}` : ""
  const endpointHint =
    response.status === 404
      ? `。请求端点：${endpoint}。请检查后台 Base URL 是否填错；chat/completions 端点要完整填写，图片编辑接口可填写 /v1 或 /v1/images/edits。`
      : `。请求端点：${endpoint}`
  return `生图 Provider 调用失败：HTTP ${response.status}${suffix}${endpointHint}`
}

function providerHttpErrorRaw(raw: Record<string, unknown>, payload: { text: string }, response: Response, endpoint: string) {
  return sanitizeRawResponse({
    endpoint,
    httpStatus: response.status,
    statusText: response.statusText,
    response: Object.keys(raw).length ? raw : { body: textSnippet(payload.text) },
  })
}

function providerHttpErrorMessageForUi(raw: Record<string, unknown>, payload: { text: string }, response: Response, endpoint: string) {
  const detail = providerErrorMessage(raw) || textSnippet(payload.text) || response.statusText
  if (isProviderSafetyBlockMessage([detail, payload.text, raw])) return providerSafetyBlockMessage("en")
  if (response.status >= 500) {
    const statusText = response.statusText && response.statusText !== String(response.status) ? ` ${response.statusText}` : ""
    return `外部生图服务临时不可用（HTTP ${response.status}${statusText}）。这通常是上游网关或模型服务短暂失败，不代表当前改装提示词解析失败。请稍后重试。Endpoint: ${endpoint}.`
  }
  const suffix = detail ? ` - ${detail}` : ""
  const endpointHint = httpEndpointHint(response.status, endpoint)
  return `Image provider request failed: HTTP ${response.status}${suffix}.${endpointHint}`
}

function httpEndpointHint(status: number, endpoint: string) {
  if (status !== 404) return ` Endpoint: ${endpoint}.`
  try {
    const url = new URL(endpoint)
    if (url.hostname.includes("shengsuanyun")) {
      return ` Endpoint: ${endpoint}. Check the configured Base URL; Shengsuanyun image generation should use /api/v1/images/generations.`
    }
    if (is302ApiHost(url.hostname.toLowerCase()) && url.pathname.includes("/302/v2/image/fetch/")) {
      return ` Endpoint: ${endpoint}. 302 async task was not found by the fetch endpoint.`
    }
  } catch {
    return ` Endpoint: ${endpoint}.`
  }
  return ` Endpoint: ${endpoint}. Check the configured provider Base URL and model support.`
}

function textSnippet(value: string, limit = 500) {
  return value.replace(/\s+/g, " ").trim().slice(0, limit)
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0B"
  if (value < 1024) return `${Math.round(value)}B`
  const mb = value / 1024 / 1024
  if (mb >= 1) return `${mb.toFixed(mb >= 10 ? 1 : 2)}MB`
  return `${(value / 1024).toFixed(1)}KB`
}

async function readImageSource(url: string) {
  if (/^https?:\/\//i.test(url)) {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`参考图下载失败：${url}，HTTP ${response.status}`)
    const mime = response.headers.get("content-type")?.split(";")[0] || mimeFromPath(url)
    return {
      bytes: new Uint8Array(await response.arrayBuffer()),
      mime,
      fileName: fileNameFromPath(url, mime),
    }
  }
  if (url.startsWith("data:")) {
    const match = url.match(/^data:([^;]+);base64,(.+)$/)
    if (!match) throw new Error("图片 data URL 格式不正确。")
    return {
      bytes: new Uint8Array(Buffer.from(match[2], "base64")),
      mime: match[1],
      fileName: `input-${Date.now()}.${extensionFromMime(match[1])}`,
    }
  }
  const cleanUrl = decodeURIComponent(url.split("?")[0].replace(/^\/+/, ""))
  const absolutePath = path.resolve(process.cwd(), "public", cleanUrl)
  const publicRoot = path.resolve(process.cwd(), "public")
  if (!absolutePath.startsWith(publicRoot)) throw new Error(`图片路径不在 public 目录内：${url}`)
  const bytes = await readFile(absolutePath)
  return {
    bytes: new Uint8Array(bytes),
    mime: mimeFromPath(absolutePath),
    fileName: path.basename(absolutePath),
  }
}

function imageDataUrl(image: { bytes: Uint8Array; mime: string }) {
  return `data:${image.mime};base64,${Buffer.from(image.bytes).toString("base64")}`
}

function findImageResult(raw: Record<string, unknown>): { url?: string; b64Json?: string; mime?: string } | null {
  const data = Array.isArray(raw.data) ? raw.data : []
  for (const item of data) {
    if (!item || typeof item !== "object") continue
    const value = item as { url?: unknown; b64_json?: unknown }
    if (typeof value.url === "string" && value.url) return { url: value.url }
    if (typeof value.b64_json === "string" && value.b64_json) return { b64Json: value.b64_json }
  }
  const output = Array.isArray(raw.output) ? raw.output : []
  for (const item of output) {
    const result = findImageResultInValue(item)
    if (result) return result
  }
  return findImageResultInValue(raw)
}

function findImageResultInValue(value: unknown): { url?: string; b64Json?: string; mime?: string } | null {
  if (typeof value === "string") return findImageResultInText(value)
  if (!value || typeof value !== "object") return null
  const record = value as Record<string, unknown>
  if (typeof record.url === "string" && record.url) return { url: record.url }
  if (typeof record.b64_json === "string" && record.b64_json) return { b64Json: record.b64_json }
  if (typeof record.image_url === "string" && record.image_url) return { url: record.image_url }
  if (record.image_url && typeof record.image_url === "object") {
    const nested = record.image_url as Record<string, unknown>
    if (typeof nested.url === "string" && nested.url) return { url: nested.url }
  }
  const inlineData = record.inlineData || record.inline_data
  if (inlineData && typeof inlineData === "object") {
    const image = inlineData as Record<string, unknown>
    if (typeof image.data === "string" && image.data) {
      return { b64Json: image.data, mime: typeof image.mimeType === "string" ? image.mimeType : typeof image.mime_type === "string" ? image.mime_type : undefined }
    }
  }
  const fileData = record.fileData || record.file_data
  if (fileData && typeof fileData === "object") {
    const image = fileData as Record<string, unknown>
    if (typeof image.fileUri === "string" && image.fileUri) return { url: image.fileUri }
    if (typeof image.file_uri === "string" && image.file_uri) return { url: image.file_uri }
  }
  for (const child of Object.values(record)) {
    if (Array.isArray(child)) {
      for (const item of child) {
        const result = findImageResultInValue(item)
        if (result) return result
      }
    } else {
      const result = findImageResultInValue(child)
      if (result) return result
    }
  }
  return null
}

function findImageResultInText(value: string): { url?: string; b64Json?: string; mime?: string } | null {
  const dataUrl = value.match(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/)
  if (dataUrl?.[0]) return { url: dataUrl[0] }
  const b64Json = value.match(/"b64_json"\s*:\s*"([^"]+)"/)
  if (b64Json?.[1]) return { b64Json: b64Json[1] }
  const imageUrl = value.match(/https?:\/\/[^\s)"']+\.(?:png|jpe?g|webp)(?:\?[^\s)"']*)?/i)
  if (imageUrl?.[0]) return { url: imageUrl[0] }
  return null
}

async function saveProviderImage(image: { url?: string; b64Json?: string; mime?: string }, providerId: ProviderId) {
  let bytes: Uint8Array
  let mime = image.mime || "image/png"
  if (image.b64Json) {
    bytes = new Uint8Array(Buffer.from(image.b64Json, "base64"))
  } else if (image.url?.startsWith("data:")) {
    const parsed = await readImageSource(image.url)
    bytes = parsed.bytes
    mime = parsed.mime
  } else if (image.url) {
    const response = await fetch(image.url)
    if (!response.ok) throw new Error(`下载生图结果失败：HTTP ${response.status}`)
    mime = response.headers.get("content-type")?.split(";")[0] || mimeFromPath(image.url)
    bytes = new Uint8Array(await response.arrayBuffer())
  } else {
    throw new Error("生图 Provider 返回的图片结果为空。")
  }
  const resultDir = path.join(process.cwd(), "public", "results")
  await mkdir(resultDir, { recursive: true })
  const fileName = `${providerId}-${Date.now()}-${Math.random().toString(16).slice(2)}.${extensionFromMime(mime)}`
  await writeFile(path.join(resultDir, fileName), bytes)
  return `/results/${fileName}`
}

function providerErrorMessage(raw: Record<string, unknown>) {
  const error = raw.error
  if (typeof error === "string") return error
  if (error && typeof error === "object" && "message" in error) return String((error as { message?: unknown }).message ?? "")
  return ""
}

function safetyCheckText(value: unknown): string {
  if (!value) return ""
  if (typeof value === "string") return value
  if (value instanceof Error) return value.message
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function sanitizeRawResponse(value: unknown): Record<string, unknown> {
  return sanitizeValue(value) as Record<string, unknown>
}

function sanitizeValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeValue)
  if (!value || typeof value !== "object") return value
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, child]) => [
      key,
      key === "b64_json" || key.toLowerCase().includes("base64") ? "[base64 omitted]" : sanitizeValue(child),
    ]),
  )
}

function estimateUsageUnits(raw: Record<string, unknown>) {
  const usage = raw.usage as { total_tokens?: unknown } | undefined
  const usageMetadata = raw.usageMetadata as { totalTokenCount?: unknown } | undefined
  const tokens = Number(usage?.total_tokens || usageMetadata?.totalTokenCount || 0)
  return tokens > 0 ? Math.max(4, Math.ceil(tokens / 1000)) : 4
}

function estimateCostCents(providerId: ProviderId, usageUnits: number) {
  return providerId === "mock" ? 0 : Math.max(90, usageUnits * 25)
}

function mimeFromPath(value: string) {
  const ext = path.extname(value.split("?")[0]).toLowerCase()
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg"
  if (ext === ".webp") return "image/webp"
  if (ext === ".svg") return "image/svg+xml"
  return "image/png"
}

function extensionFromMime(mime: string) {
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg"
  if (mime.includes("webp")) return "webp"
  if (mime.includes("svg")) return "svg"
  return "png"
}

function fileNameFromPath(value: string, mime: string) {
  const name = path.basename(value.split("?")[0])
  return name && name.includes(".") ? name : `input-${Date.now()}.${extensionFromMime(mime)}`
}
