export type PartCategory = {
  id: string
  label: string
  labelEn: string
  labelZh: string
  description: string
  sortOrder: number
  aliases?: string[]
  chatEnabled?: boolean
  referenceHighRisk?: boolean
}

export type PartBrand = {
  id: string
  categoryId: string
  label: string
  sortOrder: number
  active: boolean
}

export type PartReferenceRole = "shape_reference" | "material_reference" | "color_reference" | "install_context" | "full_part_reference" | "avoid_upload"
export type PartPromptTestStatus = "untested" | "pass" | "weak" | "fail"
export type PartColorPolicy = "body_color" | "exposed_carbon" | "part_reference_color"
export type PartSelectionOptions = Record<
  string,
  {
    colorPolicy?: PartColorPolicy
  }
>

export type PartAssetReference = {
  id: string
  assetId: string
  url: string
  role: PartReferenceRole
  view: string
  priority: number
  promptHint: string
  uploadToModel: boolean
  active: boolean
  createdAt: number
}

export type PartAsset = {
  id: string
  categoryId: string
  brandId: string
  brand: string
  model: string
  variant: string
  keywords?: string
  color: string
  finish: string
  imageUrl: string
  imageCrop?: string
  active: boolean
  sortOrder: number
  promptHint: string
  defaultColorPolicy?: PartColorPolicy
  allowedColorPolicies?: PartColorPolicy[]
  generationReferences?: PartAssetReference[]
  promptTestStatus?: PartPromptTestStatus
  generationReady?: boolean
  badCaseNotes?: string
  recommendedViews?: string[]
}

export type PaintOption = {
  id: string
  label: string
  hex: string
  prompt: string
}

export type PaintFinishEffect = "gloss" | "metallic" | "matte" | "satin" | "pearl" | "chrome" | "gradient"

export type PaintGradient = {
  fromHex: string
  toHex: string
  direction: "front_to_rear"
}

export type ProviderId = string
export type ProviderCapability = "llm" | "vision" | "image_generation" | "embedding"
export type GenerationMode = "config" | "chat"

export type GenerationProgressStep =
  | "upload_validation"
  | "canvas_resolve"
  | "guardrail"
  | "vehicle_recognition"
  | "part_recognition"
  | "local_parse"
  | "llm_fallback"
  | "standard_json"
  | "prompt_build"
  | "entitlement"
  | "save_source"
  | "image_generation"
  | "provider_retry"
  | "provider_fallback"
  | "result_check"
  | "save_record"
  | "complete"

export type GenerationProgressEvent = {
  type: "progress"
  step: GenerationProgressStep
  message: string
  elapsedMs: number
  provider?: ProviderId
  retryAttempt?: number
  meta?: Record<string, unknown>
}

export type GenerationProgressUpdate = {
  step: GenerationProgressStep
  message?: string
  provider?: ProviderId
  retryAttempt?: number
  meta?: Record<string, unknown>
}

export type GenerationProgressResultEvent = {
  type: "result"
  status: number
  ok: boolean
  body: unknown
}

export type GenerationProgressStreamEvent = GenerationProgressEvent | GenerationProgressResultEvent

export type ProviderConfig = {
  id: ProviderId
  label: string
  baseUrl: string
  modelName: string
  capabilities: ProviderCapability[]
  enabled: boolean
  active: boolean
  hasApiKey: boolean
  maskedKey: string
  updatedAt: number
}

export type PromptPreset = {
  id: string
  title: string
  version: string
  body: string
  negativePrompt: string
  active: boolean
  createdAt: number
}

export type SelectionMap = Record<string, string>

export type CatalogResponse = {
  categories: PartCategory[]
  brands: PartBrand[]
  assets: PartAsset[]
  paints: PaintOption[]
  providers: ProviderConfig[]
  promptPreset: PromptPreset
  promptTemplates: PromptTemplate[]
}

export type GenerationJob = {
  id: string
  status: "queued" | "running" | "succeeded" | "failed"
  mode: GenerationMode
  userId: string
  provider: ProviderId
  vehicleUploadId: string
  sourceImageUrl: string
  displayVehicleModel?: string
  resultImageUrl: string
  paintId: string
  stance: number
  selections: SelectionMap
  selectionOptions: PartSelectionOptions
  standardJson: GenerationStandardJson | null
  workflowId: string
  promptVersion: string
  promptSummary: string
  promptHidden: string
  resultCheck: ResultCheckResult | null
  retryCount: number
  failureReason: string
  costCents: number
  badCaseTags: string[]
  usageUnits: number
  createdAt: number
}

export type ChatAttachment = {
  id: string
  messageId: string
  type: "vehicle" | "part" | "result"
  url: string
  fileName: string
  mime: string
  size: number
  createdAt: number
}

export type ChatMessage = {
  id: string
  sessionId: string
  role: "user" | "assistant" | "system"
  content: string
  resultImageUrl: string
  guardrailStatus: "pending" | "allowed" | "blocked"
  guardrailReason: string
  contextMode: "latest" | "original"
  standardJson?: GenerationStandardJson | null
  createdAt: number
  attachments: ChatAttachment[]
}

export type ChatSession = {
  id: string
  userId: string
  title: string
  pinned: boolean
  createdAt: number
  updatedAt: number
  messageCount: number
  preview: string
}

export type GuardrailConfig = {
  id: "default"
  sop: string
  allowedDescription: string
  blockedTerms: string
  recommendedPrompts: string
  mockMode: boolean
  mockFailUploads: boolean
  provider: ProviderId | "mock"
  updatedAt: number
}

export type ChatParseStatus = "ready" | "needs_followup" | "rejected"

export type ChatIntentParseResult = {
  status: ChatParseStatus
  standardJson?: GenerationStandardJson
  followUpQuestion?: string
  missingFields?: string[]
  reason?: string
  confidence: number
  normalizedText: string
}

export type ChatFallbackIntent = {
  hasModificationIntent: boolean
  paint?: { action: "change"; target: string; confidence: number }
  stance?: { value: number; label: string; confidence: number }
  requestedCategories?: Array<{ categoryId: string; confidence: number }>
  uploadedReferenceCategories?: Array<{ fileName: string; categoryId: string; confidence: number }>
  clarificationQuestion?: string
  reason?: string
  confidence: number
}

export type GuardrailResult = {
  allowed: boolean
  reason: string
  detectedModel: string
}

export type GenerationPartSource = "asset_library" | "uploaded_reference" | "free_text"

export type GenerationPartSpec = {
  category: string
  categoryLabel: string
  source: GenerationPartSource
  assetId: string
  brand: string
  model: string
  variant: string
  color: string
  finish: string
  colorPolicy: PartColorPolicy
  colorPolicyPrompt: string
  referenceImageUrl: string
  referenceImages?: Array<{
    url: string
    role: PartReferenceRole
    view: string
    promptHint: string
    priority: number
    uploadToModel: boolean
  }>
  instruction: string
}

export type GenerationStandardJson = {
  mode: GenerationMode
  vehicle: {
    model: string
    view: string
    sourceImageUrl: string
    confidence: number
  }
  paint: {
    action: "keep_original" | "change"
    target: string
    prompt: string
    finishEffect?: PaintFinishEffect
    finishLabel?: string
    gradient?: PaintGradient
  }
  stance: {
    value: number
    label: string
    prompt: string
  }
  parts: GenerationPartSpec[]
  style: {
    keywords: string[]
    userText: string
    contextMode: "latest" | "original"
  }
  constraints: {
    preserveBackground: boolean
    preserveCameraAngle: boolean
    preserveLighting: boolean
    preserveLicensePlateShape: boolean
    preserveVehicleIdentity: boolean
    preserveUnselectedParts: boolean
    selectedOnly: boolean
  }
}

export type WorkflowMode = GenerationMode | "recognition"
export type WorkflowNodeType =
  | "start"
  | "input_validation"
  | "guardrail"
  | "vehicle_detection"
  | "part_detection"
  | "local_parser"
  | "intent_parser"
  | "follow_up_gate"
  | "json_builder"
  | "prompt_builder"
  | "image_generation"
  | "result_check"
  | "retry"
  | "save_record"
  | "end"

export type WorkflowFailureStrategy = "stop" | "follow_up" | "retry" | "fallback"

export type WorkflowNodeConfig = {
  id: string
  type: WorkflowNodeType
  label: string
  description: string
  position: { x: number; y: number }
  required: boolean
  enabled: boolean
  providerCapability: ProviderCapability | ""
  providerId: ProviderId | ""
  fallbackProviderId: ProviderId | ""
  promptTemplateId: string
  failureStrategy: WorkflowFailureStrategy
  maxRetries: number
  config: Record<string, unknown>
}

export type WorkflowEdgeConfig = {
  id: string
  source: string
  target: string
  label?: string
  condition?: string
}

export type WorkflowConfig = {
  id: string
  mode: WorkflowMode
  title: string
  enabled: boolean
  vehicleCheckEnabled: boolean
  partCheckEnabled: boolean
  allowFollowUp: boolean
  promptTemplateIds: string[]
  providerId: ProviderId
  fallbackProviderId: ProviderId | ""
  resultCheckEnabled: boolean
  autoRetryEnabled: boolean
  maxRetries: number
  nodes: WorkflowNodeConfig[]
  edges: WorkflowEdgeConfig[]
  updatedAt: number
}

export type ResultCheckResult = {
  passed: boolean
  score: number
  missingElements: string[]
  wrongElements: string[]
  badCaseTags: string[]
  retryPrompt: string
  summary: string
}

export type GenerationBadCase = {
  id: string
  generationId: string
  userId: string
  mode: GenerationMode
  badCaseType: string
  summary: string
  standardJson: GenerationStandardJson | null
  resultCheck: ResultCheckResult | null
  createdAt: number
}

export type UserRole = "user" | "admin"

export type MembershipPlanId = "free" | "pro" | "max"

export type AuthUser = {
  id: string
  username: string
  name: string
  email: string
  phone: string
  role: UserRole
  plan: MembershipPlanId | "internal" | "prototype"
  createdAt: number
}

export type MembershipPlan = {
  id: MembershipPlanId
  label: string
  priceCents: number
  configLimit: number
  chatDailyLimit: number
  configUnlimited: boolean
  chatUnlimited: boolean
  chatEnabled: boolean
  active: boolean
  sortOrder: number
  updatedAt: number
}

export type Subscription = {
  id: string
  userId: string
  planId: MembershipPlanId
  status: "active" | "canceled" | "expired"
  currentPeriodEnd: number
  createdAt: number
  updatedAt: number
}

export type EntitlementStatus = {
  plan: MembershipPlan
  subscription?: Subscription
  configUsed: number
  chatUsedToday: number
  configRemaining: number | "unlimited"
  chatRemainingToday: number | "unlimited"
  chatEnabled: boolean
}

export type PaymentOrder = {
  id: string
  userId: string
  planId: MembershipPlanId
  method: "wechat" | "alipay"
  status: "pending" | "paid" | "failed"
  amountCents: number
  createdAt: number
  updatedAt: number
}

export type AccountMessageKind = "system" | "payment" | "subscription" | "quota"

export type AccountMessage = {
  id: string
  userId: string
  kind: AccountMessageKind
  title: string
  body: string
  metadata: Record<string, unknown>
  readAt: number
  createdAt: number
}

export type AuditLog = {
  id: string
  userId: string
  action: string
  metadata: string
  createdAt: number
}

export type AdminQuotaAdjustment = {
  id: string
  userId: string
  adminUserId: string
  mode: "config" | "chat"
  dateKey: string
  delta: number
  beforeUsed: number
  afterUsed: number
  reason: string
  createdAt: number
}

export type AdminProviderCostStat = {
  provider: ProviderId
  requestCount: number
  successCount: number
  failureCount: number
  usageUnits: number
  costCents: number
  lastRequestAt: number
}

export type AdminGenerationFailure = {
  generationId: string
  userId: string
  userLabel: string
  mode: GenerationMode
  provider: ProviderId
  failureReason: string
  badCaseTags: string[]
  retryCount: number
  costCents: number
  createdAt: number
}

export type AdminBehaviorEvent = {
  id: string
  userId: string
  userLabel: string
  type: string
  summary: string
  createdAt: number
}

export type AdminUserProfile = {
  userId: string
  userLabel: string
  totalGenerations: number
  succeededGenerations: number
  failedGenerations: number
  totalCostCents: number
  lastActiveAt: number
  topVehicles: Array<{ label: string; count: number }>
  topParts: Array<{ label: string; count: number }>
  topPartCategories: Array<{ label: string; count: number }>
  topPaints: Array<{ label: string; count: number }>
}

export type PromptTemplateScope =
  | "base"
  | "config_base"
  | "config_mode"
  | "chat_mode"
  | "category"
  | "part"
  | "combo"
  | "chat_recommendation"
  | "chat_parser"
  | "chat_optimizer"
  | "vehicle_recognition"
  | "part_recognition"
  | "negative"
  | "result_check"
  | "retry"

export type PromptTemplate = {
  id: string
  scope: PromptTemplateScope
  title: string
  body: string
  assetId: string
  combinationKey: string
  active: boolean
  sortOrder: number
  updatedAt: number
}

export type AdminSummary = {
  stats: {
    users: number
    activeAssets: number
    generations: number
    failedGenerations: number
    usageUnits: number
    totalCostCents: number
  }
  categories: PartCategory[]
  brands: PartBrand[]
  assets: PartAsset[]
  providers: ProviderConfig[]
  prompts: PromptPreset[]
  promptTemplates: PromptTemplate[]
  workflows: WorkflowConfig[]
  guardrailConfig: GuardrailConfig
  chatSessions: ChatSession[]
  plans: MembershipPlan[]
  auditLogs: AuditLog[]
  badCases: GenerationBadCase[]
  quotaAdjustments: AdminQuotaAdjustment[]
  providerCosts: AdminProviderCostStat[]
  generationFailures: AdminGenerationFailure[]
  behaviorEvents: AdminBehaviorEvent[]
  userProfiles: AdminUserProfile[]
  users: Array<{
    id: string
    name: string
    username: string
    email: string
    phone: string
    role: string
    plan: string
    configUsed: number
    chatUsedToday: number
    configRemaining: number | "unlimited"
    chatRemainingToday: number | "unlimited"
    createdAt: number
  }>
  generations: GenerationJob[]
  usage: Array<{
    id: string
    userId: string
    generationId: string
    provider: ProviderId
    usageUnits: number
    costCents: number
    createdAt: number
  }>
}
