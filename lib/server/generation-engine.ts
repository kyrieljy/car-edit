import { buildGenerationPrompt, buildRepairPrompt, evaluateGenerationResult } from "../generation-core"
import { referenceHighRiskForCategory } from "../part-category-aliases"
import type { GenerationJob, GenerationMode, GenerationPartSpec, GenerationStandardJson, PartCategory, PartReferenceRole, PartSelectionOptions, ProviderCapability, ProviderConfig, ResultCheckResult, SelectionMap, WorkflowNodeConfig } from "../types"
import { createGeneration, getCatalog, getProviderApiKey, getWorkflowConfig } from "./db"
import { invokeGenerationProvider, type GenerationProviderResponse } from "./generation-provider"
import { noopProgress, type ProgressEmitter } from "./progress-stream"
import { checkGenerationResultWithProvider } from "./vision-provider"

type RunGenerationWorkflowInput = {
  userId: string
  mode: GenerationMode
  vehicleUploadId: string
  sourceImageUrl: string
  standardJson: GenerationStandardJson
  paintId: string
  stance: number
  selections: SelectionMap
  selectionOptions?: PartSelectionOptions
  onProgress?: ProgressEmitter
}

type CallFailurePolicy = "stop" | "retry_once" | "fallback" | "retry_then_fallback"
type QualityFailurePolicy = "repair_once" | "save_bad_case" | "stop"

const MAX_TOTAL_PART_REFERENCE_UPLOADS = 16
const MAX_STRICT_CANVAS_REFERENCE_UPLOADS_PER_PART = 1
const MAX_NANO_BANANA_WS_INPUT_IMAGES = 14
const MAX_NANO_BANANA_WS_PART_REFERENCE_UPLOADS = MAX_NANO_BANANA_WS_INPUT_IMAGES - 1
const REFERENCE_ROLE_RANK: Record<PartReferenceRole, number> = {
  full_part_reference: 0,
  shape_reference: 1,
  install_context: 2,
  material_reference: 3,
  color_reference: 4,
  avoid_upload: 99,
}

export async function runGenerationWorkflow(input: RunGenerationWorkflowInput): Promise<GenerationJob> {
  const emitProgress = input.onProgress ?? noopProgress
  const catalog = getCatalog()
  const workflow = getWorkflowConfig(input.mode)
  const promptNodeIds = workflow.nodes.map((node) => node.promptTemplateId).filter(Boolean)
  const workflowTemplateIds = new Set([...workflow.promptTemplateIds, ...promptNodeIds])
  const workflowTemplates = workflowTemplateIds.size
    ? catalog.promptTemplates.filter((template) => workflowTemplateIds.has(template.id) || template.scope === "part" || template.scope === "category" || template.scope === "combo")
    : catalog.promptTemplates
  emitProgress({ step: "prompt_build" })
  const promptBuild = buildGenerationPrompt({
    spec: input.standardJson,
    preset: catalog.promptPreset,
    templates: workflowTemplates,
  })
  const imageNode = workflow.nodes.find((node) => node.type === "image_generation" && node.enabled)
  const resultCheckNode = workflow.nodes.find((node) => node.type === "result_check" && node.enabled)
  const retryNode = workflow.nodes.find((node) => node.type === "retry" && node.enabled)
  const resultCheckPrompt = nodePromptBody(resultCheckNode, workflowTemplates)
  const retryPromptTemplate = nodePromptBody(retryNode, workflowTemplates)
  const provider = resolveNodeProvider(imageNode, workflow.providerId, catalog.providers, "image_generation")
  const resultCheckProvider = resolveNodeProvider(resultCheckNode, "", catalog.providers, "vision")
  const fallbackProvider = nonMockFallback(
    provider,
    resolveNodeProvider(imageNode, workflow.fallbackProviderId, catalog.providers, "image_generation", true),
  )
  let retryCount = 0
  let failureReason = ""
  let response = provider
    ? await invokeGenerationWithCallPolicy({
        mode: input.mode,
        provider,
        fallbackProvider,
        categories: catalog.categories,
        node: imageNode,
        vehicleImageUrl: input.sourceImageUrl,
        prompt: promptBuild.prompt,
        negativePrompt: promptBuild.negativePrompt,
        standardJson: input.standardJson,
        onProgress: emitProgress,
      })
    : providerUnavailableResponse(imageNode?.providerId || workflow.providerId)

  const resultCheckEnabled = Boolean(resultCheckNode) || workflow.resultCheckEnabled
  if (response.ok && resultCheckEnabled) emitProgress({ step: "result_check", provider: resultCheckProvider?.id })
  let resultCheck = response.ok && resultCheckEnabled
    ? await evaluateGenerationResultForWorkflow({
        spec: input.standardJson,
        sourceImageUrl: input.sourceImageUrl,
        resultImageUrl: response.resultImageUrl,
        prompt: promptBuild.prompt,
        resultCheckPrompt,
        resultCheckProvider,
      })
    : null
  const maxRetries = retryNode ? retryNode.maxRetries : workflow.maxRetries
  const retryEnabled = (Boolean(retryNode) || workflow.autoRetryEnabled) && qualityFailurePolicy(resultCheckNode, retryNode) === "repair_once"
  if (response.ok && resultCheck && !resultCheck.passed && retryEnabled && maxRetries > 0) {
    const retryProvider = resolveProvider(response.provider, catalog.providers) || provider || fallbackProvider
    if (retryProvider) {
      retryCount = 1
      const repairPrompt = buildRepairPrompt(promptBuild.prompt, resultCheck, { retryPromptTemplate })
      emitProgress({ step: "provider_retry", provider: retryProvider.id, retryAttempt: retryCount, meta: { reason: "result_check_failed" } })
      response = await invokeGenerationWithCallPolicy({
        mode: input.mode,
        provider: retryProvider,
        fallbackProvider,
        categories: catalog.categories,
        node: imageNode,
        vehicleImageUrl: input.sourceImageUrl,
        prompt: repairPrompt,
        negativePrompt: promptBuild.negativePrompt,
        standardJson: input.standardJson,
        onProgress: emitProgress,
      })
      if (response.ok && resultCheckEnabled) emitProgress({ step: "result_check", provider: resultCheckProvider?.id })
      resultCheck = response.ok && resultCheckEnabled
        ? await evaluateGenerationResultForWorkflow({
            spec: input.standardJson,
            sourceImageUrl: input.sourceImageUrl,
            resultImageUrl: response.resultImageUrl,
            prompt: repairPrompt,
            resultCheckPrompt,
            resultCheckProvider,
          })
        : resultCheck
    }
  }

  if (!response.ok) {
    failureReason = response.error || "Generation provider failed."
  } else if (resultCheck && !resultCheck.passed) {
    failureReason = resultCheck.summary
  }

  emitProgress({ step: "save_record" })
  const generation = createGeneration({
    userId: input.userId,
    mode: input.mode,
    provider: response.provider,
    vehicleUploadId: input.vehicleUploadId,
    sourceImageUrl: input.sourceImageUrl,
    resultImageUrl: response.ok ? response.resultImageUrl : "",
    paintId: input.paintId,
    stance: input.stance,
    selections: input.selections,
    selectionOptions: input.selectionOptions ?? {},
    standardJson: input.standardJson,
    workflowId: workflow.id,
    promptVersion: `${workflow.id}:${promptBuild.promptVersion}${qualityPromptVersion(resultCheckNode, retryNode)}`,
    promptSummary: promptBuild.summary,
    promptHidden: promptBuild.prompt,
    resultCheck: resultCheck ?? undefined,
    retryCount,
    failureReason,
    status: failureReason ? "failed" : "succeeded",
    costCents: response.costCents,
    usageUnits: response.usageUnits,
    badCaseTags: resultCheck?.badCaseTags ?? [],
  })
  emitProgress({ step: "complete" })
  return generation
}

export function previewGenerationWorkflow(input: RunGenerationWorkflowInput) {
  const catalog = getCatalog()
  const workflow = getWorkflowConfig(input.mode)
  const promptNodeIds = workflow.nodes.map((node) => node.promptTemplateId).filter(Boolean)
  const workflowTemplateIds = new Set([...workflow.promptTemplateIds, ...promptNodeIds])
  const workflowTemplates = workflowTemplateIds.size
    ? catalog.promptTemplates.filter((template) => workflowTemplateIds.has(template.id) || template.scope === "part" || template.scope === "category" || template.scope === "combo")
    : catalog.promptTemplates
  const promptBuild = buildGenerationPrompt({
    spec: input.standardJson,
    preset: catalog.promptPreset,
    templates: workflowTemplates,
  })
  const imageNode = workflow.nodes.find((node) => node.type === "image_generation" && node.enabled)
  const provider = resolveNodeProvider(imageNode, workflow.providerId, catalog.providers, "image_generation")
  const fallbackProvider = nonMockFallback(
    provider,
    resolveNodeProvider(imageNode, workflow.fallbackProviderId, catalog.providers, "image_generation", true),
  )
  const effectiveProvider = provider || fallbackProvider
  return {
    dryRun: true,
    workflowId: workflow.id,
    provider: effectiveProvider?.id || imageNode?.providerId || workflow.providerId,
    providerLabel: effectiveProvider?.label || "",
    sourceImageUrl: input.sourceImageUrl,
    partImageUrls: partImageUrlsForProvider(input.standardJson, input.mode, effectiveProvider, catalog.categories),
    promptVersion: `${workflow.id}:${promptBuild.promptVersion}`,
    promptSummary: promptBuild.summary,
    promptHidden: promptBuild.prompt,
    negativePrompt: promptBuild.negativePrompt,
    standardJson: input.standardJson,
  }
}

type PartReferenceBucket = {
  partIndex: number
  category: string
  highRisk: boolean
  references: ProviderReferenceCandidate[]
}

type ProviderReferenceCandidate = {
  url: string
  role: PartReferenceRole
  priority: number
  originalIndex: number
}

export function partImageUrlsForProvider(spec: GenerationStandardJson, mode: GenerationMode, provider: ProviderConfig | undefined, categories: PartCategory[] = []) {
  const maxReferencesPerPart = strictCanvasReferenceBudget(mode, provider) ? MAX_STRICT_CANVAS_REFERENCE_UPLOADS_PER_PART : Number.POSITIVE_INFINITY
  const maxTotalReferences = maxTotalPartReferenceUploads(provider)
  return allocateProviderPartImageUrls(spec.parts, maxTotalReferences, maxReferencesPerPart, categories, {
    includeNormalExtraReferences: !isNanoBananaWsProvider(provider),
  })
}

function allocateProviderPartImageUrls(
  parts: GenerationPartSpec[],
  maxTotalReferences: number,
  maxReferencesPerPart: number,
  categories: PartCategory[],
  options: { includeNormalExtraReferences: boolean },
) {
  const buckets = parts
    .map((part, partIndex): PartReferenceBucket => {
      const references = referencesForProviderPart(part)
      return {
        partIndex,
        category: part.category,
        highRisk: referenceHighRiskForCategory(part.category, categories),
        references,
      }
    })
    .filter((bucket) => bucket.references.length > 0)
  const selected: string[] = []
  const seen = new Set<string>()
  const perPartCount = new Map<number, number>()

  const addCandidate = (bucket: PartReferenceBucket, candidate: ProviderReferenceCandidate | undefined) => {
    if (!candidate || selected.length >= maxTotalReferences) return
    const currentCount = perPartCount.get(bucket.partIndex) ?? 0
    if (currentCount >= maxReferencesPerPart || seen.has(candidate.url)) return
    selected.push(candidate.url)
    seen.add(candidate.url)
    perPartCount.set(bucket.partIndex, currentCount + 1)
  }

  for (const bucket of buckets) {
    addCandidate(bucket, bucket.references[0])
  }

  addExtraReferences(buckets.filter((bucket) => bucket.highRisk), addCandidate)
  if (options.includeNormalExtraReferences) addExtraReferences(buckets.filter((bucket) => !bucket.highRisk), addCandidate)

  return selected
}

function addExtraReferences(
  buckets: PartReferenceBucket[],
  addCandidate: (bucket: PartReferenceBucket, candidate: ProviderReferenceCandidate | undefined) => void,
) {
  const maxReferenceCount = Math.max(0, ...buckets.map((bucket) => bucket.references.length))
  for (let referenceIndex = 1; referenceIndex < maxReferenceCount; referenceIndex += 1) {
    for (const bucket of buckets) {
      addCandidate(bucket, bucket.references[referenceIndex])
    }
  }
}

function referencesForProviderPart(part: GenerationPartSpec) {
  const candidates = (part.referenceImages ?? [])
    .filter((reference) => reference.uploadToModel !== false && reference.role !== "avoid_upload" && reference.url)
    .map((reference, index): ProviderReferenceCandidate => ({
      url: reference.url,
      role: reference.role,
      priority: reference.priority,
      originalIndex: index,
    }))
    .sort(compareProviderReferences)
  const unique = uniqueReferenceCandidates(candidates)
  if (unique.length) return unique
  return part.referenceImageUrl
    ? [
        {
          url: part.referenceImageUrl,
          role: "full_part_reference" as PartReferenceRole,
          priority: 0,
          originalIndex: 0,
        },
      ]
    : []
}

function uniqueReferenceCandidates(candidates: ProviderReferenceCandidate[]) {
  const seen = new Set<string>()
  return candidates.filter((candidate) => {
    if (seen.has(candidate.url)) return false
    seen.add(candidate.url)
    return true
  })
}

function compareProviderReferences(left: ProviderReferenceCandidate, right: ProviderReferenceCandidate) {
  return (
    left.priority - right.priority ||
    (REFERENCE_ROLE_RANK[left.role] ?? 50) - (REFERENCE_ROLE_RANK[right.role] ?? 50) ||
    left.originalIndex - right.originalIndex ||
    left.url.localeCompare(right.url)
  )
}

function maxTotalPartReferenceUploads(provider: ProviderConfig | undefined) {
  return isNanoBananaWsProvider(provider) ? MAX_NANO_BANANA_WS_PART_REFERENCE_UPLOADS : MAX_TOTAL_PART_REFERENCE_UPLOADS
}

function isNanoBananaWsProvider(provider: ProviderConfig | undefined) {
  if (!provider) return false
  try {
    const url = new URL(provider.baseUrl)
    const host = url.hostname.toLowerCase()
    return (host === "api.302.ai" || host === "api.302ai.cn") && url.pathname.endsWith("/ws/api/v3/google/nano-banana-2/edit")
  } catch {
    return provider.baseUrl.includes("/ws/api/v3/google/nano-banana-2/edit")
  }
}

function strictCanvasReferenceBudget(mode: GenerationMode, provider: ProviderConfig | undefined) {
  if (!provider) return false
  return isGptImageProvider(provider)
}

function isGptImageProvider(provider: ProviderConfig) {
  const descriptor = providerDescriptor(provider)
  const modelAndLabel = `${provider.id} ${provider.label} ${provider.modelName}`.toLowerCase()
  if (provider.id === "openai") return true
  if (descriptor.includes("gpt-image") || descriptor.includes("gpt image") || descriptor.includes("gpt_image") || descriptor.includes("openai/gpt-image")) return true
  return is302OpenAiImageEndpoint(provider.baseUrl) && modelAndLabel.includes("gpt") && modelAndLabel.includes("image")
}

function is302OpenAiImageEndpoint(baseUrl: string) {
  const endpoint = providerImageEndpoint(baseUrl)
  try {
    const url = new URL(endpoint)
    const host = url.hostname.toLowerCase()
    return (host === "api.302.ai" || host === "api.302ai.cn") && (url.pathname.endsWith("/images/edits") || url.pathname.endsWith("/images/generations"))
  } catch {
    const normalized = endpoint.toLowerCase()
    return (normalized.includes("api.302.ai") || normalized.includes("api.302ai.cn")) && (normalized.includes("/images/edits") || normalized.includes("/images/generations"))
  }
}

function providerImageEndpoint(baseUrl: string) {
  const normalized = (baseUrl || "").replace(/\/+$/, "")
  if (normalized.endsWith("/images/edits") || normalized.endsWith("/images/generations")) return normalized
  return `${normalized}/images/edits`
}

function providerDescriptor(provider: ProviderConfig) {
  return `${provider.id} ${provider.label} ${provider.modelName} ${provider.baseUrl}`.toLowerCase()
}

function nodePromptBody(node: WorkflowNodeConfig | undefined, templates: Array<{ id: string; body: string; active: boolean }>) {
  if (!node?.promptTemplateId) return ""
  return templates.find((template) => template.id === node.promptTemplateId && template.active)?.body || ""
}

async function evaluateGenerationResultForWorkflow(input: {
  spec: GenerationStandardJson
  sourceImageUrl: string
  resultImageUrl: string
  prompt: string
  resultCheckPrompt: string
  resultCheckProvider: ProviderConfig | undefined
}): Promise<ResultCheckResult> {
  const localCheck = evaluateGenerationResult(input.spec, input.resultImageUrl, { resultCheckPrompt: input.resultCheckPrompt })
  if (!localCheck.passed) return localCheck
  const provider = input.resultCheckProvider
  if (!provider || provider.id === "mock-vision" || provider.baseUrl.startsWith("local://")) {
    return {
      ...localCheck,
      summary: localCheck.summary || "Local smoke result check passed. No vision model was called.",
    }
  }

  const response = await checkGenerationResultWithProvider({
    provider,
    apiKey: getProviderApiKey(provider.id),
    sourceImageUrl: input.sourceImageUrl,
    resultImageUrl: input.resultImageUrl,
    standardJson: input.spec,
    prompt: input.prompt,
    resultCheckPrompt: input.resultCheckPrompt,
  })
  if (!response.ok) {
    return {
      ...localCheck,
      summary: response.error ? `Vision result check unavailable: ${response.error}` : localCheck.summary,
    }
  }
  return response.result
}

function qualityPromptVersion(resultCheckNode: WorkflowNodeConfig | undefined, retryNode: WorkflowNodeConfig | undefined) {
  const ids = [resultCheckNode?.promptTemplateId, retryNode?.promptTemplateId].filter(Boolean)
  return ids.length ? `;quality:${ids.join(",")}` : ""
}

async function invokeGenerationWithCallPolicy(input: {
  mode: GenerationMode
  provider: ProviderConfig
  fallbackProvider: ProviderConfig | undefined
  categories: PartCategory[]
  node: WorkflowNodeConfig | undefined
  vehicleImageUrl: string
  prompt: string
  negativePrompt: string
  standardJson: GenerationStandardJson
  onProgress?: ProgressEmitter
}): Promise<GenerationProviderResponse> {
  const policy = callFailurePolicy(input.node, Boolean(input.fallbackProvider))
  const emitProgress = input.onProgress ?? noopProgress
  const requestForProvider = (provider: ProviderConfig) => ({
    mode: input.mode,
    vehicleImageUrl: input.vehicleImageUrl,
    partImageUrls: partImageUrlsForProvider(input.standardJson, input.mode, provider, input.categories),
    prompt: input.prompt,
    negativePrompt: input.negativePrompt,
    standardJson: input.standardJson,
  })
  emitProgress({ step: "image_generation", provider: input.provider.id, retryAttempt: 0 })
  let response = await invokeGenerationProvider({ ...requestForProvider(input.provider), provider: input.provider, retryAttempt: 0 })
  if (!response.ok && providerConfigurationError(response.error)) return response
  if (!response.ok && providerSubmittedAsyncTaskError(response.error)) return response

  if (!response.ok && (policy === "retry_once" || policy === "retry_then_fallback" || providerTransientHttpError(response.error))) {
    emitProgress({ step: "provider_retry", provider: input.provider.id, retryAttempt: 1, meta: { reason: response.error } })
    response = await invokeGenerationProvider({ ...requestForProvider(input.provider), provider: input.provider, retryAttempt: 1 })
    if (!response.ok && providerConfigurationError(response.error)) return response
    if (!response.ok && providerSubmittedAsyncTaskError(response.error)) return response
  }

  if (!response.ok && input.fallbackProvider && (policy === "fallback" || policy === "retry_then_fallback")) {
    emitProgress({ step: "provider_fallback", provider: input.fallbackProvider.id, retryAttempt: 0, meta: { from: input.provider.id, reason: response.error } })
    response = await invokeGenerationProvider({ ...requestForProvider(input.fallbackProvider), provider: input.fallbackProvider, retryAttempt: 0 })
  }

  return response
}

function providerConfigurationError(error: string | undefined) {
  if (!error) return false
  return ["API Key", "未配置", "未启用", "model", "模型名称"].some((term) => error.includes(term))
}

function providerSubmittedAsyncTaskError(error: string | undefined) {
  if (!error) return false
  return error.includes("Nano-Banana-2 task completed but did not return")
}

function providerTransientHttpError(error: string | undefined) {
  if (!error) return false
  return /HTTP\s+(?:408|429|5\d\d)\b/i.test(error) || /temporarily unavailable|Bad Gateway|Gateway Timeout|ECONNRESET|ETIMEDOUT/i.test(error)
}

function callFailurePolicy(node: WorkflowNodeConfig | undefined, hasFallback: boolean): CallFailurePolicy {
  const configured = typeof node?.config?.callFailurePolicy === "string" ? node.config.callFailurePolicy : ""
  if (configured === "stop" || configured === "retry_once" || configured === "fallback" || configured === "retry_then_fallback") {
    return configured
  }
  if (!node?.providerCapability) return "stop"
  return hasFallback ? "fallback" : "retry_once"
}

function qualityFailurePolicy(
  resultCheckNode: WorkflowNodeConfig | undefined,
  retryNode: WorkflowNodeConfig | undefined,
): QualityFailurePolicy {
  const configured =
    typeof retryNode?.config?.qualityFailurePolicy === "string"
      ? retryNode.config.qualityFailurePolicy
      : typeof resultCheckNode?.config?.qualityFailurePolicy === "string"
        ? resultCheckNode.config.qualityFailurePolicy
        : ""
  if (configured === "repair_once" || configured === "save_bad_case" || configured === "stop") return configured
  return retryNode?.enabled ? "repair_once" : "save_bad_case"
}

function resolveNodeProvider(
  node: WorkflowNodeConfig | undefined,
  fallbackId: string,
  providers: ProviderConfig[],
  capability: ProviderCapability,
  useFallback = false,
) {
  const providerId = useFallback ? node?.fallbackProviderId || fallbackId : node?.providerId || fallbackId
  return resolveProvider(providerId, providers, capability)
}

function resolveProvider(providerId: string, providers: ProviderConfig[], capability?: ProviderCapability) {
  return providers.find((provider) => provider.id === providerId && provider.enabled && (!capability || provider.capabilities.includes(capability)))
}

function nonMockFallback(provider: ProviderConfig | undefined, fallbackProvider: ProviderConfig | undefined) {
  if (!provider || provider.id === "mock") return fallbackProvider
  if (fallbackProvider?.id === "mock" || fallbackProvider?.baseUrl.startsWith("local://")) return undefined
  return fallbackProvider
}

function providerUnavailableResponse(providerId: string) {
  return {
    ok: false,
    provider: providerId as ProviderConfig["id"],
    resultImageUrl: "",
    latencyMs: 0,
    usageUnits: 0,
    costCents: 0,
    rawResponse: {
      provider: providerId,
      reason: "Workflow provider is disabled or not configured in Model API.",
    },
    error: "Workflow provider is disabled or not configured in Model API.",
  }
}
