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
export type PartSurfaceColor = "black" | "exposed_carbon" | "body_color"
export type CaliperRotorOption = "stock" | "big_brake" | "carbon_ceramic"
export type DryCarbonPartId = "hood" | "mirrors" | "fenders" | "trunk-lid"
export type PartSelectionOptions = Record<
  string,
  {
    colorPolicy?: PartColorPolicy
    surfaceColor?: PartSurfaceColor
    caliperColor?: string
    rotorOption?: CaliperRotorOption
    dryCarbonParts?: DryCarbonPartId[]
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

export type BrandClassicPaint = {
  id: string
  brand: string
  label: string
  labelZh: string
  labelEn: string
  brandAliases?: string[]
  colorCode: string
  hex: string
  material: PaintFinishEffect
  prompt: string
  active: boolean
  isDefault?: boolean
  sortOrder: number
}

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
  consoleUrl: string
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
  classicPaints: BrandClassicPaint[]
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
  optionSummary?: string
  options?: Record<string, unknown>
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

export type UserStatus = "active" | "disabled"

export type AccountAvatarPreset = {
  id: string
  label: string
  imageUrl: string
  active: boolean
  sortOrder: number
  builtIn: boolean
  createdAt: number
  updatedAt: number
}

export type AuthUser = {
  id: string
  username: string
  name: string
  email: string
  phone: string
  avatarId: string
  avatarUrl: string
  hasPassword: boolean
  role: UserRole
  plan: MembershipPlanId | "internal" | "prototype"
  status: UserStatus
  createdAt: number
  lastLoginAt: number
  updatedAt: number
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
  status: "pending" | "paid" | "failed" | "refunded"
  amountCents: number
  createdAt: number
  updatedAt: number
}

export type AdminPaymentOrder = PaymentOrder & {
  userName: string
  userPhone: string
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

export type AdminGenerationFailure = {
  generationId: string
  userId: string
  userLabel: string
  mode: GenerationMode
  provider: ProviderId
  failureReason: string
  badCaseTags: string[]
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

export type AdminSmsRecord = {
  id: string
  phone: string
  purpose: string
  provider: string
  status: string
  requestId: string
  errorMessage: string
  attemptCount: number
  createdAt: number
  sentAt: number
  consumedAt: number
  expiresAt: number
}

export type AdminUserProfile = {
  userId: string
  userLabel: string
  totalGenerations: number
  succeededGenerations: number
  failedGenerations: number
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
  }
  categories: PartCategory[]
  brands: PartBrand[]
  assets: PartAsset[]
  providers: ProviderConfig[]
  prompts: PromptPreset[]
  promptTemplates: PromptTemplate[]
  avatarPresets: AccountAvatarPreset[]
  classicPaints: BrandClassicPaint[]
  workflows: WorkflowConfig[]
  guardrailConfig: GuardrailConfig
  chatSessions: ChatSession[]
  plans: MembershipPlan[]
  auditLogs: AuditLog[]
  badCases: GenerationBadCase[]
  quotaAdjustments: AdminQuotaAdjustment[]
  generationFailures: AdminGenerationFailure[]
  behaviorEvents: AdminBehaviorEvent[]
  smsRecords: AdminSmsRecord[]
  userProfiles: AdminUserProfile[]
  users: Array<{
    id: string
    name: string
    username: string
    email: string
    phone: string
    role: string
    plan: string
    status: UserStatus
    configUsed: number
    chatUsedToday: number
    configRemaining: number | "unlimited"
    chatRemainingToday: number | "unlimited"
    createdAt: number
    lastLoginAt: number
    updatedAt: number
  }>
  generations: GenerationJob[]
  usage: Array<{
    id: string
    userId: string
    generationId: string
    provider: ProviderId
    usageUnits: number
    createdAt: number
  }>
}

// ---------------------------------------------------------------------------
// Analytics types (DESIGN-20260729-002)
// ---------------------------------------------------------------------------

export type AnalyticsGranularity = "hour" | "day" | "week" | "month"

export type AnalyticsTimeseriesPoint = {
  date: string
  count: number
  group?: string
}

export type AnalyticsTrendResponse = {
  points: AnalyticsTimeseriesPoint[]
  previousPeriodCount: number
  currentPeriodCount: number
  changeRate: number | null
}

export type GenerationRecordItem = {
  id: string
  userId: string
  username: string
  mode: string
  status: string
  provider: string
  displayVehicleModel: string
  durationMs: number | null
  createdAt: number
  completedAt: number | null
  failureReason: string
}

export type GenerationListStats = {
  totalCount: number
  successRate: number
  avgDurationMs: number | null
}

export type GenerationListResponse = {
  items: GenerationRecordItem[]
  total: number
  page: number
  pageSize: number
  stats: GenerationListStats
}

export type GenerationProgressStepInfo = {
  step: string
  label: string
  status: string
  timestamp: number | null
  durationMs: number | null
}

export type GenerationDetailResponse = {
  id: string
  userId: string
  username: string
  mode: string
  status: string
  provider: string
  displayVehicleModel: string
  standardJson: unknown
  promptSummary: string
  promptHidden: string
  sourceImageUrl: string
  resultImageUrl: string
  resultCheck: unknown
  vehicleInfo: unknown
  progressSteps: GenerationProgressStepInfo[]
  failureReason: string
  usageUnits: number
  createdAt: number
  completedAt: number | null
}

export type ActivitySeriesPoint = {
  date: string
  dau: number
  wau?: number
  mau?: number
}

export type ActivityResponse = {
  series: ActivitySeriesPoint[]
  currentDau: number
  currentWau: number
  currentMau: number
}

export type RetentionCohortPoint = {
  cohortDate: string
  registerCount: number
  retention: Record<string, number>
}

export type RetentionResponse = {
  cohorts: RetentionCohortPoint[]
  periods: number[]
}

export type ActiveUserItem = {
  userId: string
  username: string
  plan: string
  lastActiveAt: number
  todayGenerations: number
}

export type UserAutoTags = {
  plan: string
  activity: string
  payment: string
  value: string
}

export type UserTagInfo = {
  auto: UserAutoTags
  manual: string[]
}

export type UsageTimelineEntry = {
  id: string
  type: "consumption" | "adjustment"
  amount: number
  description: string
  createdAt: number
}

export type UserDetailResponse = {
  user: {
    id: string
    username: string
    name: string
    phone: string
    email: string
    role: string
    plan: string
    status: string
    createdAt: number
    lastLoginAt: number
  }
  billing: EntitlementStatus
  tags: UserTagInfo
  usageTimeline: UsageTimelineEntry[]
  generations: GenerationRecordItem[]
  generationTotal: number
  preferences: {
    topVehicles: Array<{ label: string; count: number }>
    topPartCategories: Array<{ label: string; count: number }>
    topPaints: Array<{ label: string; count: number }>
  }
  auditLogs: AuditLog[]
}

// ---------------------------------------------------------------------------
// Analytics types (DESIGN-20260729-003) — Phase IV-VI
// ---------------------------------------------------------------------------

// --- Failure analysis ---

export type FailureTrendPoint = {
  date: string
  total: number
  failed: number
  failureRate: number
  group?: string
}

export type FailureTrendResponse = {
  points: FailureTrendPoint[]
  anomalyDates: string[]
}

export type ProviderFailureRanking = {
  provider: string
  requestCount: number
  failureCount: number
  failureRate: number
  topReasons: string[]
}

export type ProviderFailureRankingResponse = {
  rankings: ProviderFailureRanking[]
}

// --- Order analysis ---

export type RevenueTrendResponse = {
  points: AnalyticsTimeseriesPoint[]
  dailyRevenue: number
  monthlyRevenue: number
  arpu: number
}

export type OrderStatusCount = {
  status: string
  count: number
}

export type OrderConversionResponse = {
  conversionRate: number
  totalUsers: number
  paidUsers: number
  statusDistribution: OrderStatusCount[]
  refundRateSeries: Array<{ date: string; rate: number }>
}

export type RenewalRatePoint = {
  month: string
  rate: number
  expired: number
  renewed: number
}

export type RenewalRateResponse = {
  currentRate: number
  series: RenewalRatePoint[]
}

// --- Quota monitoring ---

export type QuotaConsumptionTrendResponse = {
  consumptionSeries: AnalyticsTimeseriesPoint[]
  adjustmentSeries: AnalyticsTimeseriesPoint[]
}

export type BalanceDistributionResponse = {
  exhausted: number
  nearExhausted: number
  sufficient: number
  total: number
}

// --- Alert records ---

export type AlertType = "high_frequency"
export type AlertStatus = "pending" | "confirmed" | "ignored"

export type AlertRecord = {
  id: string
  userId: string
  username: string
  alertType: AlertType
  alertValue: number
  detectedAt: number
  status: AlertStatus
  resolvedAt: number | null
  resolverId: string | null
}

export type AlertListResponse = {
  alerts: AlertRecord[]
  total: number
  scannedAt: number
}

export type AlertUpdateResponse = {
  alert: AlertRecord
}

// --- Failure attribution ---

export type FailureAttributionItem = {
  category: string
  count: number
  percentage: number
}

export type FailureAttributionResponse = {
  items: FailureAttributionItem[]
  total: number
}

// --- Health monitoring ---

export type SuccessRatePoint = {
  date: string
  provider: string
  successRate: number
  total: number
  succeeded: number
}

export type SuccessRateResponse = {
  points: SuccessRatePoint[]
}

export type LatencyPoint = {
  date: string
  provider?: string
  p50: number
  p95: number
  p99: number
}

export type LatencyResponse = {
  points: LatencyPoint[]
}

export type QueueStatusResponse = {
  queued: number
  running: number
  alert: boolean
}

// --- Quality analysis ---

export type QualityScorePoint = {
  date: string
  avgScore: number
  minScore: number
  maxScore: number
  count: number
}

export type QualityScoreTrendResponse = {
  points: QualityScorePoint[]
  threshold: number
}

export type BadCaseEfficiencyPoint = {
  date: string
  avgProcessTimeMs: number
  processed: number
  unprocessed: number
}

export type BadCaseEfficiencyResponse = {
  points: BadCaseEfficiencyPoint[]
  totalProcessed: number
  totalUnprocessed: number
  overallAvgTimeMs: number
}

// --- Message broadcast ---

export type BroadcastTarget = "all" | "plan" | "tag" | "users"

export type BroadcastMessageInput = {
  title: string
  body: string
  target: BroadcastTarget
  planId?: string
  tag?: string
  userIds?: string[]
}

export type BroadcastMessageResponse = {
  sent: number
}

// --- Report generation ---

export type ReportType = "daily" | "weekly" | "monthly"

export type ReportMetrics = {
  date: string
  newUsers: number
  totalGenerations: number
  successRate: number
  totalRevenueCents: number
}
