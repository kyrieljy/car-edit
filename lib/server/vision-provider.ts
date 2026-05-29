import type { GenerationStandardJson, ProviderConfig, ProviderId, ResultCheckResult } from "../types"
import { categoryIdFromAliasText, categoryRecognitionList, normalizePartCategoryAlias, type PartCategoryAliasSource } from "../part-category-aliases"
import { readLocalImageByAppUrl } from "./local-images"

type VehicleRecognitionRequest = {
  provider: ProviderConfig
  apiKey: string
  image: File
  prompt: string
}

type PartRecognitionRequest = {
  provider: ProviderConfig
  apiKey: string
  image: File
  prompt: string
  fileName: string
  categories?: PartCategoryAliasSource[]
}

type GenerationResultCheckRequest = {
  provider: ProviderConfig
  apiKey: string
  sourceImageUrl: string
  resultImageUrl: string
  standardJson: GenerationStandardJson
  prompt: string
  resultCheckPrompt: string
}

export type VehicleRecognitionResponse = {
  ok: boolean
  provider: ProviderId
  model: string
  view: string
  confidence: number
  isVehicle: boolean
  qualityFlags: string[]
  rejectReason: string
  latencyMs: number
  rawResponse: Record<string, unknown>
  error?: string
}

export type PartRecognitionResponse = {
  ok: boolean
  provider: ProviderId
  category: string
  confidence: number
  visualFeatures: string[]
  usableAsReference: boolean
  rejectReason: string
  brand: string
  model: string
  variant: string
  latencyMs: number
  rawResponse: Record<string, unknown>
  error?: string
}

export type GenerationResultCheckProviderResponse = {
  ok: boolean
  provider: ProviderId
  result: ResultCheckResult
  latencyMs: number
  rawResponse: Record<string, unknown>
  error?: string
}

const VISION_PROVIDER_TIMEOUT_MS = 60_000
const DEFAULT_VEHICLE_RECOGNITION_PROMPT = [
  "你是汽车车型识别助手。请判断用户上传图片是否为真实车辆照片，并返回严格 JSON。",
  "如果是车辆，必须给出一个确定、具体、规范化的最佳车型猜测，不要使用“可能是 / 疑似 / maybe / probably / looks like”等不确定话术。",
  "model 字段必须尽量包含品牌、车系/车型、车身形式和代号/世代；格式示例：BMW M4 coupe (F82)、Porsche 911 GT3 (992)、Toyota GR Supra coupe (A90)。",
  "不要只返回品牌或单个车系代号，例如不要只写 BMW、M4、911；如果画面信息不足但仍是车辆，也要填写最具体的 best guess，并用 confidence 表示不确定性。",
  "只有在完全无法判断为车辆或车辆主体不可识别时，model 才写 unknown，并给出 rejectReason。",
  "返回字段：isVehicle、model、make、series、generation、bodyStyle、view、confidence、qualityFlags、rejectReason。只返回 JSON，不要 Markdown。",
].join("\n")

export async function recognizeVehicleWithProvider(input: VehicleRecognitionRequest): Promise<VehicleRecognitionResponse> {
  const started = Date.now()
  if (input.provider.id === "mock-vision" || input.provider.baseUrl.startsWith("local://")) {
    return {
      ok: true,
      provider: input.provider.id,
      model: "BMW M4 coupe (F82)",
      view: "front three-quarter",
      confidence: 0.88,
      isVehicle: true,
      qualityFlags: ["mock_vision"],
      rejectReason: "",
      latencyMs: Date.now() - started,
      rawResponse: {
        provider: input.provider.id,
        model: input.provider.modelName,
        mock: true,
        note: "Mock 识别固定返回 BMW M4 coupe (F82)，用于演示宝马 M4 案例。",
      },
    }
  }

  if (!input.provider.enabled) return vehicleRecognitionError(input.provider, started, "Vision Provider 未启用。")
  if (process.env.DISABLE_EXTERNAL_AI === "1") {
    return vehicleRecognitionError(input.provider, started, "External AI calls are disabled by DISABLE_EXTERNAL_AI=1.", { provider: input.provider.id })
  }
  if (!input.apiKey) return vehicleRecognitionError(input.provider, started, "Vision Provider API Key 为空或需要重新保存。")
  if (!input.provider.modelName.trim()) return vehicleRecognitionError(input.provider, started, "Vision Provider 未配置模型名称。")

  const endpoint = chatCompletionsEndpoint(input.provider.baseUrl)
  const imageUrl = await fileToDataUrl(input.image)
  const response = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      model: input.provider.modelName,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: input.prompt || defaultVehicleRecognitionPrompt(),
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "请识别这张用户上传的车辆照片。只返回 JSON，不要返回 Markdown。",
            },
            {
              type: "image_url",
              image_url: { url: imageUrl },
            },
          ],
        },
      ],
    }),
  }, VISION_PROVIDER_TIMEOUT_MS)
  const raw = (await response.json().catch(() => ({}))) as Record<string, unknown>
  if (!response.ok) {
    return vehicleRecognitionError(
      input.provider,
      started,
      providerErrorMessage(raw) || `Vision Provider 调用失败：HTTP ${response.status}`,
      raw,
    )
  }

  const content = extractMessageContent(raw)
  const parsed = parseJsonObject(content)
  if (!parsed) {
    return vehicleRecognitionError(input.provider, started, "Vision Provider 未返回可解析的 JSON。", raw)
  }
  const normalized = normalizeVehicleRecognition(parsed)
  return {
    ok: true,
    provider: input.provider.id,
    ...normalized,
    latencyMs: Date.now() - started,
    rawResponse: raw,
  }
}

export async function recognizePartWithProvider(input: PartRecognitionRequest): Promise<PartRecognitionResponse> {
  const started = Date.now()
  if (input.provider.id === "mock-vision" || input.provider.baseUrl.startsWith("local://")) {
    return mockPartRecognition(input.provider, started, input.fileName, input.categories)
  }

  if (!input.provider.enabled) return partRecognitionError(input.provider, started, "Vision Provider 未启用。")
  if (process.env.DISABLE_EXTERNAL_AI === "1") {
    return partRecognitionError(input.provider, started, "External AI calls are disabled by DISABLE_EXTERNAL_AI=1.", { provider: input.provider.id })
  }
  if (!input.apiKey) return partRecognitionError(input.provider, started, "Vision Provider API Key 为空或需要重新保存。")
  if (!input.provider.modelName.trim()) return partRecognitionError(input.provider, started, "Vision Provider 未配置模型名称。")

  const endpoint = chatCompletionsEndpoint(input.provider.baseUrl)
  const imageUrl = await fileToDataUrl(input.image)
  const response = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      model: input.provider.modelName,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: partRecognitionPrompt(input.prompt, input.categories),
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Identify this uploaded car part reference image. File name: ${input.fileName}. Return JSON only.`,
            },
            {
              type: "image_url",
              image_url: { url: imageUrl },
            },
          ],
        },
      ],
    }),
  }, VISION_PROVIDER_TIMEOUT_MS)
  const raw = (await response.json().catch(() => ({}))) as Record<string, unknown>
  if (!response.ok) {
    return partRecognitionError(
      input.provider,
      started,
      providerErrorMessage(raw) || `Vision Provider 调用失败：HTTP ${response.status}`,
      raw,
    )
  }

  const parsed = parseJsonObject(extractMessageContent(raw))
  if (!parsed) return partRecognitionError(input.provider, started, "Vision Provider 未返回可解析的配件 JSON。", raw)
  return {
    ok: true,
    provider: input.provider.id,
    ...normalizePartRecognition(parsed, input.categories),
    latencyMs: Date.now() - started,
    rawResponse: raw,
  }
}

export async function checkGenerationResultWithProvider(input: GenerationResultCheckRequest): Promise<GenerationResultCheckProviderResponse> {
  const started = Date.now()
  if (input.provider.id === "mock-vision" || input.provider.baseUrl.startsWith("local://")) {
    return resultCheckError(input.provider, started, "Mock/local result check does not call a vision model.", {
      provider: input.provider.id,
      mock: true,
    })
  }
  if (!input.provider.enabled) return resultCheckError(input.provider, started, "Vision Provider is disabled.")
  if (process.env.DISABLE_EXTERNAL_AI === "1") {
    return resultCheckError(input.provider, started, "External AI calls are disabled by DISABLE_EXTERNAL_AI=1.", { provider: input.provider.id })
  }
  if (!input.apiKey) return resultCheckError(input.provider, started, "Vision Provider API key is missing.")
  if (!input.provider.modelName.trim()) return resultCheckError(input.provider, started, "Vision Provider model name is missing.")

  const endpoint = chatCompletionsEndpoint(input.provider.baseUrl)
  let sourceImage = ""
  let resultImage = ""
  try {
    sourceImage = await imageUrlToDataUrl(input.sourceImageUrl)
    resultImage = await imageUrlToDataUrl(input.resultImageUrl)
  } catch (error) {
    return resultCheckError(input.provider, started, error instanceof Error ? error.message : "Result check image loading failed.")
  }
  const response = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.apiKey}`,
    },
    body: JSON.stringify({
      model: input.provider.modelName,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: resultCheckSystemPrompt(input.resultCheckPrompt),
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: [
                "Compare the source vehicle image and the generated result image.",
                "Return JSON only with: passed, score, missingElements, wrongElements, badCaseTags, summary, retryPrompt.",
                "Standard JSON:",
                JSON.stringify(input.standardJson),
                "Effective prompt:",
                input.prompt,
              ].join("\n\n"),
            },
            { type: "image_url", image_url: { url: sourceImage } },
            { type: "image_url", image_url: { url: resultImage } },
          ],
        },
      ],
    }),
  }, VISION_PROVIDER_TIMEOUT_MS)
  const raw = (await response.json().catch(() => ({}))) as Record<string, unknown>
  if (!response.ok) {
    return resultCheckError(
      input.provider,
      started,
      providerErrorMessage(raw) || `Vision result check request failed: HTTP ${response.status}`,
      raw,
    )
  }

  const parsed = parseJsonObject(extractMessageContent(raw))
  if (!parsed) return resultCheckError(input.provider, started, "Vision result check did not return valid JSON.", raw)
  return {
    ok: true,
    provider: input.provider.id,
    result: normalizeGenerationResultCheck(parsed),
    latencyMs: Date.now() - started,
    rawResponse: raw,
  }
}

function mockPartRecognition(provider: ProviderConfig, started: number, fileName: string, categories?: PartCategoryAliasSource[]): PartRecognitionResponse {
  const category = categoryFromText(fileName, categories)
  return {
    ok: true,
    provider: provider.id,
    category: category || "unknown",
    confidence: category ? 0.74 : 0.35,
    visualFeatures: category ? [`mock category from file name: ${category}`] : ["mock could not infer category from file name"],
    usableAsReference: true,
    rejectReason: "",
    brand: "",
    model: "",
    variant: fileName,
    latencyMs: Date.now() - started,
    rawResponse: { provider: provider.id, mock: true, fileName, category: category || "unknown" },
  }
}

function partRecognitionError(
  provider: ProviderConfig,
  started: number,
  error: string,
  rawResponse: Record<string, unknown> = {},
): PartRecognitionResponse {
  return {
    ok: false,
    provider: provider.id,
    category: "unknown",
    confidence: 0,
    visualFeatures: [],
    usableAsReference: false,
    rejectReason: error,
    brand: "",
    model: "",
    variant: "",
    latencyMs: Date.now() - started,
    rawResponse,
    error,
  }
}

function vehicleRecognitionError(
  provider: ProviderConfig,
  started: number,
  error: string,
  rawResponse: Record<string, unknown> = {},
): VehicleRecognitionResponse {
  return {
    ok: false,
    provider: provider.id,
    model: "",
    view: "unknown",
    confidence: 0,
    isVehicle: false,
    qualityFlags: [],
    rejectReason: error,
    latencyMs: Date.now() - started,
    rawResponse,
    error,
  }
}

function resultCheckError(
  provider: ProviderConfig,
  started: number,
  error: string,
  rawResponse: Record<string, unknown> = {},
): GenerationResultCheckProviderResponse {
  return {
    ok: false,
    provider: provider.id,
    result: {
      passed: true,
      score: 0,
      missingElements: [],
      wrongElements: [],
      badCaseTags: ["vision_result_check_unavailable"],
      retryPrompt: "",
      summary: error,
    },
    latencyMs: Date.now() - started,
    rawResponse,
    error,
  }
}

function resultCheckSystemPrompt(customPrompt: string) {
  return [
    customPrompt.trim(),
    "You are a strict automotive photo-edit quality checker.",
    "Use the source vehicle image, generated result image, standard JSON, and effective prompt.",
    "Check whether requested body paint, finish effect, gradient, brake caliper color, ride height, and selected parts were applied.",
    "Also check whether protected elements were preserved: vehicle identity, camera angle, background, lighting, glass, lights, wheels, tires, license plate shape, black plastic trim, carbon fiber, grille, and spoiler/wing unless explicitly requested.",
    "Mark failed only for clear visual misses, wrong edits, severe deformation, or obvious unintended background/camera changes.",
    "Return JSON only: {\"passed\": boolean, \"score\": number, \"missingElements\": string[], \"wrongElements\": string[], \"badCaseTags\": string[], \"summary\": string, \"retryPrompt\": string}.",
  ]
    .filter(Boolean)
    .join("\n")
}

function normalizeGenerationResultCheck(input: Record<string, unknown>): ResultCheckResult {
  const records = resultCheckRecords(input)
  const missingElements = normalizeStringList(firstValue(records, ["missingElements", "missing_elements", "missing", "omissions"]))
  const wrongElements = normalizeStringList(firstValue(records, ["wrongElements", "wrong_elements", "wrong", "errors", "issues"]))
  const badCaseTags = normalizeStringList(firstValue(records, ["badCaseTags", "bad_case_tags", "tags"]))
  const score = clamp(Number(firstValue(records, ["score", "confidence", "qualityScore", "quality_score"]) ?? 0.75), 0, 1)
  const explicitPassed = firstBoolean(records, ["passed", "pass", "ok", "success"])
  const passed = typeof explicitPassed === "boolean" ? explicitPassed : score >= 0.72 && missingElements.length === 0 && wrongElements.length === 0
  return {
    passed,
    score,
    missingElements,
    wrongElements,
    badCaseTags: passed ? badCaseTags : Array.from(new Set([...badCaseTags, "vision_result_check_failed"])),
    retryPrompt: firstCleanString(records, ["retryPrompt", "retry_prompt", "repairPrompt", "repair_prompt"]) || defaultResultCheckRetryPrompt(missingElements, wrongElements),
    summary: firstCleanString(records, ["summary", "reason", "explanation"]) || (passed ? "Vision result check passed." : "Vision result check failed."),
  }
}

function resultCheckRecords(input: Record<string, unknown>) {
  const records = [input]
  for (const key of ["result", "data", "check", "quality", "evaluation"]) {
    const value = input[key]
    if (isRecord(value)) records.push(value)
  }
  return records
}

function defaultResultCheckRetryPrompt(missingElements: string[], wrongElements: string[]) {
  const items = [...missingElements, ...wrongElements].filter(Boolean)
  if (!items.length) return ""
  return `Repair the generated image so these checked issues are corrected: ${items.join(", ")}. Preserve the source vehicle identity, camera angle, background, lighting, and all unrequested parts.`
}

function chatCompletionsEndpoint(baseUrl: string) {
  const normalized = (baseUrl || "https://api.openai.com/v1").replace(/\/+$/, "")
  if (normalized.endsWith("/chat/completions")) return normalized
  return `${normalized}/chat/completions`
}

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs: number) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (error) {
    if ((error as { name?: string }).name === "AbortError") {
      throw new Error(`Vision provider request timed out after ${Math.round(timeoutMs / 1000)}s: ${String(input)}`)
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

async function fileToDataUrl(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer())
  return `data:${file.type};base64,${buffer.toString("base64")}`
}

async function imageUrlToDataUrl(url: string) {
  if (url.startsWith("data:")) return url
  if (/^https?:\/\//i.test(url)) {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Image fetch failed for result check: HTTP ${response.status}`)
    const mime = response.headers.get("content-type")?.split(";")[0] || mimeFromPathForVision(url)
    return `data:${mime};base64,${Buffer.from(await response.arrayBuffer()).toString("base64")}`
  }
  const image = await readLocalImageByAppUrl(url)
  if (!image) throw new Error(`Result check image is missing or unreadable: ${url}`)
  return `data:${image.mime};base64,${image.bytes.toString("base64")}`
}

function mimeFromPathForVision(value: string) {
  const lower = value.toLowerCase()
  if (lower.endsWith(".png")) return "image/png"
  if (lower.endsWith(".webp")) return "image/webp"
  if (lower.endsWith(".gif")) return "image/gif"
  return "image/jpeg"
}

function extractMessageContent(raw: Record<string, unknown>) {
  const choices = Array.isArray(raw.choices) ? raw.choices : []
  const first = choices[0] as { message?: { content?: unknown } } | undefined
  const content = first?.message?.content
  if (typeof content === "string") return content
  if (Array.isArray(content)) {
    return content
      .map((item) => {
        if (typeof item === "string") return item
        if (item && typeof item === "object" && "text" in item) return String((item as { text?: unknown }).text ?? "")
        return ""
      })
      .join("\n")
  }
  return ""
}

function parseJsonObject(value: string) {
  const trimmed = value.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "")
  const start = trimmed.indexOf("{")
  const end = trimmed.lastIndexOf("}")
  if (start < 0 || end < start) return null
  try {
    return JSON.parse(trimmed.slice(start, end + 1)) as Record<string, unknown>
  } catch {
    return null
  }
}

function normalizeVehicleRecognition(input: Record<string, unknown>) {
  const records = recognitionRecords(input)
  const model = normalizeVehicleModel(records)
  const view = firstCleanString(records, ["view", "angle", "cameraView", "camera_view", "perspective"]) || "unknown"
  const confidence = clamp(Number(firstValue(records, ["confidence", "score", "probability"]) ?? 0.5), 0, 1)
  const rejectReason = firstCleanString(records, ["rejectReason", "reject_reason", "reason", "error"])
  const qualityFlags = normalizeStringList(firstValue(records, ["qualityFlags", "quality_flags", "flags", "issues"]))
  const vehicleFlag = firstBoolean(records, ["isVehicle", "is_vehicle", "isCar", "is_car", "vehicle", "car"])
  const isVehicle = typeof vehicleFlag === "boolean" ? vehicleFlag : Boolean(model || !rejectReason)
  return { model, view, confidence, isVehicle, qualityFlags, rejectReason }
}

function normalizePartRecognition(input: Record<string, unknown>, categories?: PartCategoryAliasSource[]) {
  const records = recognitionRecords(input)
  const rawCategory = firstCleanString(records, ["category", "partCategory", "part_category", "type", "partType", "part_type"])
  const category = normalizePartCategory(rawCategory, categories)
  const confidence = clamp(Number(firstValue(records, ["confidence", "score", "probability"]) ?? (category === "unknown" ? 0.35 : 0.7)), 0, 1)
  const rejectReason = firstCleanString(records, ["rejectReason", "reject_reason", "reason", "error"])
  const usableFlag = firstBoolean(records, ["usableAsReference", "usable_as_reference", "usable", "isUsable", "is_usable"])
  return {
    category,
    confidence,
    visualFeatures: normalizeStringList(firstValue(records, ["visualFeatures", "visual_features", "features", "notes"])),
    usableAsReference: typeof usableFlag === "boolean" ? usableFlag : category !== "unknown" && !rejectReason,
    rejectReason,
    brand: firstCleanString(records, ["brand", "make", "manufacturer"]),
    model: firstCleanString(records, ["model", "modelName", "model_name", "partModel", "part_model"]),
    variant: firstCleanString(records, ["variant", "trim", "style", "name"]),
  }
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function normalizePartCategory(value: string, categories?: PartCategoryAliasSource[]) {
  return normalizePartCategoryAlias(value, categories)
}

function categoryFromText(value: string, categories?: PartCategoryAliasSource[]) {
  return categoryIdFromAliasText(value, categories)
}

function recognitionRecords(input: Record<string, unknown>) {
  const records = [input]
  for (const key of ["vehicle", "car", "result", "data", "recognition", "detectedVehicle"]) {
    const value = input[key]
    if (isRecord(value)) records.push(value)
  }
  return records
}

function normalizeVehicleModel(records: Record<string, unknown>[]): string {
  const candidates: string[] = []
  const directKeys = [
    "canonicalModel",
    "canonical_model",
    "detectedModel",
    "detected_model",
    "bestGuessModel",
    "best_guess_model",
    "bestGuess",
    "best_guess",
    "vehicleModel",
    "vehicle_model",
    "makeModel",
    "make_model",
    "carModel",
    "car_model",
    "modelName",
    "model_name",
    "vehicleName",
    "vehicle_name",
    "name",
    "model",
  ]

  for (const record of records) {
    for (const key of directKeys) {
      const direct = cleanVehicleModelText(record[key])
      if (direct && !isUnknownModel(direct)) candidates.push(direct)
    }

    const modelObject = record.model
    if (isRecord(modelObject)) {
      const nested: string = normalizeVehicleModel([modelObject])
      if (nested) candidates.push(nested)
    }
    const make = firstCleanString([record], ["make", "brand", "manufacturer", "marque"])
    const series = firstCleanString([record], ["series", "model", "modelCode", "model_code", "name"])
    const trim = firstCleanString([record], ["trim", "submodel", "variant"])
    const bodyStyle = firstCleanString([record], ["bodyStyle", "body_style", "body", "bodyType", "body_type"])
    const generation = firstCleanString([record], ["generation", "chassis", "platform", "code"])
    const yearRange = firstCleanString([record], ["yearRange", "year_range", "modelYear", "model_year", "year"])
    const joined = canonicalVehicleModel([make, series, trim, bodyStyle], generation || yearRange)
    if (joined && !isUnknownModel(joined)) candidates.push(joined)
  }

  return bestVehicleModelCandidate(candidates)
}

function firstValue(records: Record<string, unknown>[], keys: string[]) {
  for (const record of records) {
    for (const key of keys) {
      if (record[key] !== undefined && record[key] !== null) return record[key]
    }
  }
  return undefined
}

function firstCleanString(records: Record<string, unknown>[], keys: string[]) {
  const value = firstValue(records, keys)
  if (typeof value === "number" && Number.isFinite(value)) return String(value)
  return cleanString(value)
}

function cleanVehicleModelText(value: unknown) {
  const raw = typeof value === "number" && Number.isFinite(value) ? String(value) : cleanString(value)
  if (!raw) return ""
  return raw
    .replace(/^(model|vehicle|car|车型|车辆|识别车型|detected model)\s*[:：-]\s*/i, "")
    .replace(/^(可能是|疑似|大概是|应该是|看起来像|看上去像|貌似|或许|估计是)\s*/i, "")
    .replace(/\b(maybe|probably|possibly|likely|appears to be|looks like|seems to be|i think|it is)\b\s*/gi, "")
    .replace(/^[\s"'`“”‘’]+|[\s"'`“”‘’，。,.;；:：]+$/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function canonicalVehicleModel(parts: string[], generation: string) {
  const base = joinUniqueSegments(parts.map(cleanVehicleModelText))
  const generationText = cleanVehicleModelText(generation)
  if (!base) return ""
  if (!generationText || base.toLowerCase().includes(generationText.toLowerCase())) return base
  return `${base} (${generationText})`
}

function bestVehicleModelCandidate(candidates: string[]) {
  const unique = Array.from(new Set(candidates.map(cleanVehicleModelText).filter((candidate) => candidate && !isUnknownModel(candidate))))
  unique.sort((left, right) => vehicleModelScore(right) - vehicleModelScore(left))
  return unique[0] || ""
}

function vehicleModelScore(value: string) {
  const normalized = value.toLowerCase()
  const words = normalized.split(/[\s/()-]+/).filter(Boolean)
  let score = Math.min(value.length, 80) + words.length * 8
  if (knownVehicleMakePattern.test(normalized)) score += 22
  if (/\b[a-z]\d{2,3}\b/i.test(value) || /\([a-z0-9-]+\)/i.test(value)) score += 18
  if (/\b(coupe|sedan|saloon|wagon|touring|convertible|roadster|suv|hatchback|fastback|gran coupe)\b/i.test(value)) score += 12
  if (/^\w+$/.test(normalized)) score -= 30
  if (genericVehicleMakes.has(normalized)) score -= 80
  if (/^(m\d|911|civic|camry|corolla|accord|supra|mustang)$/i.test(normalized)) score -= 18
  return score
}

function firstBoolean(records: Record<string, unknown>[], keys: string[]) {
  const value = firstValue(records, keys)
  if (typeof value === "boolean") return value
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase()
    if (["true", "yes", "1", "vehicle", "car"].includes(normalized)) return true
    if (["false", "no", "0", "not_vehicle", "not car"].includes(normalized)) return false
  }
  return undefined
}

function normalizeStringList(value: unknown) {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean)
  if (typeof value === "string") {
    return value
      .split(/[,，;；\n]/)
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}

function joinUniqueSegments(segments: string[]) {
  const result: string[] = []
  for (const segment of segments.map((item) => item.trim()).filter(Boolean)) {
    const normalized = segment.toLowerCase()
    if (isUnknownModel(segment)) continue
    if (result.some((item) => item.toLowerCase() === normalized || item.toLowerCase().includes(normalized))) continue
    if (result.some((item) => normalized.includes(item.toLowerCase()))) {
      for (let index = result.length - 1; index >= 0; index -= 1) {
        if (normalized.includes(result[index].toLowerCase())) result.splice(index, 1)
      }
    }
    result.push(segment)
  }
  return result.join(" ").trim()
}

function isUnknownModel(value: string) {
  return ["unknown", "n/a", "na", "none", "null", "车型待识别", "待识别", "未知", "未识别"].includes(value.trim().toLowerCase())
}

const genericVehicleMakes = new Set([
  "bmw",
  "mercedes-benz",
  "mercedes",
  "benz",
  "audi",
  "porsche",
  "toyota",
  "honda",
  "ford",
  "chevrolet",
  "tesla",
  "nissan",
  "mazda",
  "subaru",
  "lexus",
  "volkswagen",
  "vw",
])

const knownVehicleMakePattern = new RegExp(`\\b(${Array.from(genericVehicleMakes).join("|")})\\b`, "i")

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value))
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

function providerErrorMessage(raw: Record<string, unknown>) {
  const error = raw.error
  if (typeof error === "string") return error
  if (error && typeof error === "object" && "message" in error) return String((error as { message?: unknown }).message ?? "")
  return ""
}

function defaultVehicleRecognitionPrompt() {
  return DEFAULT_VEHICLE_RECOGNITION_PROMPT
}

function partRecognitionPrompt(prompt: string, categories?: PartCategoryAliasSource[]) {
  const categoryInstruction = `Allowed categories: ${categoryRecognitionList(categories)}. Use exactly one of these category ids.`
  return [prompt || defaultPartRecognitionPrompt(categories), categoryInstruction].filter(Boolean).join("\n")
}

function defaultPartRecognitionPrompt(categories?: PartCategoryAliasSource[]) {
  return [
    "You identify uploaded car modification part reference images.",
    "Return strict JSON only.",
    `category must be one of: ${categoryRecognitionList(categories)}.`,
    "Also return confidence, visualFeatures, usableAsReference, rejectReason, brand, model, variant.",
    "If the part appears to use visible or exposed carbon fiber, include an explicit visualFeatures item such as 'visible carbon fiber' or 'exposed carbon fiber'.",
    "If the image is not a usable car part reference or category is unclear, category=unknown and explain rejectReason.",
  ].join("\n")
}
