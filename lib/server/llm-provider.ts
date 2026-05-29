import { getProviderApiKey } from "./db"
import type {
  ChatFallbackIntent,
  ChatIntentParseResult,
  GenerationPartSpec,
  GenerationStandardJson,
  PartAsset,
  PartCategory,
  PartColorPolicy,
  PartReferenceRole,
  ProviderConfig,
  ProviderId,
} from "../types"

type LlmIntentRequest = {
  provider: ProviderConfig
  prompt: string
  sourceImageUrl: string
  text: string
  contextMode: "latest" | "original"
  partReferences: Array<{
    url: string
    fileName: string
    category?: string
    categoryLabel?: string
    brand?: string
    model?: string
    variant?: string
    confidence?: number
    visualFeatures?: string[]
  }>
  categories: PartCategory[]
  assets?: PartAsset[]
  vehicleRecognition?: { model: string; view?: string; confidence?: number }
}

type LlmFallbackIntentRequest = LlmIntentRequest & {
  localMissingFields: string[]
  localFollowUpQuestion?: string
}

type LlmIntentResponse =
  | { ok: true; provider: ProviderId; result: ChatIntentParseResult; latencyMs: number; rawResponse: Record<string, unknown> }
  | { ok: false; provider: ProviderId; error: string; latencyMs: number; rawResponse: Record<string, unknown> }

type LlmFallbackIntentResponse =
  | { ok: true; provider: ProviderId; result: ChatFallbackIntent; latencyMs: number; rawResponse: Record<string, unknown> }
  | { ok: false; provider: ProviderId; error: string; latencyMs: number; rawResponse: Record<string, unknown> }

type LlmProviderErrorResponse = { ok: false; provider: ProviderId; error: string; latencyMs: number; rawResponse: Record<string, unknown> }

const LLM_PROVIDER_TIMEOUT_MS = 60_000
const referenceRoles: PartReferenceRole[] = ["shape_reference", "material_reference", "color_reference", "install_context", "full_part_reference", "avoid_upload"]

export async function parseChatFallbackIntentWithLlmProvider(input: LlmFallbackIntentRequest): Promise<LlmFallbackIntentResponse> {
  const started = Date.now()
  if (input.provider.id === "mock-llm" || input.provider.baseUrl.startsWith("local://")) {
    return llmError(input.provider, started, "Mock LLM provider is not callable.", { provider: input.provider.id, mock: true })
  }
  if (process.env.DISABLE_EXTERNAL_AI === "1") {
    return llmError(input.provider, started, "External AI calls are disabled by DISABLE_EXTERNAL_AI=1.", { provider: input.provider.id })
  }
  if (!input.provider.enabled) return llmError(input.provider, started, "LLM provider is disabled.")
  if (!input.provider.modelName.trim()) return llmError(input.provider, started, "LLM provider model name is empty.")
  const apiKey = getProviderApiKey(input.provider.id)
  if (!apiKey) return llmError(input.provider, started, "LLM provider API key is missing.")

  const response = await fetchWithTimeout(
    chatCompletionsEndpoint(input.provider.baseUrl),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: input.provider.modelName,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: input.prompt || defaultFallbackIntentPrompt(),
          },
          {
            role: "user",
            content: JSON.stringify(
              {
                userText: input.text,
                sourceImageUrl: input.sourceImageUrl,
                vehicleRecognition: input.vehicleRecognition
                  ? {
                      view: input.vehicleRecognition.view,
                      confidence: input.vehicleRecognition.confidence,
                    }
                  : undefined,
                contextMode: input.contextMode,
                localMissingFields: input.localMissingFields,
                localFollowUpQuestion: input.localFollowUpQuestion,
                partReferences: input.partReferences,
                categories: input.categories.map((category) => ({
                  id: category.id,
                  label: category.label,
                  labelZh: category.labelZh,
                  labelEn: category.labelEn,
                })),
                assetCandidates: (input.assets ?? []).map((asset) => ({
                  id: asset.id,
                  categoryId: asset.categoryId,
                  brand: asset.brand,
                  model: asset.model,
                  variant: asset.variant,
                  generationReady: asset.generationReady,
                })),
              },
              null,
              2,
            ),
          },
        ],
      }),
    },
    LLM_PROVIDER_TIMEOUT_MS,
  )

  const raw = (await response.json().catch(() => ({}))) as Record<string, unknown>
  if (!response.ok) return llmError(input.provider, started, providerErrorMessage(raw) || `LLM provider HTTP ${response.status}`, raw)
  const parsed = parseJsonObject(extractMessageContent(raw))
  if (!parsed) return llmError(input.provider, started, "LLM provider did not return a JSON object.", raw)
  return {
    ok: true,
    provider: input.provider.id,
    result: normalizeChatFallbackIntent(parsed),
    latencyMs: Date.now() - started,
    rawResponse: raw,
  }
}

export async function parseChatIntentWithLlmProvider(input: LlmIntentRequest): Promise<LlmIntentResponse> {
  const started = Date.now()
  if (input.provider.id === "mock-llm" || input.provider.baseUrl.startsWith("local://")) {
    return llmError(input.provider, started, "Mock LLM provider is not callable.", { provider: input.provider.id, mock: true })
  }
  if (process.env.DISABLE_EXTERNAL_AI === "1") {
    return llmError(input.provider, started, "External AI calls are disabled by DISABLE_EXTERNAL_AI=1.", { provider: input.provider.id })
  }
  if (!input.provider.enabled) return llmError(input.provider, started, "LLM provider is disabled.")
  if (!input.provider.modelName.trim()) return llmError(input.provider, started, "LLM provider model name is empty.")
  const apiKey = getProviderApiKey(input.provider.id)
  if (!apiKey) return llmError(input.provider, started, "LLM provider API key is missing.")

  const response = await fetchWithTimeout(
    chatCompletionsEndpoint(input.provider.baseUrl),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: input.provider.modelName,
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: input.prompt || defaultIntentPrompt(),
          },
          {
            role: "user",
            content: JSON.stringify(
              {
                userText: input.text,
                sourceImageUrl: input.sourceImageUrl,
                vehicleRecognition: input.vehicleRecognition
                  ? {
                      view: input.vehicleRecognition.view,
                      confidence: input.vehicleRecognition.confidence,
                    }
                  : undefined,
                contextMode: input.contextMode,
                partReferences: input.partReferences,
                assetCandidates: (input.assets ?? []).map((asset) => ({
                  id: asset.id,
                  categoryId: asset.categoryId,
                  brand: asset.brand,
                  model: asset.model,
                  variant: asset.variant,
                  generationReady: asset.generationReady,
                })),
                categories: input.categories.map((category) => ({
                  id: category.id,
                  label: category.label,
                  labelZh: category.labelZh,
                  labelEn: category.labelEn,
                })),
              },
              null,
              2,
            ),
          },
        ],
      }),
    },
    LLM_PROVIDER_TIMEOUT_MS,
  )

  const raw = (await response.json().catch(() => ({}))) as Record<string, unknown>
  if (!response.ok) return llmError(input.provider, started, providerErrorMessage(raw) || `LLM provider HTTP ${response.status}`, raw)

  const parsed = parseJsonObject(extractMessageContent(raw))
  if (!parsed) return llmError(input.provider, started, "LLM provider did not return a JSON object.", raw)
  const result = normalizeChatIntentParseResult(parsed, input)
  if (result.status === "ready" && !result.standardJson) {
    return llmError(input.provider, started, "LLM provider returned ready without standardJson.", raw)
  }

  return {
    ok: true,
    provider: input.provider.id,
    result,
    latencyMs: Date.now() - started,
    rawResponse: raw,
  }
}

function llmError(provider: ProviderConfig, started: number, error: string, rawResponse: Record<string, unknown> = {}): LlmProviderErrorResponse {
  return {
    ok: false,
    provider: provider.id,
    error,
    latencyMs: Date.now() - started,
    rawResponse,
  }
}

function normalizeChatIntentParseResult(input: Record<string, unknown>, request: LlmIntentRequest): ChatIntentParseResult {
  const status = normalizeStatus(input.status)
  const standardJson = normalizeStandardJson(input.standardJson, request)
  return {
    status,
    standardJson: status === "ready" ? standardJson : undefined,
    followUpQuestion: cleanString(input.followUpQuestion),
    missingFields: Array.isArray(input.missingFields) ? input.missingFields.map(String).filter(Boolean) : [],
    reason: cleanString(input.reason),
    confidence: clamp(Number(input.confidence ?? 0.7), 0, 1),
    normalizedText: cleanString(input.normalizedText) || request.text,
  }
}

function normalizeChatFallbackIntent(input: Record<string, unknown>): ChatFallbackIntent {
  const paint = normalizeFallbackPaint(input.paint)
  const stance = normalizeFallbackStance(input.stance)
  const requestedCategories = normalizeFallbackCategoryList(input.requestedCategories)
  const uploadedReferenceCategories = normalizeFallbackReferenceCategoryList(input.uploadedReferenceCategories)
  const hasModificationIntent = Boolean(input.hasModificationIntent) && Boolean(paint || stance || requestedCategories.length || uploadedReferenceCategories.length)
  return {
    hasModificationIntent,
    ...(paint ? { paint } : {}),
    ...(stance ? { stance } : {}),
    ...(requestedCategories.length ? { requestedCategories } : {}),
    ...(uploadedReferenceCategories.length ? { uploadedReferenceCategories } : {}),
    clarificationQuestion: cleanString(input.clarificationQuestion),
    reason: cleanString(input.reason),
    confidence: clamp(Number(input.confidence ?? 0), 0, 1),
  }
}

function normalizeFallbackPaint(value: unknown): ChatFallbackIntent["paint"] | undefined {
  const paint = value && typeof value === "object" ? (value as { action?: unknown; target?: unknown; confidence?: unknown }) : null
  if (!paint || paint.action !== "change") return undefined
  const target = cleanString(paint.target)
  if (!target) return undefined
  return { action: "change", target, confidence: clamp(Number(paint.confidence ?? 0), 0, 1) }
}

function normalizeFallbackStance(value: unknown): ChatFallbackIntent["stance"] | undefined {
  const stance = value && typeof value === "object" ? (value as { value?: unknown; label?: unknown; confidence?: unknown }) : null
  if (!stance) return undefined
  const stanceValue = Number(stance.value)
  if (!Number.isFinite(stanceValue)) return undefined
  return { value: clamp(stanceValue, 0, 100), label: cleanString(stance.label), confidence: clamp(Number(stance.confidence ?? 0), 0, 1) }
}

function normalizeFallbackCategoryList(value: unknown): NonNullable<ChatFallbackIntent["requestedCategories"]> {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => (item && typeof item === "object" ? (item as { categoryId?: unknown; confidence?: unknown }) : null))
    .filter((item): item is { categoryId?: unknown; confidence?: unknown } => Boolean(item))
    .map((item) => ({ categoryId: cleanString(item.categoryId), confidence: clamp(Number(item.confidence ?? 0), 0, 1) }))
    .filter((item) => item.categoryId)
}

function normalizeFallbackReferenceCategoryList(value: unknown): NonNullable<ChatFallbackIntent["uploadedReferenceCategories"]> {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => (item && typeof item === "object" ? (item as { fileName?: unknown; categoryId?: unknown; confidence?: unknown }) : null))
    .filter((item): item is { fileName?: unknown; categoryId?: unknown; confidence?: unknown } => Boolean(item))
    .map((item) => ({ fileName: cleanString(item.fileName), categoryId: cleanString(item.categoryId), confidence: clamp(Number(item.confidence ?? 0), 0, 1) }))
    .filter((item) => item.fileName && item.categoryId)
}

function normalizeStandardJson(value: unknown, request: LlmIntentRequest): GenerationStandardJson | undefined {
  if (!value || typeof value !== "object") return undefined
  const spec = value as Partial<GenerationStandardJson>
  if (!spec.vehicle || !spec.paint || !spec.stance || !Array.isArray(spec.parts)) return undefined
  return {
    mode: "chat",
    vehicle: {
      model: "User uploaded vehicle, preserve exact identity",
      view: String(spec.vehicle.view || "front three-quarter"),
      sourceImageUrl: request.sourceImageUrl,
      confidence: clamp(Number(spec.vehicle.confidence ?? 0.78), 0, 1),
    },
    paint: normalizePaint(spec.paint),
    stance: normalizeStance(spec.stance),
    parts: spec.parts.map((part, index) => normalizePartSpec(part, index, request)),
    style: {
      keywords: Array.isArray(spec.style?.keywords) ? spec.style.keywords.map(String) : [],
      userText: String(spec.style?.userText || request.text),
      contextMode: request.contextMode,
    },
    constraints: {
      preserveBackground: spec.constraints?.preserveBackground !== false,
      preserveCameraAngle: spec.constraints?.preserveCameraAngle !== false,
      preserveLighting: spec.constraints?.preserveLighting !== false,
      preserveLicensePlateShape: spec.constraints?.preserveLicensePlateShape !== false,
      preserveVehicleIdentity: spec.constraints?.preserveVehicleIdentity !== false,
      preserveUnselectedParts: spec.constraints?.preserveUnselectedParts !== false,
      selectedOnly: spec.constraints?.selectedOnly !== false,
    },
  }
}

function normalizePartSpec(value: unknown, index: number, request: LlmIntentRequest): GenerationPartSpec {
  const part = value && typeof value === "object" ? (value as Partial<GenerationPartSpec>) : {}
  const category = cleanString(part.category) || "free-text"
  const categoryLabel = cleanString(part.categoryLabel) || category
  const colorPolicy = normalizeColorPolicy(part.colorPolicy) ?? inferColorPolicy(request.text, category)
  return {
    category,
    categoryLabel,
    source: part.source === "asset_library" || part.source === "uploaded_reference" || part.source === "free_text" ? part.source : "free_text",
    assetId: cleanString(part.assetId),
    brand: cleanString(part.brand),
    model: cleanString(part.model),
    variant: cleanString(part.variant) || `LLM part ${index + 1}`,
    color: cleanString(part.color),
    finish: cleanString(part.finish),
    colorPolicy,
    colorPolicyPrompt: cleanString(part.colorPolicyPrompt) || colorPolicyInstruction(colorPolicy, categoryLabel),
    referenceImageUrl: cleanString(part.referenceImageUrl),
    referenceImages: Array.isArray(part.referenceImages)
      ? part.referenceImages.map((reference, referenceIndex) => ({
          url: cleanString(reference.url),
          role: normalizeReferenceRole(reference.role),
          view: cleanString(reference.view) || "llm",
          promptHint: cleanString(reference.promptHint),
          priority: Number.isFinite(Number(reference.priority)) ? Number(reference.priority) : referenceIndex + 1,
          uploadToModel: reference.uploadToModel !== false,
        }))
      : [],
    instruction: cleanString(part.instruction) || `Modify only the ${categoryLabel} according to the user request.`,
  }
}

function normalizePaint(value: unknown): GenerationStandardJson["paint"] {
  const paint = value && typeof value === "object" ? (value as Partial<GenerationStandardJson["paint"]>) : {}
  const action = paint.action === "change" ? "change" : "keep_original"
  return {
    action,
    target: cleanString(paint.target) || (action === "change" ? "Requested paint" : "Factory paint"),
    prompt: cleanString(paint.prompt) || (action === "change" ? "Apply the requested body paint change." : "Keep the original body paint."),
  }
}

function normalizeStance(value: unknown): GenerationStandardJson["stance"] {
  const stance = value && typeof value === "object" ? (value as Partial<GenerationStandardJson["stance"]>) : {}
  const stanceValue = clamp(Number(stance.value ?? 0), 0, 100)
  return {
    value: stanceValue,
    label: cleanString(stance.label) || (stanceValue <= 0 ? "preserve original ride height" : stanceValue > 74 ? "aggressive track stance" : stanceValue > 45 ? "flush lowered stance" : "OEM-plus stance"),
    prompt: cleanString(stance.prompt) || (stanceValue <= 0 ? "" : `Apply stance level ${stanceValue}.`),
  }
}

function normalizeStatus(value: unknown): ChatIntentParseResult["status"] {
  return value === "ready" || value === "needs_followup" || value === "rejected" ? value : "needs_followup"
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
      throw new Error(`LLM provider request timed out after ${Math.round(timeoutMs / 1000)}s: ${String(input)}`)
    }
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

function extractMessageContent(raw: Record<string, unknown>) {
  const choices = Array.isArray(raw.choices) ? raw.choices : []
  const first = choices[0] as { message?: { content?: unknown } } | undefined
  const content = first?.message?.content
  return typeof content === "string" ? content : ""
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

function providerErrorMessage(raw: Record<string, unknown>) {
  const error = raw.error
  if (typeof error === "string") return error
  if (error && typeof error === "object" && "message" in error) return String((error as { message?: unknown }).message ?? "")
  return ""
}

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

function normalizeReferenceRole(value: unknown): PartReferenceRole {
  return referenceRoles.includes(value as PartReferenceRole) ? (value as PartReferenceRole) : "full_part_reference"
}

function normalizeColorPolicy(value: unknown): PartColorPolicy | undefined {
  return value === "body_color" || value === "exposed_carbon" || value === "part_reference_color" ? value : undefined
}

function inferColorPolicy(text: string, category: string): PartColorPolicy {
  if (category === "hood") {
    if (/exposed carbon|bare carbon|visible carbon|carbon hood|裸碳|露碳|碳盖|碳蓋/i.test(text)) return "exposed_carbon"
    return "body_color"
  }
  return "part_reference_color"
}

function colorPolicyInstruction(policy: PartColorPolicy, categoryLabel: string) {
  if (policy === "body_color") return `Paint-match the ${categoryLabel} to the source vehicle body color; do not show carbon weave on this part.`
  if (policy === "exposed_carbon") return `Use visible exposed carbon fiber weave only on the ${categoryLabel}; do not spread carbon texture to any unselected part.`
  return `Follow the selected reference color and material only for the ${categoryLabel}.`
}

function defaultIntentPrompt() {
  return [
    "You parse car modification requests into strict JSON.",
    "The first uploaded image is the vehicle canvas. Later uploaded images are part references only.",
    "Output only JSON: { \"status\": \"ready\" | \"needs_followup\" | \"rejected\", \"standardJson\": object, \"followUpQuestion\": string, \"missingFields\": string[], \"reason\": string, \"confidence\": number, \"normalizedText\": string }.",
    "For every standardJson.parts item include colorPolicy and colorPolicyPrompt. Hood defaults to body_color unless the user asks for exposed/bare/visible carbon, 裸碳, or 露碳.",
    "If required information is missing, return needs_followup with one concise question.",
  ].join("\n")
}

function defaultFallbackIntentPrompt() {
  return [
    "You are a conservative fallback parser for a car modification chat workflow.",
    "Return only JSON with this shape: { \"hasModificationIntent\": boolean, \"paint\": { \"action\": \"change\", \"target\": string, \"confidence\": number }, \"stance\": { \"value\": number, \"label\": string, \"confidence\": number }, \"requestedCategories\": [{ \"categoryId\": string, \"confidence\": number }], \"uploadedReferenceCategories\": [{ \"fileName\": string, \"categoryId\": string, \"confidence\": number }], \"clarificationQuestion\": string, \"reason\": string, \"confidence\": number }.",
    "Only extract modification facts that are explicitly present or strongly implied by the user text or uploaded reference metadata.",
    "Do not output standardJson. Do not create brands, assetIds, vehicle models, reference URLs, colorPolicy, or prompts.",
    "For stance, map only to these values: 25=slightly raised, 50=slightly lowered, 70=flush fitment, 90=air suspension aired-out/tire tuck. If unclear, omit stance.",
    "Use only category ids present in the provided categories list. For uploadedReferenceCategories, use only exact fileName values from provided partReferences.",
    "If a category is requested but no precise catalog asset or uploaded reference is available, still output the category id; local validation will ask for reference images.",
    "If uncertain, set hasModificationIntent=false, confidence below 0.72, and provide a short clarificationQuestion.",
  ].join("\n")
}
