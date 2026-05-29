import { NextResponse } from "next/server"
import { authErrorResponse, requireUser } from "@/lib/server/auth"
import { applyFallbackIntentToChatParseInput, hasChatStanceRequestText, parseChatIntent, type ChatPartReferenceInput, type ChatVehicleRecognitionInput } from "@/lib/generation-core"
import { categoryIdFromAliasText } from "@/lib/part-category-aliases"
import {
  checkAndConsumeEntitlement,
  createChatExchange,
  createVehicleUpload,
  findGenerationByResultImageUrl,
  getCatalog,
  getChatMessages,
  getProviderApiKey,
  getWorkflowConfig,
  getWorkflowConfigByMode,
  listChatSessions,
  refundEntitlementUsage,
} from "@/lib/server/db"
import { previewGenerationWorkflow, runGenerationWorkflow } from "@/lib/server/generation-engine"
import { isProviderSafetyBlockMessage, providerSafetyBlockMessage } from "@/lib/server/generation-provider"
import { runMockGuardrail } from "@/lib/server/guardrail"
import { readImageAsset } from "@/lib/server/image-assets"
import { materializeImageUrl } from "@/lib/server/image-materializer"
import { parseChatFallbackIntentWithLlmProvider } from "@/lib/server/llm-provider"
import { toArrayBuffer, writeChatUploadImage } from "@/lib/server/local-images"
import { ndjsonProgressResponse, noopProgress, type ProgressEmitter, type ProgressLanguage } from "@/lib/server/progress-stream"
import { recognizePartWithProvider, recognizeVehicleWithProvider } from "@/lib/server/vision-provider"
import type { ChatAttachment, ChatFallbackIntent, ChatIntentParseResult, ChatMessage, GenerationStandardJson, GuardrailResult, PartCategory, PartColorPolicy, ProviderConfig } from "@/lib/types"
import { CHAT_UPLOAD_MAX_TOTAL_MB, IMAGE_UPLOAD_MAX_BYTES, IMAGE_UPLOAD_MAX_MB, MAX_CHAT_PART_IMAGES, isAllowedImageMimeType, validateImageUploadTotal } from "@/lib/upload-limits"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type SavedUpload = Omit<ChatAttachment, "id" | "messageId" | "createdAt" | "type">
type ChatCanvas = SavedUpload & { source: "uploaded" | "latest" | "original"; file?: File | null; vehicleRecognition?: ChatVehicleRecognitionInput | null }
type ResponseLanguage = "en" | "zh"
type PendingPartReferenceContext = {
  categoryId: string
  descriptor: string
  sourceText: string
}

function createChatTrace() {
  const id = Math.random().toString(16).slice(2, 10)
  const startedAt = Date.now()
  let lastAt = startedAt
  const steps: Array<{ step: string; elapsedMs: number; totalMs: number; meta?: Record<string, unknown> }> = []
  return {
    mark(step: string, meta?: Record<string, unknown>) {
      const now = Date.now()
      const item = { step, elapsedMs: now - lastAt, totalMs: now - startedAt, meta }
      steps.push(item)
      lastAt = now
      console.info(`[chat:${id}] ${step} ${item.elapsedMs}ms total=${item.totalMs}ms${meta ? ` ${JSON.stringify(meta)}` : ""}`)
    },
    finish(status: string) {
      const totalMs = Date.now() - startedAt
      console.info(`[chat:${id}] finish ${status} total=${totalMs}ms`)
      return { id, status, totalMs, steps }
    },
  }
}

export async function POST(request: Request) {
  const formData = await request.formData()
  const responseLanguage: ProgressLanguage = String(formData.get("responseLanguage") || "en") === "zh" ? "zh" : "en"
  const streamProgress = String(formData.get("streamProgress") || "") === "1"
  if (streamProgress) {
    return ndjsonProgressResponse((emit) => handleChatPost(formData, emit), responseLanguage)
  }
  return handleChatPost(formData, noopProgress)
}

async function handleChatPost(formData: FormData, emitProgress: ProgressEmitter) {
  const trace = createChatTrace()
  let consumedEntitlement = false
  let consumedUserId = ""
  try {
    const user = requireUser()
    trace.mark("form_data")
    emitProgress({ step: "upload_validation" })
    const sessionId = String(formData.get("sessionId") || "")
    const text = String(formData.get("text") || "").trim()
    const uiLanguage = String(formData.get("responseLanguage") || "en") === "zh" ? "zh" : "en"
    const responseLanguage = assistantLanguage(uiLanguage, text)
    const contextMode = String(formData.get("contextMode") || "latest") === "original" ? "original" : "latest"
    const contextConfirmed = String(formData.get("contextConfirmed") || "") === "1"
    const partColorPolicyChoices = parsePartColorPolicyChoices(formData)
    const dryRun = isDryRunRequest(formData)
    const vehicleImages = formData.getAll("vehicleImage").filter((file): file is File => file instanceof File && file.size > 0)
    const partImages = formData.getAll("partImages").filter((file): file is File => file instanceof File && file.size > 0)

    if (vehicleImages.length > 1) {
      return NextResponse.json({ error: textFor(responseLanguage, "oneVehicle") }, { status: 400 })
    }
    if (partImages.length > MAX_CHAT_PART_IMAGES) {
      return NextResponse.json({ error: textFor(responseLanguage, "partLimit") }, { status: 400 })
    }
    const uploadFiles = [...vehicleImages, ...partImages]
    const invalidFile = uploadFiles.find((file) => !isAllowedImageMimeType(file.type))
    if (invalidFile) {
      return NextResponse.json({ error: textFor(responseLanguage, "invalidFile") }, { status: 400 })
    }
    const oversizedFile = uploadFiles.find((file) => file.size > IMAGE_UPLOAD_MAX_BYTES)
    if (oversizedFile) {
      return NextResponse.json({ error: textFor(responseLanguage, "fileTooLarge") }, { status: 413 })
    }
    const totalUploadValidation = validateImageUploadTotal(uploadFiles)
    if (!totalUploadValidation.ok) {
      return NextResponse.json({ error: textFor(responseLanguage, "uploadTotalTooLarge") }, { status: totalUploadValidation.status })
    }
    const hasCanvasForEmptyPartRequest = vehicleImages.length > 0 || chatSessionHasCanvas(sessionId, user.id)
    const allowEmptyTextForPartReferences = partImages.length > 0 && hasCanvasForEmptyPartRequest
    if (!text && !allowEmptyTextForPartReferences) {
      return NextResponse.json({ error: textFor(responseLanguage, "missingText") }, { status: 400 })
    }

    const catalog = getCatalog()
    trace.mark("catalog")
    const requestText = text || textFor(responseLanguage, "uploadedPartsOnlyRequest")
    const priorPartReferenceFollowUps = countPriorPartReferenceFollowUps(sessionId, user.id)
    const pendingPartReference = partImages.length ? null : pendingPartReferenceContext(sessionId, user.id, catalog.categories)
    const effectiveText = pendingPartReference ? mergePendingPartReferenceText(requestText, pendingPartReference, catalog.categories) : requestText
    const vehicle = vehicleImages[0] ? await saveChatUpload(vehicleImages[0], "vehicle") : null
    const parts = await Promise.all(partImages.map((file) => saveChatUpload(file, "part")))
    trace.mark("upload_save", { vehicleImages: vehicleImages.length, partImages: partImages.length })
    const sourceCanvas = await resolveChatCanvas({
      sessionId,
      userId: user.id,
      contextMode,
      uploadedVehicle: vehicle ? { ...vehicle, file: vehicleImages[0], source: "uploaded" } : null,
    })
    const previousStandardJson = latestChatStandardJson(sessionId, user.id, sourceCanvas?.url || "")
    trace.mark("canvas_resolve", { source: sourceCanvas?.source || "missing" })
    emitProgress({ step: "canvas_resolve", meta: { source: sourceCanvas?.source || "missing" } })

    if (!sourceCanvas) {
      const guardrail: GuardrailResult = { allowed: true, reason: "Missing source vehicle image.", detectedModel: "" }
      const exchange = createChatExchange({
        userId: user.id,
        sessionId: sessionId || undefined,
        text,
        contextMode,
        partAttachments: parts,
        guardrail,
        resultImageUrl: "",
        assistantContent: textFor(responseLanguage, "missingCanvas"),
      })
      return NextResponse.json({ ...exchange, dryRun, followUpQuestion: textFor(responseLanguage, "missingCanvasShort") }, { status: 200 })
    }

    const fileTypes = [...(vehicleImages[0] ? [vehicleImages[0].type] : [sourceCanvas.mime]), ...partImages.map((file) => file.type)]
    const guardrail = runMockGuardrail({ hasVehicleImage: true, text: effectiveText, fileTypes, skipIntentKeywordCheck: true })
    trace.mark("guardrail")
    emitProgress({ step: "guardrail" })
    if (!guardrail.allowed) {
      return NextResponse.json({ guardrail, error: guardrail.reason }, { status: 400 })
    }

    const workflow = getWorkflowConfig("chat")
    const recognition = await recognizeChatInputs({
      workflow,
      dryRun,
      text,
      sourceCanvas,
      partFiles: partImages,
      partUploads: parts,
      catalog,
      onProgress: emitProgress,
    })
    trace.mark("recognition", { ok: recognition.ok })
    if (!recognition.ok) {
      return NextResponse.json({ error: recognition.error, recognition }, { status: recognition.status })
    }

    const parseInput: Parameters<typeof parseChatIntent>[0] = {
      sourceImageUrl: sourceCanvas.url,
      text: effectiveText,
      contextMode,
      partReferences: recognition.partReferences,
      categories: catalog.categories,
      assets: catalog.assets,
      vehicleRecognition: recognition.vehicle,
      partColorPolicyChoices,
      previousStandardJson,
    }
    const localParseResult = parseChatIntent(parseInput)
    trace.mark("local_parse", { status: localParseResult.status })
    emitProgress({ step: "local_parse", meta: { status: localParseResult.status } })

    let parseResult = localParseResult
    if (parseResult.status !== "ready" || !parseResult.standardJson) {
      const pendingColorPolicyCategories = pendingPartColorPolicyCategories(parseResult)
      if (pendingColorPolicyCategories.length) {
        return NextResponse.json(
          buildPartColorPolicyChoiceResponse({
            sessionId,
            userId: user.id,
            text,
            contextMode,
            vehicle,
            parts,
            guardrail: {
              ...guardrail,
              allowed: true,
              reason: parseResult.followUpQuestion || guardrail.reason,
            },
            parseResult,
            recognition,
            language: responseLanguage,
            categoryIds: pendingColorPolicyCategories,
            categories: catalog.categories,
          }),
          { status: 200 },
        )
      }

      emitProgress({ step: "llm_fallback" })
      const fallback = await parseFallbackIntentIfEligible({
        workflow,
        catalog,
        parseResult,
        parseInput,
        dryRun,
        sourceCanvas,
        recognition,
      })
      trace.mark(fallback.attempted ? "fallback_intent" : "fallback_intent_skipped", { status: fallback.intent ? "usable" : "empty" })
      if (fallback.intent) {
        const fallbackParseInput = applyFallbackIntentToChatParseInput(parseInput, fallback.intent)
        parseResult = parseChatIntent(fallbackParseInput)
        recognition.partReferences = fallbackParseInput.partReferences
        trace.mark("fallback_local_parse", { status: parseResult.status, missingFields: parseResult.missingFields })
        const fallbackColorPolicyCategories = pendingPartColorPolicyCategories(parseResult)
        if (fallbackColorPolicyCategories.length) {
          return NextResponse.json(
            buildPartColorPolicyChoiceResponse({
              sessionId,
              userId: user.id,
              text,
              contextMode,
              vehicle,
              parts,
              guardrail: {
                ...guardrail,
                allowed: true,
                reason: parseResult.followUpQuestion || guardrail.reason,
              },
              parseResult,
              recognition,
              language: responseLanguage,
              categoryIds: fallbackColorPolicyCategories,
              categories: catalog.categories,
            }),
            { status: 200 },
          )
        }
      }
    }

    if (parseResult.status !== "ready" || !parseResult.standardJson) {
      const exchange = createChatExchange({
        userId: user.id,
        sessionId: sessionId || undefined,
        text,
        contextMode,
        vehicleAttachment: vehicle ?? undefined,
        partAttachments: parts,
        guardrail: {
          ...guardrail,
          allowed: parseResult.status !== "rejected",
          reason: parseResult.reason || parseResult.followUpQuestion || guardrail.reason,
        },
        resultImageUrl: "",
        assistantContent: fallbackUnableContent(parseResult, responseLanguage, priorPartReferenceFollowUps, catalog.categories),
      })
      return NextResponse.json({ ...exchange, guardrail, parseResult, recognition }, { status: 200 })
    }

    if (!contextConfirmed && !vehicle && !isResultCorrection(parseResult.standardJson) && shouldAskContextChoice(sessionId, user.id)) {
      return NextResponse.json(
        buildContextChoiceResponse({
          sessionId,
          userId: user.id,
          text,
          contextMode,
          vehicle,
          parts,
          guardrail,
          parseResult,
          recognition,
          language: responseLanguage,
        }),
        { status: 200 },
      )
    }

    const standardJson = normalizeChatStandardJson(parseResult.standardJson, parseResult.standardJson, sourceCanvas.url, recognition.vehicle, contextMode, effectiveText)
    trace.mark("standard_json", { parts: standardJson.parts.length })
    emitProgress({ step: "standard_json", meta: { parts: standardJson.parts.length } })

    if (dryRun) {
      const preview = previewGenerationWorkflow({
        userId: user.id,
        mode: "chat",
        vehicleUploadId: "dry-run",
        sourceImageUrl: sourceCanvas.url,
        standardJson,
        paintId: standardJson.paint.action === "keep_original" ? "factory" : standardJson.paint.target,
        stance: standardJson.stance.value,
        selections: {},
      })
      const exchange = createChatExchange({
        userId: user.id,
        sessionId: sessionId || undefined,
        text,
        contextMode,
        vehicleAttachment: vehicle ?? undefined,
        partAttachments: parts,
        guardrail,
        resultImageUrl: "",
        assistantContent: dryRunContent(preview, responseLanguage),
        standardJson,
      })
      emitProgress({ step: "complete" })
      return NextResponse.json({ ...exchange, dryRun: true, guardrail, recognition, generationPreview: preview, standardJson, debugTimings: trace.finish("dry_run") }, { status: 200 })
    }

    const entitlement = checkAndConsumeEntitlement(user.id, "chat")
    trace.mark("entitlement", { allowed: entitlement.allowed })
    emitProgress({ step: "entitlement", meta: { allowed: entitlement.allowed } })
    if (!entitlement.allowed) {
      return NextResponse.json({ error: entitlement.reason, billing: entitlement.status, code: "subscription_required" }, { status: 402 })
    }
    consumedEntitlement = true
    consumedUserId = user.id

    const storedVehicle = createVehicleUpload({
      userId: user.id,
      fileName: sourceCanvas.fileName,
      url: sourceCanvas.url,
      mime: sourceCanvas.mime,
      size: sourceCanvas.size,
    })
    trace.mark("vehicle_record")
    emitProgress({ step: "save_source" })
    const generation = await runGenerationWorkflow({
      userId: user.id,
      mode: "chat",
      vehicleUploadId: storedVehicle.id,
      sourceImageUrl: sourceCanvas.url,
      standardJson,
      paintId: standardJson.paint.action === "keep_original" ? "factory" : standardJson.paint.target,
      stance: standardJson.stance.value,
      selections: {},
      onProgress: emitProgress,
    })
    trace.mark("generation", { status: generation.status, provider: generation.provider })
    if (generation.status === "failed") {
      refundChatEntitlement(consumedUserId)
      consumedEntitlement = false
      const error = chatGenerationFailureMessage(generation.failureReason, responseLanguage)
      const responseGeneration = error === generation.failureReason ? generation : { ...generation, failureReason: error }
      return NextResponse.json({ error, generation: responseGeneration, recognition }, { status: 502 })
    }
    const exchange = createChatExchange({
      userId: user.id,
      sessionId: sessionId || undefined,
      text,
      contextMode,
      vehicleAttachment: vehicle ?? undefined,
      partAttachments: parts,
      guardrail,
      resultImageUrl: generation.resultImageUrl,
      assistantContent: textFor(responseLanguage, "generationComplete"),
      standardJson,
    })

    return NextResponse.json({ ...exchange, guardrail, recognition, generation, resultImageUrl: generation.resultImageUrl, debugTimings: trace.finish("success") }, { status: 201 })
  } catch (error) {
    if (consumedEntitlement) refundChatEntitlement(consumedUserId)
    if ((error as { status?: number }).status) return authErrorResponse(error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Chat generation failed" }, { status: 500 })
  }
}

function refundChatEntitlement(userId: string) {
  if (!userId) return
  try {
    refundEntitlementUsage(userId, "chat")
  } catch {
    // Keep the original generation error response if usage rollback fails.
  }
}

function shouldAskContextChoice(sessionId: string, userId: string) {
  if (!sessionId) return false
  try {
    const messages = getChatMessages(sessionId, userId)
    const original = firstAttachment(messages.flatMap((message) => message.attachments), "vehicle")
    const latestResult =
      [...messages].reverse().find((message) => message.resultImageUrl)?.resultImageUrl ||
      firstAttachment([...messages].reverse().flatMap((message) => message.attachments), "result")?.url ||
      ""
    return Boolean(original && latestResult)
  } catch {
    return false
  }
}

function chatSessionHasCanvas(sessionId: string, userId: string) {
  if (!sessionId) return false
  try {
    const messages = getChatMessages(sessionId, userId)
    return messages.some(
      (message) =>
        Boolean(message.resultImageUrl) ||
        message.attachments.some((attachment) => attachment.type === "vehicle" || attachment.type === "result"),
    )
  } catch {
    return false
  }
}

function pendingPartColorPolicyCategories(result: ChatIntentParseResult) {
  return (result.missingFields ?? [])
    .map((field) => field.match(/^part_color_policy:(hood|mirrors)$/)?.[1])
    .filter((categoryId): categoryId is "hood" | "mirrors" => categoryId === "hood" || categoryId === "mirrors")
    .filter((categoryId, index, categories) => categories.indexOf(categoryId) === index)
}

function pendingPartColorPolicyCategory(result: ChatIntentParseResult) {
  return pendingPartColorPolicyCategories(result)[0] || ""
}

function cleanPartColorPolicyCategory(value: string) {
  return value === "hood" || value === "mirrors" ? value : ""
}

function cleanPartColorPolicy(value: string): PartColorPolicy | "" {
  return value === "body_color" || value === "exposed_carbon" ? value : ""
}

function parsePartColorPolicyChoices(formData: FormData): Record<string, PartColorPolicy> {
  const choices: Record<string, PartColorPolicy> = {}
  const json = String(formData.get("partColorPolicyChoicesJson") || "")
  if (json.trim()) {
    try {
      const parsed = JSON.parse(json) as unknown
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        Object.entries(parsed as Record<string, unknown>).forEach(([categoryId, policy]) => {
          const cleanCategory = cleanPartColorPolicyCategory(categoryId)
          const cleanPolicy = cleanPartColorPolicy(String(policy || ""))
          if (cleanCategory && cleanPolicy) choices[cleanCategory] = cleanPolicy
        })
      }
    } catch {
      // Invalid JSON falls back to legacy single-choice fields below.
    }
  }
  const partColorPolicyConfirmed = String(formData.get("partColorPolicyConfirmed") || "") === "1"
  const partColorPolicyCategory = cleanPartColorPolicyCategory(String(formData.get("partColorPolicyCategory") || ""))
  const partColorPolicy = cleanPartColorPolicy(String(formData.get("partColorPolicy") || ""))
  if (partColorPolicyConfirmed && partColorPolicyCategory && partColorPolicy) choices[partColorPolicyCategory] = partColorPolicy
  return choices
}

function isResultCorrection(spec: GenerationStandardJson | undefined) {
  return Boolean(spec?.style?.keywords?.includes("result_correction"))
}

function latestChatStandardJson(sessionId: string, userId: string, preferredUrl = ""): GenerationStandardJson | null {
  if (!sessionId) return null
  try {
    const messages = getChatMessages(sessionId, userId)
    const urls = [
      preferredUrl,
      ...[...messages].reverse().map((message) => message.resultImageUrl).filter(Boolean),
      ...[...messages]
        .reverse()
        .flatMap((message) => message.attachments)
        .filter((attachment) => attachment.type === "result")
        .map((attachment) => attachment.url),
    ].filter(Boolean)
    const seen = new Set<string>()
    for (const url of urls) {
      if (seen.has(url)) continue
      seen.add(url)
      const generation = findGenerationByResultImageUrl(url, userId)
      if (generation?.standardJson) return generation.standardJson
    }
    const messageStandardJson = [...messages]
      .reverse()
      .find((message) => message.role === "assistant" && message.standardJson?.vehicle && message.standardJson?.paint)?.standardJson
    if (messageStandardJson) return messageStandardJson
  } catch {
    return null
  }
  return null
}

function buildContextChoiceResponse(input: {
  sessionId: string
  userId: string
  text: string
  contextMode: "latest" | "original"
  vehicle: SavedUpload | null
  parts: SavedUpload[]
  guardrail: GuardrailResult
  parseResult: ChatIntentParseResult
  recognition: ChatRecognitionSuccess
  language: ResponseLanguage
}) {
  const messages = getChatMessages(input.sessionId, input.userId)
  const session = listChatSessions(input.userId).find((item) => item.id === input.sessionId)
  if (!session) throw new Error(`Chat session not found: ${input.sessionId}`)
  const now = Date.now()
  const userMessageId = `pending_user_${now}`
  const assistantMessageId = `pending_context_${now}`
  const userMessage: ChatMessage = {
    id: userMessageId,
    sessionId: input.sessionId,
    role: "user",
    content: input.text,
    resultImageUrl: "",
    guardrailStatus: input.guardrail.allowed ? "allowed" : "blocked",
    guardrailReason: input.guardrail.reason,
    contextMode: input.contextMode,
    createdAt: now,
    attachments: [
      ...(input.vehicle ? [pendingAttachment(userMessageId, "vehicle", input.vehicle, now)] : []),
      ...input.parts.map((part, index) => pendingAttachment(userMessageId, "part", part, now + index + 1)),
    ],
  }
  const assistantMessage: ChatMessage = {
    id: assistantMessageId,
    sessionId: input.sessionId,
    role: "assistant",
    content: textFor(input.language, "contextChoiceQuestion"),
    resultImageUrl: "",
    guardrailStatus: "allowed",
    guardrailReason: "",
    contextMode: input.contextMode,
    createdAt: now + input.parts.length + 2,
    attachments: [],
  }

  return {
    session,
    messages: [...messages, userMessage, assistantMessage],
    contextChoiceRequired: true,
    contextChoiceMessageId: assistantMessageId,
    contextQuestion: assistantMessage.content,
    contextOptions: [
      { mode: "original", label: textFor(input.language, "contextOriginalOption") },
      { mode: "latest", label: textFor(input.language, "contextLatestOption") },
    ],
    guardrail: input.guardrail,
    parseResult: input.parseResult,
    recognition: input.recognition,
  }
}

function buildPartColorPolicyChoiceResponse(input: {
  sessionId: string
  userId: string
  text: string
  contextMode: "latest" | "original"
  vehicle: SavedUpload | null
  parts: SavedUpload[]
  guardrail: GuardrailResult
  parseResult: ChatIntentParseResult
  recognition: ChatRecognitionSuccess
  language: ResponseLanguage
  categoryIds: string[]
  categories: PartCategory[]
}) {
  const messages = input.sessionId ? getChatMessages(input.sessionId, input.userId) : []
  const session = input.sessionId ? listChatSessions(input.userId).find((item) => item.id === input.sessionId) : undefined
  const now = Date.now()
  const userMessageId = `pending_user_${now}`
  const assistantMessageId = `pending_part_color_${now}`
  const userMessage: ChatMessage = {
    id: userMessageId,
    sessionId: input.sessionId || "pending",
    role: "user",
    content: input.text,
    resultImageUrl: "",
    guardrailStatus: input.guardrail.allowed ? "allowed" : "blocked",
    guardrailReason: input.guardrail.reason,
    contextMode: input.contextMode,
    createdAt: now,
    attachments: [
      ...(input.vehicle ? [pendingAttachment(userMessageId, "vehicle", input.vehicle, now)] : []),
      ...input.parts.map((part, index) => pendingAttachment(userMessageId, "part", part, now + index + 1)),
    ],
  }
  const assistantMessage: ChatMessage = {
    id: assistantMessageId,
    sessionId: input.sessionId || "pending",
    role: "assistant",
    content: partColorPolicyChoiceQuestion(input.language, input.categoryIds, input.categories),
    resultImageUrl: "",
    guardrailStatus: "allowed",
    guardrailReason: "",
    contextMode: input.contextMode,
    createdAt: now + input.parts.length + 2,
    attachments: [],
  }

  const firstCategoryId = input.categoryIds[0] || "hood"
  const choices = input.categoryIds.map((categoryId) => ({
    categoryId,
    categoryLabel: categoryLabelForMissingPart(categoryId, input.language, input.categories),
    options: [
      { categoryId, colorPolicy: "body_color" as const, label: textFor(input.language, "bodyColorOption") },
      { categoryId, colorPolicy: "exposed_carbon" as const, label: textFor(input.language, "exposedCarbonOption") },
    ],
  }))

  return {
    session,
    messages: [...messages, userMessage, assistantMessage],
    partColorPolicyChoiceRequired: true,
    partColorPolicyChoicesRequired: true,
    partColorPolicyChoiceMessageId: assistantMessageId,
    partColorPolicyCategory: firstCategoryId,
    partColorPolicyQuestion: assistantMessage.content,
    partColorPolicyChoices: choices,
    partColorPolicyOptions: [
      { categoryId: firstCategoryId, colorPolicy: "body_color", label: textFor(input.language, "bodyColorOption") },
      { categoryId: firstCategoryId, colorPolicy: "exposed_carbon", label: textFor(input.language, "exposedCarbonOption") },
    ],
    guardrail: input.guardrail,
    parseResult: input.parseResult,
    recognition: input.recognition,
  }
}

function pendingAttachment(messageId: string, type: ChatAttachment["type"], upload: SavedUpload, createdAt: number): ChatAttachment {
  return {
    id: `pending_att_${type}_${createdAt}`,
    messageId,
    type,
    url: upload.url,
    fileName: upload.fileName,
    mime: upload.mime,
    size: upload.size,
    createdAt,
  }
}

async function parseFallbackIntentIfEligible(input: {
  workflow: ReturnType<typeof getWorkflowConfig>
  catalog: ReturnType<typeof getCatalog>
  parseResult: ReturnType<typeof parseChatIntent>
  parseInput: Parameters<typeof parseChatIntent>[0]
  dryRun: boolean
  sourceCanvas: ChatCanvas
  recognition: ChatRecognitionSuccess
}): Promise<{ attempted: boolean; intent?: ChatFallbackIntent }> {
  if (!isFallbackEligibleParseResult(input.parseResult)) return { attempted: false }
  if (input.dryRun || process.env.DISABLE_EXTERNAL_AI === "1") {
    const intent = process.env.CHAT_LLM_FALLBACK_FIXTURES === "1" ? fallbackIntentFixture(input.parseInput.text, input.recognition.partReferences) : undefined
    return { attempted: Boolean(intent), ...(intent ? { intent } : {}) }
  }

  const intentNode = input.workflow.nodes.find((node) => node.type === "intent_parser" && node.enabled)
  const llmProvider = intentNode?.providerId
    ? input.catalog.providers.find((provider) => provider.id === intentNode.providerId && provider.enabled && provider.capabilities.includes("llm"))
    : null
  if (!llmProvider || llmProvider.id === "mock-llm" || llmProvider.baseUrl.startsWith("local://")) return { attempted: false }

  const prompt = input.catalog.promptTemplates.find((template) => template.id === intentNode?.promptTemplateId && template.active)?.body || ""
  const response = await parseChatFallbackIntentWithLlmProvider({
    provider: llmProvider,
    prompt,
    sourceImageUrl: input.sourceCanvas.url,
    text: input.parseInput.text,
    contextMode: input.parseInput.contextMode,
    partReferences: input.recognition.partReferences,
    categories: input.catalog.categories,
    assets: input.catalog.assets,
    vehicleRecognition: input.recognition.vehicle,
    localMissingFields: input.parseResult.missingFields ?? [],
    localFollowUpQuestion: input.parseResult.followUpQuestion,
  })
  if (!response.ok) return { attempted: true }
  return { attempted: true, intent: response.result }
}

const fallbackEligibleMissingFields = new Set(["modification_request", "part_category", "paint_color", "uploaded_part_category"])

function isFallbackEligibleParseResult(result: ChatIntentParseResult) {
  if (result.status !== "needs_followup") return false
  const missing = result.missingFields ?? []
  if (!missing.length) return false
  return missing.every((field) => fallbackEligibleMissingFields.has(field))
}

function fallbackIntentFixture(text: string, partReferences: ChatPartReferenceInput[]): ChatFallbackIntent | undefined {
  const normalized = text.trim()
  const requestedCategories: NonNullable<ChatFallbackIntent["requestedCategories"]> = []
  const uploadedReferenceCategories: NonNullable<ChatFallbackIntent["uploadedReferenceCategories"]> = []
  let paint: ChatFallbackIntent["paint"] | undefined
  let stance: ChatFallbackIntent["stance"] | undefined

  if (/暗一点的绿|暗一點的綠|深一点的绿|深一點的綠|dark(?:er)?\s+green|deep\s+green/i.test(normalized)) {
    paint = { action: "change", target: "深绿色", confidence: 0.9 }
  }
  if (/低一点|低一點|贴齐|貼齊|flush|lower\s+a\s+little/i.test(normalized)) {
    stance = { value: 66, label: "齐边降低", confidence: 0.9 }
  }
  if (/尾翼|鸭尾|鴨尾|spoiler|rear\s+wing|ducktail|tail\s+aero/i.test(normalized)) {
    requestedCategories.push({ categoryId: "rear-wing", confidence: 0.9 })
  }
  const fixtureStance =
    /\b(?:air\s*suspension|aired\s*out|bagged|slammed|tucked|tire\s*tuck)\b|气动|气动避震|气动低趴|趴地|贴地|极低|藏轮/i.test(normalized)
      ? ({ value: 90, label: "气动避震", confidence: 0.9 } satisfies NonNullable<ChatFallbackIntent["stance"]>)
      : /\b(?:flush|flush\s*fitment|fender\s*to\s*lip|aggressive\s*fitment|stance\s+more\s+aggressive|more\s+aggressive\s+stance)\b|齐边|齊邊|贴齐|貼齊|轮眉齐边|齐平/i.test(normalized)
        ? ({ value: 70, label: "齐边低趴", confidence: 0.9 } satisfies NonNullable<ChatFallbackIntent["stance"]>)
        : /\b(?:lower|lowered|lowering|drop|dropped|lower\s+a\s+little)\b|降低|降车身|低一点|低一點|低一些|低趴/i.test(normalized)
          ? ({ value: 50, label: "轻微降低", confidence: 0.9 } satisfies NonNullable<ChatFallbackIntent["stance"]>)
          : /\b(?:raise|raised|lift|lifted|higher|increase\s+ride\s*height)\b|升高|抬高|加高|提高车身/i.test(normalized)
            ? ({ value: 25, label: "轻微升高", confidence: 0.9 } satisfies NonNullable<ChatFallbackIntent["stance"]>)
            : undefined
  if (fixtureStance) stance = fixtureStance

  for (const reference of partReferences) {
    const haystack = [reference.fileName, reference.category, reference.categoryLabel, reference.brand, reference.model, reference.variant, ...(reference.visualFeatures ?? [])]
      .filter(Boolean)
      .join(" ")
    if (/hood|bonnet|机盖|機蓋|碳盖|碳蓋/i.test(haystack)) {
      uploadedReferenceCategories.push({ fileName: reference.fileName, categoryId: "hood", confidence: 0.9 })
    } else if (/mirror|mirrors|后视镜|後視鏡|反光镜|反光鏡|镜壳|鏡殼/i.test(haystack)) {
      uploadedReferenceCategories.push({ fileName: reference.fileName, categoryId: "mirrors", confidence: 0.9 })
    }
  }

  const hasModificationIntent = Boolean(paint || stance || requestedCategories.length || uploadedReferenceCategories.length)
  if (!hasModificationIntent) return undefined
  return {
    hasModificationIntent,
    ...(paint ? { paint } : {}),
    ...(stance ? { stance } : {}),
    ...(requestedCategories.length ? { requestedCategories } : {}),
    ...(uploadedReferenceCategories.length ? { uploadedReferenceCategories } : {}),
    confidence: 0.9,
  }
}

type ChatRecognitionSuccess = {
  ok: true
  status: 200
  vehicle: ChatVehicleRecognitionInput
  partReferences: ChatPartReferenceInput[]
}

type ChatRecognitionFailure = {
  ok: false
  status: number
  error: string
}

async function recognizeChatInputs(input: {
  workflow: ReturnType<typeof getWorkflowConfig>
  dryRun: boolean
  text: string
  sourceCanvas: ChatCanvas
  partFiles: File[]
  partUploads: SavedUpload[]
  catalog: ReturnType<typeof getCatalog>
  onProgress?: ProgressEmitter
}): Promise<ChatRecognitionSuccess | ChatRecognitionFailure> {
  const recognitionWorkflow = getWorkflowConfigByMode("recognition")
  const vehicleNode =
    input.workflow.nodes.find((node) => node.type === "vehicle_detection" && node.enabled) ??
    recognitionWorkflow.nodes.find((node) => node.type === "vehicle_detection" && node.enabled)
  const partNode =
    input.workflow.nodes.find((node) => node.type === "part_detection" && node.enabled) ??
    recognitionWorkflow.nodes.find((node) => node.type === "part_detection" && node.enabled)
  const mockVision = input.catalog.providers.find((provider) => provider.id === "mock-vision") || mockVisionProvider()
  const vehicleProvider = input.dryRun
    ? mockVision
    : vehicleNode?.providerId
      ? input.catalog.providers.find((provider) => provider.id === vehicleNode.providerId && provider.enabled && provider.capabilities.includes("vision"))
      : null
  const partProvider = input.dryRun
    ? mockVision
    : partNode?.providerId
      ? input.catalog.providers.find((provider) => provider.id === partNode.providerId && provider.enabled && provider.capabilities.includes("vision"))
      : null

  let vehicle: ChatVehicleRecognitionInput = {
    model: "Context vehicle",
    view: "context canvas",
    confidence: 0.72,
  }
  if (input.sourceCanvas.vehicleRecognition?.model) {
    vehicle = input.sourceCanvas.vehicleRecognition
  } else if (input.sourceCanvas.file && input.sourceCanvas.source !== "latest") {
    if (!vehicleProvider) return { ok: false, status: 400, error: "Chat workflow vehicle recognition provider is disabled or not configured." }
    const prompt = input.catalog.promptTemplates.find((template) => template.id === vehicleNode?.promptTemplateId && template.active)?.body || ""
    input.onProgress?.({ step: "vehicle_recognition", provider: vehicleProvider.id })
    const response = await recognizeVehicleWithProvider({
      provider: vehicleProvider,
      apiKey: input.dryRun ? "" : getProviderApiKey(vehicleProvider.id),
      image: input.sourceCanvas.file,
      prompt,
    })
    if (!response.ok) return { ok: false, status: 502, error: response.error || response.rejectReason || "Vehicle recognition failed." }
    if (!response.isVehicle) return { ok: false, status: 400, error: response.rejectReason || "Uploaded image is not a recognizable vehicle photo." }
    vehicle = { model: response.model, view: response.view, confidence: response.confidence }
  }

  const partReferences: ChatPartReferenceInput[] = []
  for (let index = 0; index < input.partFiles.length; index += 1) {
    const file = input.partFiles[index]
    const upload = input.partUploads[index]
    if (!partProvider) return { ok: false, status: 400, error: "Chat workflow part recognition provider is disabled or not configured." }
    const prompt = input.catalog.promptTemplates.find((template) => template.id === partNode?.promptTemplateId && template.active)?.body || ""
    input.onProgress?.({ step: "part_recognition", provider: partProvider.id, meta: { index: index + 1, total: input.partFiles.length } })
    const response = await recognizePartWithProvider({
      provider: partProvider,
      apiKey: input.dryRun ? "" : getProviderApiKey(partProvider.id),
      image: file,
      prompt,
      fileName: file.name || upload.fileName,
      categories: input.catalog.categories,
    })
    if (!response.ok) return { ok: false, status: 502, error: response.error || response.rejectReason || "Part recognition failed." }
    partReferences.push({
      url: upload.url,
      fileName: file.name || upload.fileName,
      category: response.category,
      categoryLabel: response.category,
      brand: response.brand,
      model: response.model,
      variant: response.variant || upload.fileName,
      confidence: response.confidence,
      visualFeatures: response.visualFeatures,
    })
  }
  return { ok: true, status: 200, vehicle, partReferences }
}

function normalizeChatStandardJson(
  parsed: GenerationStandardJson,
  recognized: GenerationStandardJson,
  sourceImageUrl: string,
  vehicle: ChatVehicleRecognitionInput,
  contextMode: "latest" | "original",
  text: string,
): GenerationStandardJson {
  return {
    ...recognized,
    paint: parsed.paint || recognized.paint,
    stance: chatTextHasStanceIntent(text) ? parsed.stance || recognized.stance : recognized.stance,
    style: {
      keywords: parsed.style?.keywords?.length ? parsed.style.keywords : recognized.style.keywords,
      userText: text,
      contextMode,
    },
    vehicle: {
      ...recognized.vehicle,
      model: recognized.vehicle.model,
      view: vehicle.view || recognized.vehicle.view,
      confidence: vehicle.confidence ?? recognized.vehicle.confidence,
      sourceImageUrl,
    },
    parts: recognized.parts,
  }
}

function chatTextHasStanceIntent(text: string) {
  return hasChatStanceRequestText(text)
}

function legacyChatTextHasStanceIntent(text: string) {
  if (/不降低|不要降低|别降低|无需降低|保持.{0,6}(车高|高度|姿态)|原车高度|原厂高度/i.test(text)) return false
  return /\b(stance|lower|lowered|lowering|flush|aggressive|ride\s*height)\b|降低|降车身|低趴|贴地|齐边|姿态|车高|车身高度/i.test(text)
}

async function resolveChatCanvas(input: {
  sessionId: string
  userId: string
  contextMode: "latest" | "original"
  uploadedVehicle: (SavedUpload & { file: File; source: "uploaded" }) | null
}): Promise<ChatCanvas | null> {
  if (input.uploadedVehicle) return input.uploadedVehicle
  if (!input.sessionId) return null
  let messages: ReturnType<typeof getChatMessages>
  try {
    messages = getChatMessages(input.sessionId, input.userId)
  } catch {
    return null
  }
  const original = firstAttachment(messages.flatMap((message) => message.attachments), "vehicle")
  const latestResult =
    [...messages].reverse().find((message) => message.resultImageUrl)?.resultImageUrl ||
    firstAttachment([...messages].reverse().flatMap((message) => message.attachments), "result")?.url ||
    ""
  const selected =
    input.contextMode === "original"
      ? original
      : latestResult
        ? ({ url: latestResult, fileName: "latest-result.png", mime: "image/png", size: 0 } satisfies SavedUpload)
        : original
  if (!selected) return null
  let vehicleRecognition = vehicleRecognitionFromMessageHistory(messages, input.userId, selected.url)
  let canvasUpload = await materializeChatCanvas(selected)
  let source: ChatCanvas["source"] = input.contextMode === "original" ? "original" : latestResult ? "latest" : "original"
  if (!canvasUpload && selected !== original && original) {
    canvasUpload = await materializeChatCanvas(original)
    source = "original"
    vehicleRecognition = vehicleRecognitionFromMessageHistory(messages, input.userId, original.url)
  }
  if (!canvasUpload) return null
  return {
    url: canvasUpload.url,
    fileName: canvasUpload.fileName,
    mime: canvasUpload.mime,
    size: canvasUpload.size,
    source,
    vehicleRecognition,
    file: vehicleRecognition ? null : await fileFromPublicUrl(canvasUpload.url, canvasUpload.fileName, canvasUpload.mime),
  }
}

function firstAttachment(attachments: ChatAttachment[], type: ChatAttachment["type"]) {
  return attachments.find((attachment) => attachment.type === type)
}

function vehicleRecognitionFromMessageHistory(messages: ReturnType<typeof getChatMessages>, userId: string, preferredUrl = ""): ChatVehicleRecognitionInput | null {
  const urls = [
    preferredUrl,
    ...[...messages].reverse().map((message) => message.resultImageUrl).filter(Boolean),
    ...[...messages]
      .reverse()
      .flatMap((message) => message.attachments)
      .filter((attachment) => attachment.type === "result")
      .map((attachment) => attachment.url),
  ].filter(Boolean)
  const seen = new Set<string>()
  for (const url of urls) {
    if (seen.has(url)) continue
    seen.add(url)
    const vehicle = vehicleRecognitionFromGenerationUrl(url, userId)
    if (vehicle) return vehicle
  }
  return null
}

function vehicleRecognitionFromGenerationUrl(resultImageUrl: string, userId: string): ChatVehicleRecognitionInput | null {
  try {
    const generation = findGenerationByResultImageUrl(resultImageUrl, userId)
    const vehicle = generation?.standardJson?.vehicle
    if (!vehicle?.model) return null
    return {
      model: vehicle.model,
      view: vehicle.view,
      confidence: vehicle.confidence,
    }
  } catch {
    return null
  }
}

function countPriorPartReferenceFollowUps(sessionId: string, userId: string) {
  if (!sessionId) return 0
  try {
    const messages = getChatMessages(sessionId, userId)
    let count = 0
    for (const message of [...messages].reverse()) {
      if (message.resultImageUrl) break
      if (message.role === "user" && message.attachments.some((attachment) => attachment.type === "part")) break
      if (message.role === "assistant" && isPartReferenceFollowUp(message.content)) count += 1
    }
    return count
  } catch {
    return 0
  }
}

function pendingPartReferenceContext(sessionId: string, userId: string, categories: PartCategory[]): PendingPartReferenceContext | null {
  if (!sessionId) return null
  try {
    const messages = getChatMessages(sessionId, userId)
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index]
      if (message.resultImageUrl) break
      if (message.role === "user" && message.attachments.some((attachment) => attachment.type === "part")) break
      if (message.role !== "assistant" || !isPartReferenceFollowUp(message.content)) continue

      const previousUser = previousUserMessage(messages, index)
      const recentContext = recentPartReferenceContextText(messages, index)
      const descriptor = descriptorFromPartReferenceFollowUp(message.content)
      const categoryId = categoryIdFromText(`${message.content} ${recentContext} ${descriptor}`, categories)
      if (!categoryId && !descriptor) return null
      return {
        categoryId,
        descriptor,
        sourceText: recentContext || previousUser?.content || "",
      }
    }
  } catch {
    return null
  }
  return null
}

function recentPartReferenceContextText(messages: ReturnType<typeof getChatMessages>, beforeIndex: number) {
  const parts: string[] = []
  for (let index = beforeIndex - 1; index >= 0; index -= 1) {
    const message = messages[index]
    if (message.resultImageUrl) break
    if (message.role === "user" && message.attachments.some((attachment) => attachment.type === "part")) break
    if (message.role === "user" || (message.role === "assistant" && isPartReferenceFollowUp(message.content))) {
      parts.push(message.content)
    }
    if (parts.length >= 6) break
  }
  return parts.reverse().join("。")
}

function previousUserMessage(messages: ReturnType<typeof getChatMessages>, beforeIndex: number) {
  for (let index = beforeIndex - 1; index >= 0; index -= 1) {
    if (messages[index].role === "user") return messages[index]
  }
  return null
}

function descriptorFromPartReferenceFollowUp(content: string) {
  const zhMatch = content.match(/系统暂未收[录纳]该配件(.+?)，请您上传/u)
  if (zhMatch?.[1]) return zhMatch[1].trim()
  const enMatch = content.match(/has not collected (.+?) yet/i)
  return enMatch?.[1]?.trim() || ""
}

function mergePendingPartReferenceText(text: string, pending: PendingPartReferenceContext, categories: PartCategory[]) {
  const parts = [
    pending.sourceText,
    pending.descriptor && !pending.sourceText.includes(pending.descriptor) ? pending.descriptor : "",
    pending.categoryId ? categoryLabelForMissingPart(pending.categoryId, "zh", categories) : "",
    text,
  ]
    .map((item) => item.trim())
    .filter(Boolean)
  return parts.join("。用户补充：")
}

function categoryIdFromText(value: string, categories?: PartCategory[]) {
  return categoryIdFromAliasText(value, categories)
}

function isPartReferenceFollowUp(content: string) {
  if (/^Dry run\b/i.test(content) || /\bWorkflow[:\uff1a]/i.test(content)) return false
  if (/系统暂未收录|系统暂未收纳|配件参考图|具体型号|后台配件|可匹配型号/.test(content)) return true
  return (
    /reference image|brand\/model|catalog match/i.test(content) ||
    /配件参考图|具体型号|后台配件|可匹配型号/.test(content)
  )
}

async function fileFromPublicUrl(url: string, fileName: string, mime = "") {
  const image = await readImageAsset(url)
  if (!image) return null
  return new File([toArrayBuffer(image.bytes)], fileName || image.fileName, { type: mime || image.mime })
}

async function materializeChatCanvas(upload: SavedUpload): Promise<SavedUpload | null> {
  const image = await materializeImageUrl(upload.url, "chat_upload", "context")
  if (!image) return null
  return {
    url: image.url,
    fileName: image.fileName || upload.fileName,
    mime: image.mime || upload.mime,
    size: image.size || upload.size,
  }
}

function dryRunContent(preview: ReturnType<typeof previewGenerationWorkflow>, language: ResponseLanguage) {
  if (language === "zh") {
    return [
      "Dry run 已完成，没有调用外部 AI。",
      `画布：${preview.sourceImageUrl}`,
      `配件参考图：${preview.partImageUrls.length} 张`,
      `摘要：${preview.promptSummary}`,
    ].join("\n")
  }
  return [
    "Dry run completed. No external AI call was made.",
    `Source canvas: ${preview.sourceImageUrl}`,
    `Part references: ${preview.partImageUrls.length}`,
    `Summary: ${preview.promptSummary}`,
  ].join("\n")
}

function assistantContentForParseResult(result: ChatIntentParseResult, language: ResponseLanguage, priorPartReferenceFollowUps = 0, categories: PartCategory[] = []) {
  if (result.status === "rejected") {
    if (language === "en") return result.reason || textFor(language, "rejected")
    return result.reason && containsChinese(result.reason) ? result.reason : textFor(language, "rejected")
  }
  const missing = result.missingFields ?? []
  if (missing.some((field) => field.startsWith("part_color_policy:"))) {
    const categoryId = pendingPartColorPolicyCategory(result)
    return partColorPolicyQuestion(language, categoryId)
  }
  if (missing.includes("hood_color_policy")) return textFor(language, "hoodColorPolicy")
  if (missing.includes("uploaded_part_category")) return textFor(language, "uploadedPartCategory")
  if (missing.includes("modification_request")) return textFor(language, "modificationRequest")
  if (missing.some((field) => field.startsWith("part_reference:"))) {
    return priorPartReferenceFollowUps >= 3 ? textFor(language, "configModeFallback") : missingPartReferenceContent(result, language, categories)
  }
  if (language === "en" && result.followUpQuestion) return result.followUpQuestion
  if (language === "zh" && result.followUpQuestion && containsChinese(result.followUpQuestion)) return result.followUpQuestion
  return result.reason || textFor(language, "genericFollowUp")
}

function fallbackUnableContent(result: ChatIntentParseResult, language: ResponseLanguage, priorPartReferenceFollowUps = 0, categories: PartCategory[] = []) {
  if (isFallbackEligibleParseResult(result) && !shouldPreserveSpecificFollowUp(result)) return textFor(language, "genericFollowUp")
  return assistantContentForParseResult(result, language, priorPartReferenceFollowUps, categories)
}

function chatGenerationFailureMessage(failureReason: string, language: ResponseLanguage) {
  if (isProviderSafetyBlockMessage(failureReason)) return providerSafetyBlockMessage(language)
  return failureReason || (language === "zh" ? "\u751f\u56fe\u5931\u8d25\u3002" : "Image generation failed.")
}

function shouldPreserveSpecificFollowUp(result: ChatIntentParseResult) {
  const missing = result.missingFields ?? []
  if (missing.includes("uploaded_part_category")) return true
  if (!(missing.length === 1 && missing[0] === "paint_color")) return false
  return /\b(?:mirror|mirrors|caliper|calipers|brake)\b|\u540e\u89c6\u955c|\u955c\u58f3|\u5361\u94b3|\u5239\u8f66/u.test(result.followUpQuestion || "")
}

function missingPartReferenceContent(result: ChatIntentParseResult, language: ResponseLanguage, categories: PartCategory[]) {
  const part = requestedPartDescriptor(result, language, categories)
  if (language === "zh") {
    if (part.explicitName) return `系统暂未收录该配件${part.explicitName}，请您上传${part.explicitName}的配件参考图。`
    if (part.categoryLabel) return `请您补充${part.categoryLabel}的具体品牌/型号，并上传${part.categoryLabel}的配件参考图。`
    return "请您补充该配件的具体品牌/型号，并上传对应配件的参考图。"
  }
  if (part.explicitName) return `The system has not collected ${part.explicitName} yet. Please upload reference image(s) for ${part.explicitName}.`
  if (part.categoryLabel) return `Please provide the exact brand/model for ${part.categoryLabel} and upload reference image(s) for ${part.categoryLabel}.`
  return "Please provide the exact brand/model for that part and upload reference image(s) for it."
}

function requestedPartDescriptor(result: ChatIntentParseResult, language: ResponseLanguage, categories: PartCategory[]) {
  const text = result.normalizedText || ""
  const categoryId = (result.missingFields ?? [])
    .map((field) => field.match(/^part_reference:(.+)$/)?.[1])
    .find((value): value is string => Boolean(value))
  const categoryLabel = categoryLabelForMissingPart(categoryId, language, categories)
  const explicitName = extractRequestedPartName(text, categoryLabel)
  return { explicitName, categoryLabel }
}

function extractRequestedPartName(text: string, categoryLabel = "") {
  const normalized = text.replace(/\s+/g, " ").replace(/[。！？!?,，；;：:]+$/g, "").trim()
  if (!normalized) return ""
  const skuMatch = normalized.match(/\b[A-Z0-9][A-Z0-9-]{2,}(?:\s+[A-Z0-9][A-Z0-9-]{1,}){0,3}\b/i)
  if (skuMatch) {
    const sku = skuMatch[0].trim()
    return categoryLabel && !normalized.includes(categoryLabel) ? `${sku} ${categoryLabel}` : sku
  }
  if (categoryLabel) return ""
  let cleaned = normalized
  for (let index = 0; index < 3; index += 1) {
    cleaned = cleaned
      .replace(/^(please\s+|can you\s+|could you\s+|help me\s+|i want to\s+|i need to\s+)/i, "")
      .replace(/^(install|add|replace|change|swap|use|fit|mount|upgrade|put on)\s+/i, "")
      .replace(/^(请|麻烦|帮我|给我|我想|我要|想要|再|然后|另外|顺便|把|将|用|换成|换上|换|装|安装|加装|升级|改装|更换|替换|上一套|来一套|加)\s*/u, "")
      .replace(/^(这套|这个|那个|那套|对应|一下|一点|一个|一套)\s*/u, "")
      .trim()
  }
  if (!cleaned || cleaned.length > 48) return ""
  return cleaned
}

function categoryLabelForMissingPart(categoryId: string | undefined, language: ResponseLanguage, categories: PartCategory[] = []) {
  if (!categoryId) return ""
  const category = categories.find((item) => item.id === categoryId)
  if (category) return language === "zh" ? category.labelZh || category.label || category.id : category.labelEn || category.label || category.id
  const zh: Record<string, string> = {
    wheels: "轮毂",
    calipers: "卡钳",
    "rear-wing": "尾翼",
    "front-bumper": "前唇",
    "side-skirts": "侧裙",
    diffuser: "扩散器",
    exhaust: "排气",
    hood: "机盖",
    lights: "车灯",
    mirrors: "后视镜",
    grille: "中网",
  }
  const en: Record<string, string> = {
    wheels: "wheels",
    calipers: "brake calipers",
    "rear-wing": "rear wing",
    "front-bumper": "front lip",
    "side-skirts": "side skirts",
    diffuser: "diffuser",
    exhaust: "exhaust",
    hood: "hood",
    lights: "lights",
    mirrors: "mirrors",
    grille: "grille",
  }
  return language === "zh" ? zh[categoryId] || categoryId : en[categoryId] || categoryId
}

function assistantLanguage(uiLanguage: ResponseLanguage, text: string): ResponseLanguage {
  if (containsChinese(text)) return "zh"
  if (looksLikeEnglishRequest(text)) return "en"
  return uiLanguage
}

function containsChinese(value: string) {
  return /[\u3400-\u9fff]/.test(value)
}

function looksLikeEnglishRequest(value: string) {
  const words = value.toLowerCase().match(/[a-z]{2,}/g) ?? []
  if (words.length >= 3) return true
  if (words.length > 0 && categoryIdFromAliasText(value)) return true
  return /\b(add|install|lower|change|make|paint|keep|use|replace|generate|turn|black|white|gray|grey|blue|red|carbon|hood|bonnet|wheel|wheels|rim|caliper|brake|wing|spoiler|diffuser|exhaust|side|skirt|front|rear|bumper|lip|light|mirror|grille|wrap|stance)\b/i.test(value)
}

function partColorPolicyQuestion(language: ResponseLanguage, categoryId: string) {
  if (language === "zh") {
    return categoryId === "mirrors"
      ? "\u8bf7\u786e\u8ba4\u540e\u89c6\u955c\u5916\u58f3\u662f\u8f66\u8eab\u540c\u8272\uff0c\u8fd8\u662f\u4fdd\u7559\u88f8\u78b3\uff1f"
      : "\u8bf7\u786e\u8ba4\u673a\u76d6\u662f\u8f66\u8eab\u540c\u8272\uff0c\u8fd8\u662f\u4fdd\u7559\u88f8\u78b3\uff1f"
  }
  return categoryId === "mirrors"
    ? "Should the mirror caps match the body color, or stay exposed carbon?"
    : "Should the hood match the body color, or stay exposed carbon?"
}

function partColorPolicyChoiceQuestion(language: ResponseLanguage, categoryIds: string[], categories: PartCategory[]) {
  if (categoryIds.length <= 1) return partColorPolicyQuestion(language, categoryIds[0] || "hood")
  const rows = categoryIds.map((categoryId) => `${categoryLabelForMissingPart(categoryId, language, categories)}: ${textFor(language, "bodyColorOption")} / ${textFor(language, "exposedCarbonOption")}`)
  if (language === "zh") return ["\u8bf7\u786e\u8ba4\u4ee5\u4e0b\u78b3\u7ea4\u7ef4\u914d\u4ef6\u7684\u989c\u8272\u7b56\u7565\uff1a", ...rows].join("\n")
  return ["Please confirm the color policy for these carbon-fiber parts:", ...rows].join("\n")
}

function textFor(language: ResponseLanguage, key: keyof typeof assistantTexts.en) {
  const zhOverrides: Partial<Record<keyof typeof assistantTexts.en, string>> = {
    uploadedPartsOnlyRequest:
      "\u4f7f\u7528\u672c\u8f6e\u4e0a\u4f20\u7684\u8f66\u8f86\u56fe\u4f5c\u4e3a\u753b\u5e03\uff0c\u5c06\u672c\u8f6e\u4e0a\u4f20\u7684\u914d\u4ef6\u53c2\u8003\u56fe\u5b89\u88c5\u5230\u5bf9\u5e94\u8f66\u8eab\u4f4d\u7f6e\u3002",
    contextChoiceQuestion:
      "\u8fd9\u6b21\u662f\u57fa\u4e8e\u539f\u59cb\u4e0a\u4f20\u56fe\u91cd\u65b0\u751f\u6210\uff0c\u8fd8\u662f\u57fa\u4e8e\u6700\u65b0\u751f\u6210\u56fe\u7ee7\u7eed\u751f\u6210\uff1f",
    contextOriginalOption: "\u91cd\u65b0\u751f\u6210",
    contextLatestOption: "\u7ee7\u7eed\u751f\u6210",
    bodyColorOption: "\u8f66\u8eab\u540c\u8272",
    exposedCarbonOption: "\u88f8\u78b3",
  }
  if (language === "zh" && zhOverrides[key]) return zhOverrides[key]
  const table = assistantTexts[language] as Partial<Record<keyof typeof assistantTexts.en, string>>
  return table[key] || assistantTexts.en[key]
}

const assistantTexts = {
  en: {
    oneVehicle: "Only one vehicle image is supported in chat mode.",
    partLimit: `Chat mode supports at most ${MAX_CHAT_PART_IMAGES} part reference images.`,
    invalidFile: "Only jpg, png, and webp uploads are supported.",
    fileTooLarge: `Each image must be ${IMAGE_UPLOAD_MAX_MB}MB or smaller.`,
    uploadTotalTooLarge: `Uploads are limited to ${CHAT_UPLOAD_MAX_TOTAL_MB}MB per message.`,
    missingText: "Please describe the modification you want.",
    missingCanvas: "Please upload one source vehicle photo first. Later in the same chat, you can switch latest/original to reuse the saved canvas.",
    missingCanvasShort: "Please upload one source vehicle photo first.",
    rejected: "The current request is outside the supported car modification scope.",
    genericFollowUp: "Please add one clearer modification detail before generating.",
    modificationRequest: "Please describe the car modification you want, or upload part reference images.",
    uploadedPartCategory: "Please confirm what car part the uploaded reference image shows, such as hood, rear wing, diffuser, or side skirt.",
    missingPartReference:
      "I do not have an uploaded reference image or an exact catalog match for that part yet. Please upload clear reference image(s) and add the exact brand/model if you know it. If the model matches the backend catalog, I will use that catalog part automatically; otherwise the uploaded image will be used as the reference.",
    configModeFallback:
      "We have tried several follow-ups but still do not have a usable part reference image or catalog match. Please switch to Config Mode to use collected parts, or start a new chat with a vehicle photo and clear part reference images.",
    hoodColorPolicy: "The uploaded hood reference looks like carbon fiber. Should the hood stay exposed carbon, or should it be painted to match the body color?",
    generationComplete: "Generated a render from your vehicle and modification request.",
    uploadedPartsOnlyRequest: "Use the uploaded vehicle as the canvas and install the uploaded part reference image(s) onto the matching vehicle area.",
    contextChoiceQuestion: "Use the original uploaded vehicle photo to regenerate, or continue from the latest generated image?",
    contextOriginalOption: "Regenerate",
    contextLatestOption: "Continue",
    bodyColorOption: "Body color",
    exposedCarbonOption: "Exposed carbon",
  },
  zh: {
    oneVehicle: "对话模式只支持 1 张车辆图。",
    partLimit: `对话模式最多支持 ${MAX_CHAT_PART_IMAGES} 张配件参考图。`,
    invalidFile: "仅支持 jpg、png、webp 图片。",
    fileTooLarge: `每张图片不能超过 ${IMAGE_UPLOAD_MAX_MB}MB。`,
    uploadTotalTooLarge: `每条消息上传总量不能超过 ${CHAT_UPLOAD_MAX_TOTAL_MB}MB。`,
    missingText: "请描述你想要的车辆改装效果。",
    missingCanvas: "请先上传一张原车照片。后续同一对话可以切换 latest/original 继续使用历史画布。",
    missingCanvasShort: "请先上传一张原车照片。",
    rejected: "当前需求不属于车辆改装生图范围。",
    genericFollowUp: "请先补充一个更明确的信息，再继续生成。",
    modificationRequest: "请描述想要的车辆改装效果，或上传配件参考图。",
    uploadedPartCategory: "请确认上传的配件图属于哪个类别，例如机盖、尾翼、扩散器或侧裙。",
    missingPartReference:
      "我还没有拿到这个配件的参考图，也没有在后台精确命中具体型号。请上传清晰的配件参考图，并尽量补充品牌和具体型号；如果型号命中后台配件，会直接使用后台配件，否则会使用你上传的参考图。",
    configModeFallback:
      "已经连续多轮没有拿到可用的配件参考图或可匹配型号。建议先到配置模式选择已收录配件体验，或重新开始对话并上传原车图和清晰配件参考图。",
    hoodColorPolicy: "上传的机盖参考图看起来是碳纤维。请确认机盖保留裸碳，还是喷成车身同色？",
    generationComplete: "已根据你的车辆和改装需求生成效果图。",
  },
} satisfies Record<ResponseLanguage, Record<string, string>>

function isDryRunRequest(formData: FormData) {
  const value = String(formData.get("dryRun") || "")
  return value === "1" || value === "true" || process.env.CHAT_DRY_RUN_DEFAULT === "1" || process.env.DISABLE_EXTERNAL_AI === "1"
}

async function saveChatUpload(file: File, prefix: "vehicle" | "part") {
  if (!isAllowedImageMimeType(file.type)) {
    throw new Error("Only jpg, png, and webp uploads are supported.")
  }
  const ext = file.type === "image/png" ? ".png" : file.type === "image/webp" ? ".webp" : ".jpg"
  const fileName = `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`
  await writeChatUploadImage(fileName, Buffer.from(await file.arrayBuffer()))
  return {
    url: `/uploads/chat/${fileName}`,
    fileName: file.name || fileName,
    mime: file.type,
    size: file.size,
  }
}

function mockVisionProvider(): ProviderConfig {
  return {
    id: "mock-vision",
    label: "Mock Vision",
    baseUrl: "local://mock-vision",
    modelName: "mock-vision-v1",
    capabilities: ["vision"],
    enabled: true,
    active: false,
    hasApiKey: false,
    maskedKey: "",
    updatedAt: 0,
  }
}
