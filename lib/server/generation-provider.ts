import { setDefaultResultOrder } from "node:dns"
import { getProviderApiKey } from "./db"
import { readImageAsset } from "./image-assets"
import { isPersistentLocalImageUrl, materializeImageUrl } from "./image-materializer"
import { mimeFromImageBytes, mimeFromPath, readLocalImageByAppUrl, writeResultImage, writeVehicleUploadImage } from "./local-images"
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
const NANO_BANANA_WS_POLL_REQUEST_TIMEOUT_MS = 30_000
const YUNWU_FAL_POLL_INTERVAL_MS = 3000
const YUNWU_FAL_POLL_TIMEOUT_MS = 180_000
const MAX_NANO_BANANA_WS_INPUT_IMAGES = 14
const MAX_PROVIDER_RESULT_IMAGE_BYTES = 20 * 1024 * 1024
type NanoBananaProviderInputImage = Awaited<ReturnType<typeof readImageSource>> & {
  providerUrl: string
  localUrl: string
}
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
  } else if (isYunwuImageEndpoint(endpoint)) {
    appendYunwuImageEditOptions(formData)
  } else if (!isYunwuImageEndpoint(endpoint) && supportsInputFidelity(input.provider.modelName)) {
    formData.append("input_fidelity", "high")
  }

  const images = await Promise.all([input.vehicleImageUrl, ...input.partImageUrls].filter(Boolean).map(readImageSource))
  if (!images.length) throw new Error("没有可发送给生图 Provider 的车辆图片。")
  formData.set("size", providerOutputImageSize(endpoint, images[0]))
  images.forEach((image) => {
    formData.append("image", new Blob([image.bytes], { type: image.mime }), image.fileName)
  })

  const requestEndpoint = is302ImageEndpoint(endpoint) ? withQueryParams(canonical302Endpoint(endpoint), responseFormatParamsFor302Images()) : endpoint
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
    const recovered = await recover302EmptyImageSuccess(input.provider, apiKey, started, endpoint, raw)
    if (recovered) return recovered
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
  if (isYunwuFalNanoBananaEditEndpoint(endpoint)) {
    return invokeYunwuFalNanoBananaEdit(input, apiKey, started, endpoint)
  }
  if (is302GeminiOriginalImageEndpoint(endpoint)) {
    return invoke302GeminiOriginalImageEdit(input, apiKey, started, endpoint)
  }
  const images = await Promise.all([input.vehicleImageUrl, ...input.partImageUrls].filter(Boolean).map(readImageSource))
  if (!images.length) throw new Error("没有可发送给生图 Provider 的车辆图片。")
  const imageReferences = images.map(imageDataUrl)
  const requestEndpoint = is302ImageEndpoint(endpoint) ? withQueryParams(canonical302Endpoint(endpoint), responseFormatParamsFor302Images()) : endpoint
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
    const recovered = await recover302EmptyImageSuccess(input.provider, apiKey, started, endpoint, raw)
    if (recovered) return recovered
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
  const images = await nanoBananaProviderInputImages(imageUrls, input.provider.id)
  if (!images.length) throw new Error("No image was available for Nano-Banana-2 edit.")
  const prompt = nanoBananaSafePrompt(input.prompt)
  const requestPayload = nanoBananaWsEditPayload(prompt, "", images)
  const body = JSON.stringify(requestPayload)
  const payloadBytes = Buffer.byteLength(body)
  const imageSummary = images.map((image, index) => `#${index + 1}:${image.mime}:${formatBytes(image.bytes.byteLength)}`).join(", ")
  const requestShape = nanoBananaRequestShape(images, requestPayload, payloadBytes)
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
      "alternate-host-retry=disabled-to-avoid-duplicate-billing",
    ].filter(Boolean).join("; ")
    throw new Error(`Nano-Banana-2 request failed before HTTP response. ${details}`, { cause: lastTransportError })
  }
  const payload = await readProviderPayload(response)
  const raw = payload.raw
  if (!response.ok) {
    log302NanoSubmitFailure(input.provider.id, requestEndpoint, response, requestShape, raw)
    return providerError(
      input.provider,
      started,
      providerHttpErrorMessageForUi(raw, payload, response, requestEndpoint),
      providerHttpErrorRaw({ response: raw, requestShape }, payload, response, requestEndpoint),
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

async function invokeYunwuFalNanoBananaEdit(
  input: GenerationProviderRequest,
  apiKey: string,
  started: number,
  endpoint: string,
): Promise<GenerationProviderResponse> {
  const imageUrls = [input.vehicleImageUrl, ...input.partImageUrls].filter(Boolean).slice(0, MAX_NANO_BANANA_WS_INPUT_IMAGES)
  const images = await nanoBananaProviderInputImages(imageUrls, input.provider.id)
  if (!images.length) throw new Error("No image was available for Yunwu Nano Banana edit.")
  const requestPayload = yunwuFalNanoBananaPayload(nanoBananaSafePrompt(input.prompt), input.negativePrompt, images)
  const response = await fetch(endpoint, {
    method: "POST",
    headers: providerRequestHeaders(apiKey, endpoint, { "Content-Type": "application/json" }),
    body: JSON.stringify(requestPayload),
  })
  const payload = await readProviderPayload(response)
  const raw = payload.raw
  if (!response.ok) {
    return providerError(
      input.provider,
      started,
      providerHttpErrorMessageForUi(raw, payload, response, endpoint),
      providerHttpErrorRaw({ response: raw, requestShape: yunwuFalNanoBananaRequestShape(images, requestPayload) }, payload, response, endpoint),
    )
  }

  let settled: Record<string, unknown>
  try {
    settled = await waitForYunwuFalResult(raw, apiKey, endpoint)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return providerError(input.provider, started, message, sanitizeRawResponse({ endpoint, error: message, initialResponse: raw }))
  }
  const imageResult = findImageResult(settled)
  if (!imageResult) {
    return providerError(input.provider, started, "Yunwu Nano Banana edit returned no recognizable image URL or base64 image.", sanitizeRawResponse({ endpoint, response: settled }))
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
    rawResponse: sanitizeRawResponse({ endpoint, response: settled }),
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
    const recovered = await recover302EmptyImageSuccess(input.provider, apiKey, started, endpoint, raw)
    if (recovered) return recovered
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
  if (isYunwuFalNanoBananaEditEndpoint(normalized)) return { kind: "image_generation", url: normalized }
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

function isYunwuImageEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint)
    return url.hostname.toLowerCase() === "yunwu.ai" && (url.pathname.endsWith("/v1/images/edits") || url.pathname.endsWith("/v1/images/generations"))
  } catch {
    return false
  }
}

function isYunwuFalNanoBananaEditEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint)
    return url.hostname.toLowerCase() === "yunwu.ai" && url.pathname.endsWith("/fal-ai/nano-banana/edit")
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
  if (host === "api.302.ai") {
    url.protocol = "https:"
    url.hostname = "api.302ai.cn"
  } else if (host === "api.302ai.cn" || host === "api.302ai.com") {
    url.protocol = "https:"
  }
  return url.toString()
}

function nanoBananaWsEndpointCandidates(endpoint: string) {
  try {
    const url = new URL(endpoint)
    const host = url.hostname.toLowerCase()
    if (!url.pathname.endsWith("/ws/api/v3/google/nano-banana-2/edit")) return [endpoint]
    if (host !== "api.302ai.cn" && host !== "api.302ai.com" && host !== "api.302.ai") return [endpoint]
    const candidate = new URL(endpoint)
    candidate.protocol = "https:"
    candidate.hostname = nanoBanana302SubmitHost(host)
    return [candidate.toString()]
  } catch {
    return [endpoint]
  }
}

function nanoBanana302SubmitHost(_configuredHost: string) {
  const override = normalize302ApiHost(process.env.NANO_BANANA_302_SUBMIT_HOST || "")
  if (override) return override
  return "api.302.ai"
}

function normalize302ApiHost(value: string) {
  const host = value.trim().toLowerCase().replace(/^https?:\/\//, "").split("/")[0]
  return is302ApiHost(host) ? host : ""
}

function withQueryParams(endpoint: string, params: Record<string, string>) {
  const url = new URL(endpoint)
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value)
  }
  return url.toString()
}

function responseFormatParamsFor302Images() {
  return { response_format: "b64_json" }
}

async function recover302TransportFailure(
  provider: ProviderConfig,
  apiKey: string,
  started: number,
  error: unknown,
): Promise<GenerationProviderResponse | null> {
  const endpoint = generationEndpoint(provider.baseUrl).url
  if (!is302ImageEndpoint(endpoint)) return null
  return recover302ImageRecord(provider, apiKey, started, endpoint, {
    recoveredAfterTransportError: error instanceof Error ? error.message : String(error),
  })
}

async function recover302EmptyImageSuccess(
  provider: ProviderConfig,
  apiKey: string,
  started: number,
  endpoint: string,
  raw: Record<string, unknown>,
): Promise<GenerationProviderResponse | null> {
  if (!is302ImageEndpoint(endpoint)) return null
  return recover302ImageRecord(provider, apiKey, started, endpoint, {
    recoveredAfterEmptyProviderResponse: true,
    providerResponse: raw,
  })
}

async function recover302ImageRecord(
  provider: ProviderConfig,
  apiKey: string,
  started: number,
  endpoint: string,
  context: Record<string, unknown>,
): Promise<GenerationProviderResponse | null> {
  const deadline = Date.now() + 300_000
  let lastRaw: Record<string, unknown> | null = null
  while (Date.now() < deadline) {
    try {
      const raw = await fetch302LatestImageRecord(provider, apiKey, started, endpoint)
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
            ...context,
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

async function fetch302LatestImageRecord(provider: ProviderConfig, apiKey: string, started: number, endpoint: string) {
  const nowSeconds = Math.floor(Date.now() / 1000) + 60
  const startSeconds = Math.max(0, Math.floor((started - 60_000) / 1000))
  const dashboardUrl = new URL(canonical302Endpoint(endpoint))
  dashboardUrl.pathname = "/dashboard/api-record"
  dashboardUrl.search = `?page=1&limit=20&start_time=${startSeconds}&end_time=${nowSeconds}`
  const url = dashboardUrl.toString()
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
  if (!modelName.trim()) return true
  const modelValues = [
    record.model,
    record.model_name,
    record.modelName,
    record.model_id,
    record.modelId,
    record.model_slug,
    record.modelSlug,
  ]
  if (modelValues.some((value) => String(value || "") === modelName)) return true
  return modelValues.some((value) => String(value || "").includes(modelName))
}

function apiRecordResponseRaw(record: Record<string, unknown>): Record<string, unknown> | null {
  const candidateKeys = [
    "resp",
    "response",
    "response_body",
    "responseBody",
    "resp_body",
    "respBody",
    "raw_response",
    "rawResponse",
    "result",
    "results",
    "output",
    "outputs",
    "image",
    "images",
    "body",
    "content",
    "answer",
    "data",
  ]
  for (const key of candidateKeys) {
    const raw = rawResponseRecordFromValue(record[key])
    if (raw && findImageResult(raw)) return raw
  }
  return null
}

function rawResponseRecordFromValue(value: unknown): Record<string, unknown> | null {
  if (!value) return null
  if (Array.isArray(value)) return { data: value }
  if (typeof value === "object") return value as Record<string, unknown>
  if (typeof value !== "string" || !value.trim()) return null
  const trimmed = value.trim()
  try {
    const parsed = JSON.parse(trimmed) as unknown
    if (Array.isArray(parsed)) return { data: parsed }
    if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>
  } catch {
    // Some 302 dashboard fields store a text blob instead of JSON.
  }
  return findImageResultInText(trimmed) ? { output: [trimmed] } : null
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

async function fetchWithTimeout(input: string, init: RequestInit, timeoutMs: number) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`request timed out after ${Math.round(timeoutMs / 1000)}s`, { cause: error })
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
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

function nanoBananaWsEditPayload(prompt: string, negativePrompt: string, images: NanoBananaProviderInputImage[]) {
  const text = [prompt, negativePrompt ? `Negative Prompt:\n${negativePrompt}` : ""].filter(Boolean).join("\n\n")
  const dimensions = imageDimensions(images[0].bytes)
  return {
    prompt: text,
    images: images.map((image) => image.providerUrl),
    aspect_ratio: dimensions ? closestNanoBananaAspectRatio(dimensions) : "4:3",
    resolution: nanoBanana302Resolution(),
    enable_sync_mode: nanoBanana302SyncMode(),
    enable_base64_output: false,
  }
}

function yunwuFalNanoBananaPayload(prompt: string, negativePrompt: string, images: NanoBananaProviderInputImage[]) {
  const text = [prompt, negativePrompt ? `Negative Prompt:\n${negativePrompt}` : ""].filter(Boolean).join("\n\n")
  return {
    prompt: text,
    image_urls: images.map((image) => image.providerUrl),
    num_images: 1,
    output_format: yunwuNanoOutputFormat(),
  }
}

function nanoBanana302SyncMode() {
  return process.env.NANO_BANANA_302_SYNC_MODE === "1"
}

function nanoBanana302Resolution() {
  const value = String(process.env.NANO_BANANA_302_RESOLUTION || "0.5k").trim().toLowerCase()
  if (value === "0.5k" || value === "1k" || value === "2k" || value === "4k") return value
  return "0.5k"
}

async function nanoBananaProviderInputImages(urls: string[], providerId: ProviderId): Promise<NanoBananaProviderInputImage[]> {
  const publicBaseUrl = providerInputPublicBaseUrl()
  if (!publicBaseUrl) {
    throw new Error(
      "Nano-Banana image edit requires publicly reachable image URLs. Set PROVIDER_PUBLIC_BASE_URL, NEXT_PUBLIC_APP_URL, APP_URL, or SITE_URL to the test-server origin before using the real provider.",
    )
  }
  return Promise.all(urls.map((url, index) => nanoBananaProviderInputImage(url, providerId, index, publicBaseUrl)))
}

async function nanoBananaProviderInputImage(
  url: string,
  providerId: ProviderId,
  index: number,
  publicBaseUrl: string,
): Promise<NanoBananaProviderInputImage> {
  let localUrl = isPersistentLocalImageUrl(url) ? url : ""
  if (!localUrl) {
    const materialized = await materializeImageUrl(url, "vehicle_upload", `${providerId}-input-${index + 1}`)
    localUrl = materialized?.url || ""
  }
  if (!localUrl) {
    const image = await readImageSource(url)
    const mime = mimeFromImageBytes(image.bytes) || image.mime || "image/png"
    const fileName = `${providerId}-input-${index + 1}-${Date.now()}-${Math.random().toString(16).slice(2)}.${extensionFromMime(mime)}`
    await writeVehicleUploadImage(fileName, image.bytes)
    localUrl = `/uploads/${fileName}`
    return {
      ...image,
      mime,
      fileName,
      localUrl,
      providerUrl: absoluteProviderInputImageUrl(localUrl, publicBaseUrl),
    }
  }
  const image = await readImageSource(localUrl)
  return {
    ...image,
    localUrl,
    providerUrl: absoluteProviderInputImageUrl(localUrl, publicBaseUrl),
  }
}

function providerInputPublicBaseUrl() {
  const value =
    process.env.PROVIDER_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.SITE_URL ||
    ""
  if (!value.trim()) return ""
  try {
    const url = new URL(value)
    if (url.protocol !== "http:" && url.protocol !== "https:") return ""
    if (isLocalOnlyHost(url.hostname)) return ""
    return url.origin
  } catch {
    return ""
  }
}

function absoluteProviderInputImageUrl(localUrl: string, publicBaseUrl: string) {
  return new URL(localUrl, publicBaseUrl).toString()
}

function isLocalOnlyHost(hostname: string) {
  const host = hostname.toLowerCase()
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "0.0.0.0"
}

function nanoBananaRequestShape(
  images: NanoBananaProviderInputImage[],
  payload: ReturnType<typeof nanoBananaWsEditPayload>,
  payloadBytes: number,
) {
  return {
    imageInputType: "public_url",
    imageCount: images.length,
    imageLocalPaths: images.map((image) => image.localUrl),
    imageMimes: images.map((image) => image.mime),
    aspectRatio: payload.aspect_ratio,
    promptChars: payload.prompt.length,
    payloadBytes,
    resolution: payload.resolution,
    enableSyncMode: payload.enable_sync_mode,
    enableBase64Output: payload.enable_base64_output,
  }
}

function yunwuFalNanoBananaRequestShape(
  images: NanoBananaProviderInputImage[],
  payload: ReturnType<typeof yunwuFalNanoBananaPayload>,
) {
  return {
    imageInputType: "public_url",
    imageCount: images.length,
    imageLocalPaths: images.map((image) => image.localUrl),
    imageMimes: images.map((image) => image.mime),
    promptChars: payload.prompt.length,
    numImages: payload.num_images,
    outputFormat: payload.output_format,
  }
}

function yunwuNanoOutputFormat() {
  const value = String(process.env.YUNWU_NANO_OUTPUT_FORMAT || "jpeg").trim().toLowerCase()
  if (value === "jpeg" || value === "png" || value === "webp") return value
  return "jpeg"
}

function log302NanoSubmitFailure(
  providerId: ProviderId,
  endpoint: string,
  response: Response,
  requestShape: ReturnType<typeof nanoBananaRequestShape>,
  raw: Record<string, unknown>,
) {
  console.warn(
    "[provider:302-nano] submit failed",
    JSON.stringify(
      sanitizeRawResponse({
        providerId,
        endpoint,
        httpStatus: response.status,
        statusText: response.statusText,
        requestShape,
        response: raw,
      }),
    ),
  )
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

    const resultUrls = predictionResultUrls(current, endpoint)
    if (!resultUrls.length) return current
    await delay(NANO_BANANA_WS_POLL_INTERVAL_MS)
    current = await fetch302PredictionResult(resultUrls, apiKey)
  }
}

async function fetch302PredictionResult(resultUrls: string[], apiKey: string): Promise<Record<string, unknown>> {
  const failures: string[] = []
  let lastError: unknown
  for (const resultUrl of resultUrls) {
    let response: Response
    try {
      response = await fetchWithTimeout(resultUrl, {
        method: "GET",
        headers: providerRequestHeaders(apiKey, resultUrl),
      }, NANO_BANANA_WS_POLL_REQUEST_TIMEOUT_MS)
    } catch (error) {
      lastError = error
      failures.push(`${safeSourceUrl(resultUrl)}: ${transportErrorSummary(error)}`)
      continue
    }
    const payload = await readProviderPayload(response)
    if (response.ok) return payload.raw
    failures.push(`${safeSourceUrl(resultUrl)}: ${providerHttpErrorMessageForUi(payload.raw, payload, response, resultUrl)}`)
  }
  throw new Error(`Nano-Banana-2 result polling failed after task submission. attempts=${failures.join(" | ") || "none"}`, { cause: lastError })
}

async function waitForYunwuFalResult(raw: Record<string, unknown>, apiKey: string, endpoint: string): Promise<Record<string, unknown>> {
  let current = raw
  const deadline = Date.now() + YUNWU_FAL_POLL_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (findImageResult(current)) return current
    const status = falQueueStatus(current)
    if (falQueueFailed(status)) throw new Error(falQueueError(current) || `Yunwu Nano Banana task failed with status: ${status}`)

    const urls = yunwuFalQueueUrls(current, endpoint)
    if (!urls.length) return current
    await delay(YUNWU_FAL_POLL_INTERVAL_MS)
    current = await fetchYunwuFalQueueUrls(falQueueCompleted(status) ? urls.responseUrls : [...urls.statusUrls, ...urls.responseUrls], apiKey, endpoint)
  }
  throw new Error(`Yunwu Nano Banana result polling timed out after ${Math.round(YUNWU_FAL_POLL_TIMEOUT_MS / 1000)}s.`)
}

async function fetchYunwuFalQueueUrls(urls: string[], apiKey: string, endpoint: string): Promise<Record<string, unknown>> {
  const candidates = uniqueNonEmptyStrings(urls.flatMap((url) => yunwuFalQueueUrlCandidates(url, endpoint)))
  const failures: string[] = []
  let lastError: unknown
  for (const url of candidates) {
    let response: Response
    try {
      response = await fetchWithTimeout(url, {
        method: "GET",
        headers: providerRequestHeaders(apiKey, url),
      }, NANO_BANANA_WS_POLL_REQUEST_TIMEOUT_MS)
    } catch (error) {
      lastError = error
      failures.push(`${safeSourceUrl(url)}: ${transportErrorSummary(error)}`)
      continue
    }
    const payload = await readProviderPayload(response)
    if (response.ok) return payload.raw
    failures.push(`${safeSourceUrl(url)}: ${providerHttpErrorMessageForUi(payload.raw, payload, response, url)}`)
  }
  throw new Error(`Yunwu Nano Banana result polling failed after task submission. attempts=${failures.join(" | ") || "none"}`, { cause: lastError })
}

function yunwuFalQueueUrls(raw: Record<string, unknown>, endpoint: string) {
  const responseUrls: string[] = []
  const statusUrls: string[] = []
  const data = predictionData(raw)
  for (const value of [data.response_url, data.responseUrl, raw.response_url, raw.responseUrl]) {
    if (typeof value === "string" && value) responseUrls.push(value)
  }
  for (const value of [data.status_url, data.statusUrl, raw.status_url, raw.statusUrl]) {
    if (typeof value === "string" && value) statusUrls.push(value)
  }
  const id = typeof data.request_id === "string" ? data.request_id : typeof data.requestId === "string" ? data.requestId : ""
  if (id && !responseUrls.length && !statusUrls.length) {
    const base = new URL(endpoint)
    base.pathname = `/fal-ai/nano-banana/requests/${encodeURIComponent(id)}`
    base.search = ""
    responseUrls.push(base.toString())
    statusUrls.push(`${base.toString()}/status`)
  }
  return { responseUrls: uniqueNonEmptyStrings(responseUrls), statusUrls: uniqueNonEmptyStrings(statusUrls), length: responseUrls.length + statusUrls.length }
}

function yunwuFalQueueUrlCandidates(value: string, endpoint: string) {
  try {
    const url = new URL(value)
    if (url.hostname.toLowerCase() !== "queue.fal.run") return [value]
    const proxy = new URL(endpoint)
    proxy.pathname = url.pathname
    proxy.search = url.search
    return [proxy.toString(), value]
  } catch {
    return [value]
  }
}

function falQueueStatus(raw: Record<string, unknown>) {
  return String(predictionData(raw).status || "").toUpperCase()
}

function falQueueCompleted(status: string) {
  return ["COMPLETED", "DONE", "SUCCESS", "SUCCEEDED"].includes(status)
}

function falQueueFailed(status: string) {
  return ["FAILED", "ERROR", "CANCELED", "CANCELLED"].includes(status)
}

function falQueueError(raw: Record<string, unknown>) {
  return predictionError(raw)
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

function predictionResultUrls(raw: Record<string, unknown>, endpoint: string) {
  const data = predictionData(raw)
  const urls = data.urls && typeof data.urls === "object" ? (data.urls as Record<string, unknown>) : {}
  if (typeof urls.get === "string" && urls.get) {
    return uniqueNonEmptyStrings([
      normalize302PredictionResultUrl(urls.get, endpoint),
      urls.get,
    ])
  }
  const id = typeof data.id === "string" ? data.id : ""
  if (!id) return []
  const url = new URL(endpoint)
  url.pathname = `/ws/api/v3/predictions/${id}/result`
  url.search = ""
  return uniqueNonEmptyStrings([
    normalize302PredictionResultUrl(url.toString(), endpoint),
    official302PredictionResultUrl(id),
  ])
}

function normalize302PredictionResultUrl(resultUrl: string, endpoint: string) {
  try {
    const url = new URL(resultUrl)
    if (!is302ApiHost(url.hostname.toLowerCase())) return resultUrl
    const base = new URL(canonical302Endpoint(endpoint))
    url.protocol = base.protocol
    url.hostname = base.hostname
    url.port = base.port
    return url.toString()
  } catch {
    return resultUrl
  }
}

function official302PredictionResultUrl(id: string) {
  return `https://api.302.ai/ws/api/v3/predictions/${encodeURIComponent(id)}/result`
}

function uniqueNonEmptyStrings(values: string[]) {
  const seen = new Set<string>()
  return values.filter((value) => {
    const clean = value.trim()
    if (!clean || seen.has(clean)) return false
    seen.add(clean)
    return true
  })
}

function append302FastImageOptions(formData: FormData) {
  for (const [key, value] of Object.entries(fast302ImageOptions())) {
    formData.append(key, String(value))
  }
}

function appendYunwuImageEditOptions(formData: FormData) {
  formData.set("n", "1")
  formData.set("quality", yunwuImageQuality())
  formData.set("output_format", yunwuImageOutputFormat())
  const outputFormat = yunwuImageOutputFormat()
  if (outputFormat === "jpeg" || outputFormat === "webp") {
    formData.set("output_compression", String(yunwuImageOutputCompression()))
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
  if (isYunwuImageEndpoint(endpoint)) return yunwuImageSize()
  if (!is302ImageEndpoint(endpoint) || !vehicleImage) return "1024x1024"
  const dimensions = imageDimensions(vehicleImage.bytes)
  return dimensions ? supported302ImageSize(dimensions) : "1024x1024"
}

function yunwuImageSize() {
  const value = String(process.env.YUNWU_IMAGE_SIZE || "1024x1024").trim().toLowerCase()
  if (value === "1024x1024" || value === "1024x1536" || value === "1536x1024") return value
  return "1024x1024"
}

function yunwuImageQuality() {
  const value = String(process.env.YUNWU_IMAGE_QUALITY || "low").trim().toLowerCase()
  if (value === "low" || value === "medium" || value === "high" || value === "auto") return value
  return "low"
}

function yunwuImageOutputFormat() {
  const value = String(process.env.YUNWU_IMAGE_OUTPUT_FORMAT || "jpeg").trim().toLowerCase()
  if (value === "jpeg" || value === "png" || value === "webp") return value
  return "jpeg"
}

function yunwuImageOutputCompression() {
  const value = Number(process.env.YUNWU_IMAGE_OUTPUT_COMPRESSION || 80)
  if (!Number.isFinite(value)) return 80
  return Math.max(0, Math.min(100, Math.round(value)))
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
  const imageAsset = await readImageAsset(url)
  if (imageAsset) {
    return {
      bytes: new Uint8Array(imageAsset.bytes),
      mime: imageAsset.mime,
      fileName: imageAsset.fileName,
    }
  }
  if (/^https?:\/\//i.test(url)) {
    let response: Response
    try {
      response = await fetch(url)
    } catch (error) {
      throw new Error(`Input image fetch failed before provider request. source=${safeSourceUrl(url)}; ${transportErrorSummary(error)}`, { cause: error })
    }
    if (!response.ok) throw new Error(`Input image fetch failed before provider request. source=${safeSourceUrl(url)}; HTTP ${response.status}`)
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
  const image = await readLocalImageByAppUrl(url)
  if (!image) throw new Error(`图片路径不存在或不可读取：${url}`)
  return {
    bytes: new Uint8Array(image.bytes),
    mime: image.mime,
    fileName: image.fileName,
  }
}

function safeSourceUrl(value: string) {
  try {
    const parsed = new URL(value)
    if (parsed.search) parsed.search = "?..."
    return parsed.toString().slice(0, 240)
  } catch {
    return value.slice(0, 240)
  }
}

function imageDataUrl(image: { bytes: Uint8Array; mime: string }) {
  return `data:${image.mime};base64,${Buffer.from(image.bytes).toString("base64")}`
}

function findImageResult(raw: Record<string, unknown>): { url?: string; b64Json?: string; mime?: string } | null {
  const outputResult = findOutputImageResult(raw)
  if (outputResult) return outputResult
  const data = Array.isArray(raw.data) ? raw.data : []
  for (const item of data) {
    if (!item || typeof item !== "object") continue
    const value = item as { url?: unknown; b64_json?: unknown } & Record<string, unknown>
    if (typeof value.b64_json === "string" && value.b64_json) return { b64Json: value.b64_json }
    const base64Image = base64ImageFromRecord(value)
    if (base64Image) return base64Image
    if (typeof value.url === "string" && value.url) return { url: value.url }
  }
  const output = Array.isArray(raw.output) ? raw.output : []
  for (const item of output) {
    const result = findImageResultInValue(item)
    if (result) return result
  }
  return findImageResultInValue(raw)
}

function findOutputImageResult(raw: Record<string, unknown>): { url?: string; b64Json?: string; mime?: string } | null {
  const data = raw.data && typeof raw.data === "object" && !Array.isArray(raw.data) ? (raw.data as Record<string, unknown>) : null
  return firstPreferredImageResult([
    data?.outputs,
    data?.output,
    data?.result,
    data?.results,
    data?.images,
    data?.image,
    data?.url,
    raw.outputs,
    raw.output,
    raw.result,
    raw.results,
    raw.images,
    raw.image,
    raw.url,
  ])
}

function firstPreferredImageResult(values: unknown[]): { url?: string; b64Json?: string; mime?: string } | null {
  const results: Array<{ url?: string; b64Json?: string; mime?: string }> = []
  for (const value of values) {
    if (!value) continue
    const items = Array.isArray(value) ? value : [value]
    for (const item of items) {
      const result = findImageResultInValue(item)
      if (result) results.push(result)
    }
  }
  return results.find((result) => result.url && is302HostedResultUrl(result.url)) || results[0] || null
}

function is302HostedResultUrl(value: string) {
  try {
    const hostname = new URL(value).hostname.toLowerCase()
    return hostname === "file.302.ai" || hostname.endsWith(".file.302.ai")
  } catch {
    return false
  }
}

function findImageResultInValue(value: unknown): { url?: string; b64Json?: string; mime?: string } | null {
  if (typeof value === "string") return findImageResultInText(value)
  if (!value || typeof value !== "object") return null
  const record = value as Record<string, unknown>
  if (typeof record.b64_json === "string" && record.b64_json) return { b64Json: record.b64_json }
  const base64Image = base64ImageFromRecord(record)
  if (base64Image) return base64Image
  if (typeof record.url === "string" && record.url) return { url: record.url }
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

function base64ImageFromRecord(record: Record<string, unknown>): { b64Json: string; mime?: string } | null {
  const mime =
    typeof record.mime === "string"
      ? record.mime
      : typeof record.mimeType === "string"
        ? record.mimeType
        : typeof record.mime_type === "string"
          ? record.mime_type
          : undefined
  for (const key of ["base64", "b64", "image_base64", "imageBase64", "output_base64", "outputBase64", "result_base64", "resultBase64", "data"]) {
    const value = record[key]
    if (typeof value !== "string" || !value) continue
    const parsed = parseBase64Image(value, mime)
    if (parsed) return parsed
  }
  return null
}

function findImageResultInText(value: string): { url?: string; b64Json?: string; mime?: string } | null {
  const trimmed = value.trim()
  const dataUrl = value.match(/data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+/)
  if (dataUrl?.[0]) return { url: dataUrl[0] }
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    try {
      const parsed = JSON.parse(trimmed) as unknown
      const result = findImageResultInValue(parsed)
      if (result) return result
    } catch {
      // Fall through to text URL extraction.
    }
  }
  const searchable = value.replace(/\\\//g, "/").replace(/\\u0026/g, "&")
  const b64Json = value.match(/"b64_json"\s*:\s*"([^"]+)"/)
  if (b64Json?.[1]) return { b64Json: b64Json[1] }
  const hosted302Url = searchable.match(/https?:\/\/(?:[a-zA-Z0-9-]+\.)*file\.302\.ai\/[^\s)"'<>\\]+/i)
  if (hosted302Url?.[0]) return { url: hosted302Url[0] }
  const imageUrl = searchable.match(/https?:\/\/[^\s)"'<>\\]+\.(?:png|jpe?g|webp)(?:\?[^\s)"'<>\\]*)?/i)
  if (imageUrl?.[0]) return { url: imageUrl[0] }
  return null
}

function parseBase64Image(value: string, mime?: string): { b64Json: string; mime?: string } | null {
  const trimmed = value.trim()
  const dataUrl = trimmed.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/)
  if (dataUrl?.[2]) return { b64Json: dataUrl[2].replace(/\s+/g, ""), mime: dataUrl[1] }
  const compact = trimmed.replace(/\s+/g, "")
  if (compact.length < 128 || !/^[A-Za-z0-9+/]+={0,2}$/.test(compact)) return null
  const detectedMime = mimeFromImageBytes(new Uint8Array(Buffer.from(compact.slice(0, 96), "base64")))
  return detectedMime ? { b64Json: compact, mime: mime || detectedMime } : null
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
    const persisted = await materializeImageUrl(image.url, "result", providerId)
    if (persisted) return persisted.url
    const parsed = await readProviderResultImageUrl(image.url)
    bytes = parsed.bytes
    mime = parsed.mime
  } else {
    throw new Error("生图 Provider 返回的图片结果为空。")
  }
  mime = mimeFromImageBytes(bytes) || mime
  const fileName = `${providerId}-${Date.now()}-${Math.random().toString(16).slice(2)}.${extensionFromMime(mime)}`
  await writeResultImage(fileName, bytes)
  return `/results/${fileName}`
}

async function readProviderResultImageUrl(url: string) {
  let response: Response
  try {
    response = await fetch(url, {
      redirect: "follow",
      headers: {
        Accept: "image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8",
        "User-Agent": "Mozilla/5.0 (compatible; ModLabImageFetcher/1.0)",
      },
    })
  } catch (error) {
    throw new Error(`Provider returned an image URL but the server could not persist it locally. source=${safeSourceUrl(url)}; ${transportErrorSummary(error)}`, { cause: error })
  }
  if (!response.ok) throw new Error(`Provider result image download failed after provider success. source=${safeSourceUrl(url)}; HTTP ${response.status}`)
  const contentLength = Number(response.headers.get("content-length") || 0)
  if (contentLength > MAX_PROVIDER_RESULT_IMAGE_BYTES) throw new Error(`Provider result image is too large. source=${safeSourceUrl(url)}; bytes=${contentLength}`)
  const bytes = new Uint8Array(await response.arrayBuffer())
  if (bytes.byteLength > MAX_PROVIDER_RESULT_IMAGE_BYTES) throw new Error(`Provider result image is too large. source=${safeSourceUrl(url)}; bytes=${bytes.byteLength}`)
  const mime = mimeFromImageBytes(bytes) || response.headers.get("content-type")?.split(";")[0] || mimeFromPath(url)
  if (!mime.startsWith("image/")) throw new Error(`Provider result image has invalid content type. source=${safeSourceUrl(url)}; contentType=${mime}`)
  return { bytes, mime }
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
    Object.entries(value as Record<string, unknown>).map(([key, child]) => {
      const lowerKey = key.toLowerCase()
      const isBase64Image = typeof child === "string" && (lowerKey.includes("base64") || lowerKey === "b64_json" || parseBase64Image(child))
      return [key, isBase64Image ? "[base64 omitted]" : sanitizeValue(child)]
    }),
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

function extensionFromMime(mime: string) {
  if (mime.includes("jpeg") || mime.includes("jpg")) return "jpg"
  if (mime.includes("webp")) return "webp"
  if (mime.includes("svg")) return "svg"
  return "png"
}

function fileNameFromPath(value: string, mime: string) {
  const clean = value.split("?")[0].replace(/\/+$/, "")
  const name = clean.split(/[\\/]/).pop() || ""
  return name && name.includes(".") ? name : `input-${Date.now()}.${extensionFromMime(mime)}`
}
