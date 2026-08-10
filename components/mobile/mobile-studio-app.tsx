"use client"

import type { CSSProperties, Dispatch, MouseEvent, PointerEvent as ReactPointerEvent, ReactNode, RefObject, SetStateAction } from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"
import {
  AlertCircle,
  ArrowDownToLine,
  BadgeCheck,
  Car,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  CreditCard,
  ImageIcon,
  KeyRound,
  Languages,
  Layers3,
  LockKeyhole,
  LogOut,
  MailOpen,
  Menu,
  Palette,
  Pencil,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Upload,
  UserRound,
  WalletCards,
  Wand2,
  X,
  Film,
  ImagePlus,
  PencilRuler,
  Video,
  Zap,
  History,
} from "lucide-react"
import { AccountAvatar } from "@/components/account-avatar"
import { AuthModal } from "@/components/auth-modal"
import { ChatMode } from "@/components/chat-mode"
import { ImageComparisonSlider } from "@/components/image-comparison-slider"
import { SubscribeModal } from "@/components/subscribe-modal"
import { ACCOUNT_MESSAGES_REFRESH_EVENT } from "@/lib/account-events"
import {
  changeAccountPassword,
  changeAccountPhone,
  getAccountOrders,
  listAccountAvatarPresets,
  listAccountMessages,
  markAccountMessageRead,
  markAllAccountMessagesRead,
  sendPhoneChangeCode,
  updateAccountProfile,
} from "@/lib/account-client"
import { canvasSafeImageUrl } from "@/lib/client/image-download"
import type {
  AccountAvatarPreset,
  AccountMessage,
  AuthUser,
  CatalogResponse,
  ChatSession,
  EntitlementStatus,
  GenerationJob,
  GenerationProgressEvent,
  PaintFinishEffect,
  PaintOption,
  PartAsset,
  PartCategory,
  PartColorPolicy,
  PartSelectionOptions,
  PaymentOrder,
  SelectionMap,
  SubcategoryGroup,
} from "@/lib/types"

type Language = "en" | "zh"
type AppMode = "config" | "chat"
type AppMenu = "edit" | "generate" | "video" | "effect"
type ViewMode = "generated" | "original" | "compare"
type MobileTheme = "dark" | "light"
type MobileSheet = "parts" | "paint" | "stance" | "details" | "history" | null
type MobileAccessKind = "login" | "config_quota" | "chat_quota" | null

type MobileCopy = {
  title: string
  configMode: string
  chatMode: string
  detected: string
  upload: string
  original: string
  generated: string
  compare: string
  run: string
  running: string
  cancel: string
  member: string
  login: string
  logout: string
  chooseBrand: string
  emptyCategory: string
  searchParts: string
  noParts: string
  partSelected: string
  partsSelected: string
  colorShown: string
  history: string
  records: string
  historyEmpty: string
  elapsed: string
  elapsedUnit: string
  saveExport: string
}

type MobileCategory = PartCategory & {
  label: string
  description: string
}

type StancePreset = {
  id: string
  value: number
  label: Record<Language, string>
}

type ColorPolicyAsset = {
  asset: PartAsset
  policies: PartColorPolicy[]
  selected?: PartColorPolicy
}

type CustomRgb = { r: string; g: string; b: string }
type CustomHsv = { h: number; s: number; v: number }

type MobileStudioAppProps = {
  language: Language
  t: MobileCopy
  appMode: AppMode
  setAppMode: (mode: AppMode) => void
  mobileTheme: MobileTheme
  toggleMobileTheme: () => void
  toggleLanguage: () => void
  catalog: CatalogResponse
  categories: MobileCategory[]
  inputRef: RefObject<HTMLInputElement>
  onFile: (file: File | undefined) => void
  vehiclePreview: string
  vehicleNote: string
  setVehicleNote: (value: string) => void
  setVehicleNoteEdited: (value: boolean) => void
  vehicleDisplayName: string
  vehicleRecognitionError: string
  selectedAssets: PartAsset[]
  selections: SelectionMap
  selectAsset: (asset: PartAsset) => void
  brandFilters: Record<string, string>
  setBrandFilters: Dispatch<SetStateAction<Record<string, string>>>
  assetSearch: string
  setAssetSearch: (value: string) => void
  assetSuggestions: Array<{ asset: PartAsset; categoryLabel: string }>
  revealAsset: (asset: PartAsset) => void
  expandedCategory: string
  setExpandedCategory: (value: string) => void
  expandedCaliperAssetId: string
  setExpandedCaliperAssetId: (value: string) => void
  focusedAssetId: string
  selectionOptions: PartSelectionOptions
  selectedCaliperAsset?: PartAsset
  selectedSurfaceAssets: PartAsset[]
  updatePartSelectionOption: (categoryId: string, patch: PartSelectionOptions[string]) => void
  toggleDryCarbonPart: (part: (typeof mobileDryCarbonParts)[number]) => void
  paintId: string
  setPaintId: (value: string) => void
  paintChoices: PaintOption[]
  setPaintFinishEffect: (value: PaintFinishEffect) => void
  setDraftPaintFinishEffect: (value: PaintFinishEffect) => void
  selectedPaintLabel: string
  customColorOpen: boolean
  setCustomColorOpen: Dispatch<SetStateAction<boolean>>
  customPaintHex: string
  customPaintRgb: CustomRgb
  customPaintPreviewHex: string
  setCustomColorFromHex: (value: string) => void
  setCustomRgbChannel: (channel: keyof CustomRgb, value: string) => void
  applyCustomPaint: () => void
  customPaintApplied: boolean
  customPickerHsv: CustomHsv
  setCustomSvFromPointer: (event: ReactPointerEvent<HTMLButtonElement>) => void
  setCustomHue: (value: string) => void
  gradientFromHex: string
  gradientToHex: string
  gradientFrom: string
  gradientTo: string
  gradientPaintValid: boolean
  setGradientColor: (slot: "from" | "to", value: string) => void
  setGradientRgbChannel: (slot: "from" | "to", channel: keyof CustomRgb, value: string) => void
  applyGradientPaint: () => void
  gradientPaintApplied: boolean
  selectPaintFinishEffect: (effect: PaintFinishEffect) => void
  draftPaintFinishEffect: PaintFinishEffect
  colorPolicyAssets: ColorPolicyAsset[]
  selectAssetColorPolicy: (event: MouseEvent<HTMLButtonElement>, asset: PartAsset, colorPolicy: PartColorPolicy) => void
  stance: number
  setStance: (value: number) => void
  stanceName: string
  stancePresets: readonly StancePreset[]
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
  compareKey: number
  job: GenerationJob | null
  history: GenerationJob[]
  syncHistory: () => void
  selectHistoryJob: (job: GenerationJob) => void
  deleteHistoryJob: (job: GenerationJob) => void
  isGenerating: boolean
  generationElapsedSeconds: number
  generationDurationSeconds: number | null
  generationProgress: GenerationProgressEvent | null
  setIsGenerating: (value: boolean) => void
  canGenerate: boolean
  generate: () => void
  saveResult: (exportMode?: ViewMode) => void
  clearCurrentConfig: () => void
  formatHistoryTitle?: (job: GenerationJob) => string
  notice: string
  authUser: AuthUser | null
  billing: EntitlementStatus | null
  authOpen: boolean
  setAuthOpen: (value: boolean) => void
  subscribeOpen: boolean
  setSubscribeOpen: (value: boolean) => void
  onAuthed: (payload: { user: AuthUser; billing: EntitlementStatus | null }) => void
  onBillingUpdated: (billing: EntitlementStatus) => void
  onBillingChanged: (billing: EntitlementStatus) => void
  logout: () => void
  mobileAccessKind?: MobileAccessKind
  onMobileAccessBlocked?: () => void
  onSessionsChange?: (sessions: ChatSession[], activeSessionId: string) => void
  pendingSessionId?: string | null
  onPendingSessionConsumed?: () => void
}

const paintEffects: PaintFinishEffect[] = ["gloss", "metallic", "matte", "satin", "pearl", "chrome", "gradient"]
const mobileCustomPaintSwatches = ["#2F6BFF", "#0F6B55", "#243B53", "#7B1E3B", "#FFD21F", "#7A4DF3", "#D96C2C", "#E8E1D4", "#5D676F", "#101114"]
const mobileStyleSurfaceCategoryIds = new Set(["rear-wing", "side-skirts", "front-bumper"])

function isMobileBrandResourceCategory(category: PartCategory | undefined): boolean {
  return (category?.configType ?? "brand_resource") === "brand_resource"
}

function isMobileResourceNoImageCategory(category: PartCategory | undefined): boolean {
  return category?.configType === "resource" && category.assetImageVisible === false
}

function isMobileResourceSubcategoryCategory(category: PartCategory | undefined): boolean {
  return category?.configType === "resource_subcategory"
}

function isMobileResourceWithImageCategory(category: PartCategory | undefined): boolean {
  return category?.configType === "resource" && category.assetImageVisible !== false
}

function buildMobileFixedStyleAssetIdMap(categories: PartCategory[], assets: PartAsset[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const category of categories) {
    if (isMobileResourceNoImageCategory(category)) {
      const sorted = assets.filter((a) => a.categoryId === category.id).sort((a, b) => a.sortOrder - b.sortOrder)
      if (sorted[0]) map[category.id] = sorted[0].id
    }
  }
  return map
}

function isMobileConfigAssetVisible(asset: PartAsset, fixedAssetIdByCategory: Record<string, string>): boolean {
  const fixedStyleAssetId = fixedAssetIdByCategory[asset.categoryId]
  return !fixedStyleAssetId || asset.id === fixedStyleAssetId
}
const mobileWingStyleInfoById: Record<string, { zh: string; en: string; description: string }> = {
  "wing-ducktail": {
    zh: "鸭尾",
    en: "Ducktail",
    description: "贴着后备箱/尾门边缘微微上翘，比较低调。常见于性能街车、复古车、M 系/AMG/R 系一些改装。主要作用是轻微改善尾部气流，视觉上让车尾更翘、更运动。",
  },
  "wing-lip-spoiler": {
    zh: "小尾翼",
    en: "Lip Spoiler",
    description: "比鸭尾更薄，有点像一条贴片，很多原厂运动套件会用。装饰属性更强，对高速下压力帮助有限，但日常最协调，也最不容易显得夸张。",
  },
  "wing-gt-wing": {
    zh: "高脚尾翼",
    en: "GT Wing",
    description: "GT3 赛车常见，翼面和车身分离，有支架。更偏赛道，理论上能产生更明显的下压力，但角度、宽度、高度、安装位置都很关键。",
  },
  "wing-swan-neck": {
    zh: "天鹅颈尾翼",
    en: "Swan Neck",
    description: "支架从翼面上方连接，常见于 GT3 RS、GT4 赛车等。好处是翼面下方气流更干净，空气动力效率更高。视觉也更赛车化，改装成本和突兀感都更高。",
  },
  "wing-time-attack": {
    zh: "双层尾翼",
    en: "Time Attack Wing",
    description: "有主翼加副翼，或者上下两层，常见于赛车、Time Attack 改装。下压力更强，但也更夸张。",
  },
}

type MobileExhaustLayoutGroup = {
  id: string
  label: { zh: string; en: string }
  assetIds: string[]
  childLabels: Record<string, { zh: string; en: string }>
}

function mobileSubcategoryConfigToLayoutGroups(subcategoryConfig: SubcategoryGroup[] | undefined): MobileExhaustLayoutGroup[] {
  if (!subcategoryConfig?.length) return []
  return [...subcategoryConfig]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((group) => ({
      id: group.id,
      label: { zh: group.labelZh, en: group.labelEn || group.labelZh },
      assetIds: group.assets.map((asset) => asset.assetId),
      childLabels: Object.fromEntries(
        group.assets
          .filter((asset) => asset.childLabelZh)
          .map((asset) => [asset.assetId, { zh: asset.childLabelZh!, en: asset.childLabelEn || asset.childLabelZh! }]),
      ),
    }))
}

function buildMobileExhaustLayoutLabels(groups: MobileExhaustLayoutGroup[]): Record<string, { zh: string; en: string }> {
  const labels: Record<string, { zh: string; en: string }> = {}
  for (const group of groups) {
    const hasChildren = group.assetIds.length > 1
    for (const assetId of group.assetIds) {
      const childLabel = group.childLabels[assetId]
      if (childLabel && hasChildren) {
        const useSpace = /^\d/.test(childLabel.zh)
        labels[assetId] = useSpace
          ? { zh: `${group.label.zh} ${childLabel.zh}`, en: `${group.label.en} ${childLabel.en}` }
          : { zh: `${group.label.zh}（${childLabel.zh}）`, en: `${group.label.en} (${childLabel.en})` }
      } else {
        labels[assetId] = { zh: group.label.zh, en: group.label.en }
      }
    }
  }
  return labels
}

const mobileDryCarbonCategoryId = "dry-carbon-parts"
const mobileDryCarbonParts = [
  { id: "hood", assetId: "dry-carbon-hood", label: { zh: "机盖", en: "Hood" } },
  { id: "mirrors", assetId: "dry-carbon-mirrors", label: { zh: "后视镜", en: "Mirrors" } },
  { id: "fenders", assetId: "dry-carbon-fenders", label: { zh: "叶子板", en: "Fenders" } },
  { id: "trunk-lid", assetId: "dry-carbon-trunk-lid", label: { zh: "后备箱盖", en: "Trunk lid" } },
] as const

const riskInfoCategoryIds = new Set(["hood", "front-bumper", "trunk-lid", "rear-wing", "exhaust"])

function riskTooltipText(language: Language) {
  return language === "zh"
    ? "该配件受上传照片影响，可能不生成"
    : "This part is affected by the uploaded photo and may not be generated."
}
const mobileSurfaceColorOptions = [
  { id: "black", swatch: "#050506", label: { zh: "黑色", en: "Black" } },
  { id: "exposed_carbon", swatch: "#202226", label: { zh: "碳纤维", en: "Carbon fiber" } },
  { id: "body_color", swatch: "linear-gradient(135deg, #f8fafc, #64748b)", label: { zh: "车身同色", en: "Body color" } },
] as const
const mobileCaliperColorOptions = [
  { id: "red", swatch: "#d71920", label: { zh: "红色", en: "Red" } },
  { id: "blue", swatch: "#2563eb", label: { zh: "蓝色", en: "Blue" } },
  { id: "black", swatch: "#050506", label: { zh: "黑色", en: "Black" } },
  { id: "orange", swatch: "#f97316", label: { zh: "橙色", en: "Orange" } },
  { id: "yellow", swatch: "#f2c230", label: { zh: "黄色", en: "Yellow" } },
  { id: "green", swatch: "#16a34a", label: { zh: "绿色", en: "Green" } },
  { id: "nickel", swatch: "#9ca3af", label: { zh: "镀镍色", en: "Nickel" } },
  { id: "white", swatch: "#f8fafc", label: { zh: "白色", en: "White" } },
  { id: "pink", swatch: "#ec4899", label: { zh: "粉色", en: "Pink" } },
  { id: "purple", swatch: "#8b5cf6", label: { zh: "紫色", en: "Purple" } },
] as const
const mobileRotorOptions = [
  { id: "stock", label: { zh: "不变", en: "Stock rotor" } },
  { id: "big_brake", label: { zh: "加大刹车盘", en: "Big brake rotor" } },
  { id: "carbon_ceramic", label: { zh: "碳陶瓷刹车盘", en: "Carbon ceramic" } },
] as const

function mobileRgbFromHex(hex: string): CustomRgb {
  const normalized = hex.trim().replace(/^#/, "")
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return { r: "0", g: "0", b: "0" }
  return {
    r: String(Number.parseInt(normalized.slice(0, 2), 16)),
    g: String(Number.parseInt(normalized.slice(2, 4), 16)),
    b: String(Number.parseInt(normalized.slice(4, 6), 16)),
  }
}

function mobileDisplayAssetTitle(asset: PartAsset, layoutLabels?: Record<string, { zh: string; en: string }>) {
  if (asset.categoryId === "exhaust") return mobileDisplayExhaustLayoutLeafLabel(asset, "zh", layoutLabels)
  if (mobileStyleSurfaceCategoryIds.has(asset.categoryId)) return asset.variant || asset.model
  if (asset.id.startsWith("dry-carbon-")) return asset.variant || asset.model
  return `${asset.brand} ${asset.model}`.trim()
}

function mobileDisplayAssetSubtitle(asset: PartAsset) {
  if (asset.categoryId === "exhaust") return asset.model
  if (mobileStyleSurfaceCategoryIds.has(asset.categoryId)) return asset.model
  return asset.variant
}

function mobileInferDefaultCaliperColor(asset: PartAsset) {
  const text = [asset.variant, asset.color, asset.keywords].join(" ").toLowerCase()
  if (/yellow|\u9ec4|\u9ec3/.test(text)) return "yellow"
  if (/blue|\u84dd|\u85cd/.test(text)) return "blue"
  if (/black|\u9ed1/.test(text)) return "black"
  if (/silver|\u94f6|\u9280/.test(text)) return "nickel"
  return "red"
}

function mobileDisplaySelectedAssetSummary(asset: PartAsset, language: Language = "zh", layoutLabels?: Record<string, { zh: string; en: string }>) {
  const title = asset.categoryId === "exhaust" ? mobileDisplayExhaustLayoutLeafLabel(asset, language, layoutLabels) : mobileDisplayAssetTitle(asset, layoutLabels)
  if (asset.categoryId !== "wheels") return title
  const details = [mobileDisplayAssetSubtitle(asset), asset.color, asset.finish]
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)
  return details.length ? `${title} (${details.join(" / ")})` : title
}

function mobileDisplayCategorySelectionStatus(language: Language, asset?: PartAsset, layoutLabels?: Record<string, { zh: string; en: string }>) {
  if (!asset) return language === "zh" ? "未选择" : "Not selected"
  return language === "zh" ? `已选择：${mobileDisplaySelectedAssetSummary(asset, language, layoutLabels)}` : `Selected: ${mobileDisplaySelectedAssetSummary(asset, language, layoutLabels)}`
}

function mobileInferDefaultSurfaceColor(asset: PartAsset): "black" | "exposed_carbon" | "body_color" {
  if (asset.defaultColorPolicy === "body_color") return "body_color"
  const text = [asset.variant, asset.color, asset.finish, asset.promptHint].join(" ")
  if (/carbon|\u78b3/i.test(text)) return "exposed_carbon"
  return "black"
}

function MobileExhaustPipeIcon({ size = 16, strokeWidth = 2.2 }: { size?: number; strokeWidth?: number }) {
  return <Car size={size} strokeWidth={strokeWidth} aria-hidden="true" focusable="false" />
}

function mobileScheduleAccordionCardScroll(card: HTMLElement | null, container: HTMLElement | null) {
  if (!card || typeof window === "undefined") return
  const align = () => {
    const cardRect = card.getBoundingClientRect()
    const triggerRect = card.querySelector<HTMLElement>(".accordion-trigger")?.getBoundingClientRect()
    const content = card.querySelector<HTMLElement>(".accordion-content-inner") || card.querySelector<HTMLElement>(".accordion-content")
    const contentRect = content?.getBoundingClientRect()
    const containerRect = container?.getBoundingClientRect()
    const topEdge = (containerRect?.top ?? 0) + 10
    const bottomEdge = (containerRect?.bottom ?? window.innerHeight) - 18
    const triggerTop = triggerRect?.top ?? cardRect.top
    const contentTop = contentRect?.top ?? cardRect.bottom
    const contentBottom = contentRect?.bottom ?? cardRect.bottom
    const firstOptionHidden = contentTop > bottomEdge - 72 || (contentBottom > bottomEdge && contentTop > topEdge + 72)
    if (firstOptionHidden) {
      const desiredContentTop = topEdge + (triggerRect?.height ?? 36) + 8
      ;(container ?? window).scrollBy({ top: contentTop - desiredContentTop, behavior: "smooth" })
    } else if (triggerTop < topEdge) {
      ;(container ?? window).scrollBy({ top: triggerTop - topEdge, behavior: "smooth" })
    }
  }
  window.requestAnimationFrame(align)
  window.setTimeout(align, 330)
}

function mobileSelectedDryCarbonPartsFor(selections: SelectionMap) {
  return mobileDryCarbonParts.filter((part) => selections[part.id] === part.assetId)
}

function mobileDisplayDryCarbonCategorySelectionStatus(language: Language, parts: Array<(typeof mobileDryCarbonParts)[number]>) {
  if (!parts.length) return language === "zh" ? "未选择" : "Not selected"
  const labels = parts.map((part) => part.label[language]).join(language === "zh" ? "、" : ", ")
  return language === "zh" ? `已选择：${labels}` : `Selected: ${labels}`
}

function mobileDryCarbonPartMatchesSearch(part: (typeof mobileDryCarbonParts)[number], asset: PartAsset | undefined, search: string, language: Language) {
  if (!search) return true
  const text = [part.label.zh, part.label.en, part.label[language], asset?.brand, asset?.model, asset?.variant, asset?.color, asset?.finish, asset?.keywords]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
  return text.includes(search)
}

function mobileDisplayExhaustLayoutLeafLabel(asset: PartAsset, language: Language, layoutLabels?: Record<string, { zh: string; en: string }>) {
  const label = layoutLabels?.[asset.id]
  if (label) return language === "zh" ? label.zh : label.en
  return asset.variant || asset.model
}

function mobileChildExhaustLayoutLabel(group: MobileExhaustLayoutGroup, assetId: string, language: Language) {
  const childLabels = group.childLabels
  const label = childLabels[assetId]
  if (label) return language === "zh" ? label.zh : label.en
  return assetId
}

function mobileIsHexColorValue(value: string | undefined) {
  return /^#[0-9a-fA-F]{6}$/.test((value || "").trim())
}

const stanceGlowById: Record<string, string> = {
  stock: "radial-gradient(circle, rgba(148, 163, 184, 0.22) 0%, rgba(148, 163, 184, 0.09) 46%, rgba(148, 163, 184, 0) 72%)",
  raise: "radial-gradient(circle, rgba(20, 184, 166, 0.3) 0%, rgba(20, 184, 166, 0.12) 46%, rgba(20, 184, 166, 0) 72%)",
  "flush-lower": "radial-gradient(circle, rgba(34, 211, 238, 0.28) 0%, rgba(34, 211, 238, 0.11) 46%, rgba(34, 211, 238, 0) 72%)",
  "extreme-low": "radial-gradient(circle, rgba(236, 72, 153, 0.3) 0%, rgba(236, 72, 153, 0.12) 46%, rgba(236, 72, 153, 0) 72%)",
}

const paintEffectLabel: Record<Language, Record<PaintFinishEffect, string>> = {
  en: {
    gloss: "Gloss",
    metallic: "Metallic",
    matte: "Matte",
    satin: "Satin",
    pearl: "Pearl",
    chrome: "Chrome",
    gradient: "Gradient",
  },
  zh: {
    gloss: "亮面",
    metallic: "金属",
    matte: "哑光",
    satin: "缎面",
    pearl: "珠光",
    chrome: "电镀",
    gradient: "渐变",
  },
}

const colorPolicyLabel: Record<Language, Partial<Record<PartColorPolicy, string>>> = {
  en: {
    body_color: "Body color",
    exposed_carbon: "Exposed carbon",
  },
  zh: {
    body_color: "车身同色",
    exposed_carbon: "裸碳",
  },
}

const appModeOrder: Record<AppMode, number> = {
  config: 0,
  chat: 1,
}

const mobileModeTransitionMs = 360

export function MobileStudioApp(props: MobileStudioAppProps) {
  const {
    language,
    t,
    appMode,
    setAppMode,
    mobileTheme,
    toggleLanguage,
    authUser,
    authOpen,
    setAuthOpen,
    subscribeOpen,
    setSubscribeOpen,
    billing,
    onAuthed,
    onBillingUpdated,
    onBillingChanged,
    logout,
  } = props
  const previousModeRef = useRef(appMode)
  const [visibleModes, setVisibleModes] = useState<AppMode[]>([appMode])
  const [modeTransitionDirection, setModeTransitionDirection] = useState<"forward" | "back">("forward")
  const [configHistoryOpen, setConfigHistoryOpen] = useState(false)
  const [chatSidebarOpen, setChatSidebarOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [menuDrawerOpen, setMenuDrawerOpen] = useState(false)
  const [activeMenu, setActiveMenu] = useState<AppMenu>("edit")
  const [chatSessions, setChatSessions] = useState<ChatSession[]>([])
  const [chatActiveSessionId, setChatActiveSessionId] = useState("")
  const [pendingChatSessionId, setPendingChatSessionId] = useState<string | null>(null)
  const handleSelectChatSession = useCallback((id: string) => {
    setPendingChatSessionId(id)
    setMenuDrawerOpen(false)
  }, [])
  const [topbarDetached, setTopbarDetached] = useState(false)
  const [accessBannerShakeKey, setAccessBannerShakeKey] = useState(0)
  const [accessBannerShaking, setAccessBannerShaking] = useState(false)
  const [accessBannerShakeKind, setAccessBannerShakeKind] = useState<MobileAccessKind>(null)
  const accessKind = mobileAccessKindFor(appMode, authUser, billing)
  const accessBannerVisible = Boolean(accessKind)
  const triggerAccessBanner = () => {
    setAccessBannerShakeKind(accessKind)
    setAccessBannerShakeKey((value) => value + 1)
  }
  const openAccessDestination = () => {
    if (accessKind === "login") {
      setAuthOpen(true)
      return
    }
    setSubscribeOpen(true)
  }

  useEffect(() => {
    const previousMode = previousModeRef.current

    if (previousMode === appMode) {
      setVisibleModes([appMode])
      return undefined
    }

    const direction = appModeOrder[appMode] > appModeOrder[previousMode] ? "forward" : "back"
    previousModeRef.current = appMode
    setModeTransitionDirection(direction)
    setVisibleModes([previousMode, appMode])

    const timeout = window.setTimeout(() => {
      setVisibleModes([appMode])
    }, mobileModeTransitionMs)

    return () => window.clearTimeout(timeout)
  }, [appMode])

  useEffect(() => {
    if (appMode !== "config" || accessKind === "login") setConfigHistoryOpen(false)
    if (appMode !== "chat") setChatSidebarOpen(false)
  }, [accessKind, appMode])

  useEffect(() => {
    if (!accessBannerShakeKey) return undefined
    setAccessBannerShaking(false)
    const frameId = window.requestAnimationFrame(() => setAccessBannerShaking(true))
    const timeout = window.setTimeout(() => setAccessBannerShaking(false), 420)

    return () => {
      window.cancelAnimationFrame(frameId)
      window.clearTimeout(timeout)
    }
  }, [accessBannerShakeKey])

  useEffect(() => {
    setAccessBannerShaking(false)
  }, [accessKind])

  useEffect(() => {
    let frameId = 0

    const hasDetachedScroll = () => {
      if (window.scrollY > 8 || document.documentElement.scrollTop > 8 || document.body.scrollTop > 8) return true
      return [
        ".mobile-chat-shell .chat-thread",
        ".mobile-chat-shell .chat-workspace",
        ".parts-dropdown",
        ".mobile-history-drawer .mobile-history-panel",
      ].some((selector) => {
        const element = document.querySelector<HTMLElement>(selector)
        return Boolean(element && element.scrollTop > 8)
      })
    }

    const updateTopbarState = () => {
      frameId = 0
      setTopbarDetached(hasDetachedScroll())
    }

    const requestTopbarState = () => {
      if (frameId) return
      frameId = window.requestAnimationFrame(updateTopbarState)
    }

    updateTopbarState()
    window.addEventListener("scroll", requestTopbarState, { passive: true, capture: true })
    document.addEventListener("scroll", requestTopbarState, { passive: true, capture: true })
    window.addEventListener("resize", requestTopbarState)

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId)
      window.removeEventListener("scroll", requestTopbarState, { capture: true })
      document.removeEventListener("scroll", requestTopbarState, { capture: true })
      window.removeEventListener("resize", requestTopbarState)
    }
  }, [])

  const mobileOverlayOpen = configHistoryOpen || profileOpen || authOpen || subscribeOpen || chatSidebarOpen || menuDrawerOpen

  return (
    <main
      className="mobile-studio-app"
      data-theme={mobileTheme}
      data-mode={appMode}
      data-access-banner={accessBannerVisible ? "visible" : "hidden"}
      data-topbar={topbarDetached ? "detached" : "top"}
      data-overlay-open={mobileOverlayOpen ? "true" : "false"}
    >
      <MobileFloatingTopBar
        authUser={authUser}
        language={language}
        onLanguage={toggleLanguage}
        onProfile={() => setProfileOpen(true)}
        onMenu={() => {
          if (accessKind === "login") {
            triggerAccessBanner()
            return
          }
          setMenuDrawerOpen(true)
        }}
      />
      <div className="mobile-shared-mode-bar">
        <MobileModeSwitch mode={appMode} setMode={setAppMode} labels={{ config: t.configMode, chat: t.chatMode }} />
      </div>
      <div className="mobile-access-banner-layer" aria-live="polite">
        <AnimatePresence initial={false}>
          {accessKind && (
            <MobileAccessBanner
              key="mobile-access-banner"
              kind={accessKind}
              language={language}
              billing={billing}
              shaking={accessBannerShaking && accessBannerShakeKind === accessKind}
              onClick={openAccessDestination}
            />
          )}
        </AnimatePresence>
      </div>
      <section className={visibleModes.length > 1 ? "mobile-studio-phone is-transitioning" : "mobile-studio-phone"} data-transition-direction={modeTransitionDirection}>
        {activeMenu !== "edit" && (
          <div className="mobile-coming-soon">
            <p>{language === "zh" ? "即将上线" : "Coming Soon"}</p>
          </div>
        )}
        {activeMenu === "edit" && visibleModes.map((mode) => {
          const frameProps: MobileStudioAppProps = {
            ...props,
            appMode: mode,
            mobileAccessKind: mode === appMode ? accessKind : null,
            onMobileAccessBlocked: triggerAccessBanner,
          }
          const transitionState = visibleModes.length > 1 ? (mode === appMode ? "enter" : "exit") : "current"

          return (
            <div key={mode} className="mobile-mode-frame" data-transition-state={transitionState}>
              {mode === "config" ? (
                <MobileConfigMode {...frameProps} />
              ) : (
                <MobileChatMode {...frameProps} mobileSidebarOpen={chatSidebarOpen} setMobileSidebarOpen={setChatSidebarOpen} onSessionsChange={(sessions: ChatSession[], activeSessionId: string) => { setChatSessions(sessions); setChatActiveSessionId(activeSessionId) }} pendingSessionId={pendingChatSessionId} onPendingSessionConsumed={() => setPendingChatSessionId(null)} />
              )}
            </div>
          )
        })}
      </section>
      <MobileMenuDrawer
        open={menuDrawerOpen}
        onClose={() => setMenuDrawerOpen(false)}
        language={language}
        appMode={appMode}
        chatSessions={chatSessions}
        chatActiveSessionId={chatActiveSessionId}
        onSelectChatSession={handleSelectChatSession}
        generationHistory={props.history}
        generationJob={props.job}
        onSelectGenerationHistory={props.selectHistoryJob}
        onDeleteGenerationHistory={props.deleteHistoryJob}
        formatHistoryTitle={props.formatHistoryTitle}
        onSelect={(menu) => {
          setMenuDrawerOpen(false)
          setActiveMenu(menu)
        }}
      />
      <MobileHistoryDrawer open={configHistoryOpen} onClose={() => setConfigHistoryOpen(false)} {...props} />
      <MobileProfilePage open={profileOpen} onClose={() => setProfileOpen(false)} {...props} />

      <AuthModal
        open={authOpen}
        language={language}
        mobileTheme={mobileTheme}
        onClose={() => setAuthOpen(false)}
        onAuthed={onAuthed}
      />
      <SubscribeModal
        open={subscribeOpen}
        language={language}
        mobileTheme={mobileTheme}
        billing={billing}
        onClose={() => setSubscribeOpen(false)}
        onUpdated={onBillingUpdated}
      />

      <div className="mobile-account-rail" aria-hidden={authOpen || subscribeOpen}>
        {authUser ? (
          <>
            <button type="button" onClick={() => setSubscribeOpen(true)}>
              <BadgeCheck size={15} />
              {t.member}
            </button>
            <button type="button" onClick={logout}>
              {t.logout}
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setAuthOpen(true)}>
            <KeyRound size={15} />
            {t.login}
          </button>
        )}
        <button type="button" onClick={toggleLanguage}>
          <Languages size={15} />
          {language === "en" ? "EN" : "中"}
        </button>
      </div>
    </main>
  )
}

function mobileAccessKindFor(appMode: AppMode, authUser: AuthUser | null, billing: EntitlementStatus | null): MobileAccessKind {
  if (!authUser) return "login"
  if (!billing) return null
  if (appMode === "config" && billing.configRemaining === 0) return "config_quota"
  if (appMode === "chat" && (!billing.chatEnabled || billing.chatRemainingToday === 0)) return "chat_quota"
  return null
}

function MobileAccessBanner({
  kind,
  language,
  billing,
  shaking,
  onClick,
}: {
  kind: Exclude<MobileAccessKind, null>
  language: Language
  billing: EntitlementStatus | null
  shaking: boolean
  onClick: () => void
}) {
  const copy = withBannerArrow(kind === "login" ? mobileLoginBannerCopy(language) : mobileQuotaBannerCopy(language, billing))

  return (
    <motion.button
      type="button"
      className={`mobile-access-banner ${kind}${shaking ? " is-shaking" : ""}`}
      onClick={onClick}
      initial={{ opacity: 0, y: -8, scaleY: 0.96 }}
      animate={{
        opacity: 1,
        y: 0,
        scaleY: 1,
      }}
      exit={{ opacity: 0, y: -6, scaleY: 0.96 }}
      transition={{
        opacity: { duration: 0.18 },
        y: { duration: 0.18 },
        scaleY: { duration: 0.18 },
      }}
      aria-live="polite"
      aria-label={copy}
    >
      <motion.span
        key={copy}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.18 }}
      >
        {copy}
      </motion.span>
    </motion.button>
  )
}

function withBannerArrow(copy: string) {
  return copy.trim().endsWith("→") ? copy : `${copy} →`
}

function mobileLoginBannerCopy(language: Language) {
  return language === "zh" ? "立即登录，解锁更多功能 →" : "Sign in to unlock more tools →"
}

function mobileQuotaBannerCopy(language: Language, billing: EntitlementStatus | null) {
  const planId = billing?.plan.id || "free"
  if (planId === "max") {
    return language === "zh" ? "当前额度不足，请稍后再试或重置额度" : "Quota is empty. Try again later or reset quota"
  }
  if (planId === "pro") {
    return language === "zh" ? "当前额度不足，升级会员解锁更多额度" : "Quota is empty. Upgrade for more quota"
  }
  return language === "zh" ? "当前额度不足，订阅会员解锁更多功能" : "Quota is empty. Subscribe to unlock more tools"
}

export function MobileLoadingScreen({ language = "zh" }: { language?: Language }) {
  return (
    <main className="mobile-loading-screen" aria-live="polite">
      <div className="mobile-loading-orbit" aria-hidden="true">
        <span />
        <i />
        <b />
      </div>
      <div className="mobile-loading-copy">
        <span>{language === "zh" ? "正在加载工作室" : "Loading…"}</span>
      </div>
      <div className="mobile-loading-progress" aria-hidden="true">
        <em />
      </div>
    </main>
  )
}

function MobileConfigMode(props: MobileStudioAppProps) {
  const {
    language,
    t,
    inputRef,
    onFile,
    vehiclePreview,
    vehicleNote,
    setVehicleNote,
    setVehicleNoteEdited,
    vehicleDisplayName,
    vehicleRecognitionError,
    selectedAssets,
    colorPolicyAssets,
    selectedPaintLabel,
    stanceName,
    viewMode,
    setViewMode,
    compareKey,
    job,
    isGenerating,
    generationElapsedSeconds,
    generationDurationSeconds,
    generationProgress,
    setIsGenerating,
    generate,
    canGenerate,
    saveResult,
    clearCurrentConfig,
    notice,
    authUser,
    setAuthOpen,
    setSubscribeOpen,
    logout,
    toggleLanguage,
    mobileAccessKind,
    onMobileAccessBlocked,
  } = props
  const [sheet, setSheet] = useState<MobileSheet>(null)
  const [isDockAtPageBottom, setIsDockAtPageBottom] = useState(false)
  const [mediaChromeHidden, setMediaChromeHidden] = useState(false)
  const mobileExhaustCategory = props.catalog?.categories.find((category) => category.id === "exhaust")
  const mobileExhaustLayoutLabels = useMemo(() => buildMobileExhaustLayoutLabels(mobileSubcategoryConfigToLayoutGroups(mobileExhaustCategory?.subcategoryConfig)), [mobileExhaustCategory?.subcategoryConfig])
  const isLoginBlocked = mobileAccessKind === "login"
  const isGenerateBlocked = mobileAccessKind === "login" || mobileAccessKind === "config_quota"
  const generatedResultUrl = job?.status === "succeeded" ? job.resultImageUrl : ""
  const safeVehiclePreview = canvasSafeImageUrl(vehiclePreview)
  const safeGeneratedResultUrl = canvasSafeImageUrl(generatedResultUrl)
  const hasGenerated = Boolean(generatedResultUrl)
  const canToggleMediaChrome = hasGenerated
  const mediaCardClassName = [
    "mobile-media-card",
    hasGenerated ? "is-compare" : "",
    canToggleMediaChrome ? "can-toggle-chrome" : "",
    mediaChromeHidden ? "chrome-hidden" : "",
  ].filter(Boolean).join(" ")
  const summaryText = selectedAssets.map((asset) => mobileDisplaySelectedAssetSummary(asset, language, mobileExhaustLayoutLabels)).join(" / ") || selectedPaintLabel
  const progressText = generationProgress?.message || t.running
  const completedElapsed = hasGenerated && generationDurationSeconds !== null && !isGenerating ? generationDurationSeconds : null
  const isDockExpanded = isDockAtPageBottom
  const dockLabels = {
    parts: language === "zh" ? "配件" : "Parts",
    paint: language === "zh" ? "颜色" : "Paint",
    stance: language === "zh" ? "高度" : "Height",
    details: language === "zh" ? "\u7ec6\u8282" : "Details",
  }
  const blockMobileAccess = () => onMobileAccessBlocked?.()
  const openSheet = (nextSheet: MobileSheet) => {
    if (isLoginBlocked) {
      blockMobileAccess()
      return
    }
    setSheet(nextSheet)
  }
  const runMobileAction = (action: () => void, consumeQuota = false) => {
    if (isLoginBlocked || (consumeQuota && isGenerateBlocked)) {
      blockMobileAccess()
      return
    }
    action()
  }

  useEffect(() => {
    const bottomThreshold = 24
    let frameId = 0

    const updateDockPosition = () => {
      frameId = 0
      const bottomDistance = document.documentElement.scrollHeight - window.scrollY - window.innerHeight
      setIsDockAtPageBottom(bottomDistance <= bottomThreshold)
    }

    const requestDockPositionUpdate = () => {
      if (frameId) return
      frameId = window.requestAnimationFrame(updateDockPosition)
    }

    requestDockPositionUpdate()
    window.addEventListener("scroll", requestDockPositionUpdate, { passive: true })
    window.addEventListener("resize", requestDockPositionUpdate)

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId)
      window.removeEventListener("scroll", requestDockPositionUpdate)
      window.removeEventListener("resize", requestDockPositionUpdate)
    }
  }, [])

  useEffect(() => {
    if (isLoginBlocked) setSheet(null)
  }, [isLoginBlocked])

  useEffect(() => {
    if (!canToggleMediaChrome) setMediaChromeHidden(false)
  }, [canToggleMediaChrome])

  return (
    <section className="mobile-screen mobile-config-screen">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        hidden
        onChange={(event) => {
          onFile(event.target.files?.[0])
          event.currentTarget.value = ""
        }}
      />
      <div className="mobile-shared-mode-spacer" aria-hidden="true" />
      <section className={mediaCardClassName}>
        <button
          type="button"
          className={`${vehiclePreview ? "mobile-media-upload has-image" : "mobile-media-upload"}${canToggleMediaChrome ? " can-toggle-chrome" : ""}${!vehiclePreview ? "" : " view-only"}`}
          disabled={!vehiclePreview}
          aria-label={canToggleMediaChrome ? (mediaChromeHidden ? (language === "zh" ? "\u663e\u793a\u56fe\u7247\u63a7\u4ef6" : "Show image controls") : (language === "zh" ? "\u9690\u85cf\u56fe\u7247\u63a7\u4ef6" : "Hide image controls")) : undefined}
          onClick={() => {
            if (isLoginBlocked) {
              blockMobileAccess()
              return
            }
            if (canToggleMediaChrome) {
              setMediaChromeHidden((hidden) => !hidden)
              return
            }
            inputRef.current?.click()
          }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            if (isLoginBlocked) {
              blockMobileAccess()
              return
            }
            onFile(event.dataTransfer.files[0])
          }}
        >
          {vehiclePreview ? (
            hasGenerated ? (
              <ImageComparisonSlider
                key={compareKey}
                beforeSrc={safeVehiclePreview}
                afterSrc={safeGeneratedResultUrl}
                altBefore="Original vehicle"
                altAfter="Generated vehicle"
                autoPlay
              />
            ) : (
              <span className="mobile-upload-empty">
                <Sparkles size={30} />
                <strong>{language === "zh" ? "\u70b9\u51fb\u751f\u6210\u67e5\u770b\u5bf9\u6bd4\u6548\u679c" : "Generate to compare"}</strong>
              </span>
            )
          ) : (
            <span className="mobile-upload-empty">
              <Upload size={30} />
              <strong>{t.upload}</strong>
            </span>
          )}
        </button>
        <label className="mobile-recognition-badge" htmlFor="mobile-vehicle-note" aria-hidden={canToggleMediaChrome && mediaChromeHidden}>
          <span>{t.detected}</span>
          <input
            id="mobile-vehicle-note"
            value={vehicleNote}
            onChange={(event) => {
              if (isLoginBlocked) return
              setVehicleNote(event.target.value)
              setVehicleNoteEdited(true)
            }}
            placeholder={vehicleDisplayName}
            disabled={isLoginBlocked || (!vehiclePreview && !vehicleNote)}
          />
        </label>
        {completedElapsed !== null && <span className="mobile-elapsed-badge">{`${t.elapsed} ${completedElapsed}${t.elapsedUnit}`}</span>}
        {isGenerating && (
          <div className="mobile-progress-layer">
            <strong>{progressText}</strong>
            <div className="mobile-progress-line">
              <span />
            </div>
            <small>{language === "zh" ? `已等待 ${generationElapsedSeconds} 秒` : `Waiting ${generationElapsedSeconds}s`}</small>
            <button type="button" onClick={() => setIsGenerating(false)}>
              {t.cancel}
            </button>
          </div>
        )}
      </section>

      <div className="mobile-config-actions">
        <button type="button" className="mobile-action-clear" onClick={() => runMobileAction(clearCurrentConfig)}>
          <X size={15} />
          {language === "zh" ? "\u6e05\u7a7a" : "Clear"}
        </button>
        <button type="button" className="mobile-action-save" disabled={!hasGenerated} onClick={() => runMobileAction(() => saveResult("compare"))}>
          <ArrowDownToLine size={15} />
          {language === "zh" ? "\u4fdd\u5b58" : "Save"}
        </button>
        <button type="button" className="mobile-action-generate" onClick={() => runMobileAction(generate, true)} disabled={!canGenerate}>
          <Wand2 size={16} />
          {isGenerating ? t.running : t.run}
        </button>
      </div>

      <section className="mobile-config-summary">
        <div>
          <strong>{selectedAssets.length ? `${selectedAssets.length} ${selectedAssets.length === 1 ? t.partSelected : t.partsSelected}` : t.noParts}</strong>
          <span>{summaryText} / {stanceName}</span>
          {vehicleRecognitionError && <em>{vehicleRecognitionError}</em>}
        </div>
        <div className="mobile-summary-meter">
          <span>{selectedAssets.length}</span>
        </div>
      </section>

      <nav className={isDockExpanded ? "mobile-dock is-expanded" : "mobile-dock is-collapsed"} aria-label="Mobile configuration controls">
        <button type="button" className={sheet === "parts" ? "active" : ""} aria-label={dockLabels.parts} onClick={() => openSheet("parts")}>
          <SlidersHorizontal size={18} />
          <span className="mobile-dock-label">{dockLabels.parts}</span>
        </button>
        <button type="button" className={sheet === "paint" ? "active" : ""} aria-label={dockLabels.paint} onClick={() => openSheet("paint")}>
          <Palette size={18} />
          <span className="mobile-dock-label">{dockLabels.paint}</span>
        </button>
        <button type="button" className={sheet === "stance" ? "active" : ""} aria-label={dockLabels.stance} onClick={() => openSheet("stance")}>
          <Layers3 size={18} />
          <span className="mobile-dock-label">{dockLabels.stance}</span>
        </button>
        <button type="button" className={sheet === "details" ? "active details" : "details"} aria-label={dockLabels.details} onClick={() => openSheet("details")}>
          <Sparkles size={18} />
          <span className="mobile-dock-label">{dockLabels.details}</span>
        </button>
      </nav>

      {notice && <p className="mobile-notice">{notice}</p>}

      <MobileControlSheet sheet={sheet} setSheet={setSheet} {...props} />
    </section>
  )
}

function MobileControlSheet({ sheet, setSheet, ...props }: MobileStudioAppProps & { sheet: MobileSheet; setSheet: (sheet: MobileSheet) => void }) {
  const title =
    sheet === "parts"
      ? props.language === "zh"
        ? "配件选择"
        : "Parts"
      : sheet === "paint"
        ? props.language === "zh"
          ? "车身颜色"
          : "Paint"
        : sheet === "stance"
          ? props.language === "zh"
            ? "车身高度"
            : "Ride height"
          : sheet === "details"
            ? props.language === "zh"
              ? "\u7ec6\u8282\u8bbe\u7f6e"
              : "Details"
            : props.t.history

  return (
    <AnimatePresence>
      {sheet && (
      <motion.button
        key="mobile-sheet-backdrop"
        type="button"
        className="mobile-sheet-backdrop"
        aria-label="Close sheet"
        onClick={() => setSheet(null)}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />
      )}
      {sheet && (
      <motion.section
        key={`mobile-control-sheet-${sheet}`}
        className="mobile-control-sheet"
        initial={{ y: "105%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "105%", opacity: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 30 }}
      >
        <div className="mobile-sheet-handle" />
        <header className="mobile-sheet-head">
          <div>
            <h2>{title}</h2>
          </div>
          <button type="button" onClick={() => setSheet(null)} aria-label="Close sheet">
            <X size={18} />
          </button>
        </header>
        {sheet === "parts" && <MobilePartsSheet {...props} />}
        {sheet === "paint" && <MobilePaintSheet {...props} />}
        {sheet === "stance" && <MobileStanceSheet {...props} />}
        {sheet === "details" && <MobileDetailsSheet {...props} />}
        {sheet === "history" && <MobileHistorySheet {...props} setSheet={setSheet} />}
      </motion.section>
      )}
    </AnimatePresence>
  )
}

function MobilePartsSheet({
  language,
  t,
  catalog,
  categories,
  selections,
  selectAsset,
  brandFilters,
  setBrandFilters,
  assetSearch,
  setAssetSearch,
  assetSuggestions,
  revealAsset,
  expandedCategory,
  setExpandedCategory,
  expandedCaliperAssetId,
  setExpandedCaliperAssetId,
  focusedAssetId,
  selectionOptions,
  selectedCaliperAsset,
  selectedSurfaceAssets,
  updatePartSelectionOption,
  toggleDryCarbonPart,
}: MobileStudioAppProps) {
  const search = assetSearch.trim().toLowerCase()
  const dropdownRef = useRef<HTMLDivElement | null>(null)
  const categoryRefs = useRef<Record<string, HTMLElement | null>>({})
  const [riskPopup, setRiskPopup] = useState<{ id: string; top: number; left: number; width: number } | null>(null)

  useEffect(() => {
    if (!riskPopup) return
    const close = () => setRiskPopup(null)
    window.addEventListener("scroll", close, true)
    window.addEventListener("resize", close)
    return () => {
      window.removeEventListener("scroll", close, true)
      window.removeEventListener("resize", close)
    }
  }, [riskPopup])

  const showRiskPopup = (element: HTMLElement, id: string) => {
    const rect = element.getBoundingClientRect()
    const width = Math.min(280, window.innerWidth - 24)
    const left = Math.min(window.innerWidth - width - 12, Math.max(12, rect.right - width))
    const top = Math.min(window.innerHeight - 100, Math.max(12, rect.bottom + 8))
    setRiskPopup({ id, top, left, width })
  }

  const mobileCategoryById = useMemo(() => new Map(catalog?.categories.map((category) => [category.id, category]) ?? []), [catalog])
  const mobileFixedStyleAssetIdByCategory = useMemo(() => (catalog ? buildMobileFixedStyleAssetIdMap(catalog.categories, catalog.assets) : {}), [catalog])
  const mobileExhaustCategory = catalog?.categories.find((category) => category.id === "exhaust")
  const mobileExhaustLayoutGroups = useMemo(() => mobileSubcategoryConfigToLayoutGroups(mobileExhaustCategory?.subcategoryConfig), [mobileExhaustCategory?.subcategoryConfig])
  const mobileExhaustLayoutLabels = useMemo(() => buildMobileExhaustLayoutLabels(mobileExhaustLayoutGroups), [mobileExhaustLayoutGroups])
  const toggleCategory = (categoryId: string, isOpen: boolean) => {
    setExpandedCategory(isOpen ? "" : categoryId)
    if (!isOpen) {
      const card = categoryRefs.current[categoryId]
      mobileScheduleAccordionCardScroll(card, dropdownRef.current ?? card?.closest<HTMLElement>(".mobile-control-sheet") ?? null)
    }
  }

  return (
    <section className="mobile-parts-panel parts-selector-block">
      <button type="button" className="parts-select-trigger">
        <span>{language === "zh" ? "当前配件组合" : "Current parts"}</span>
        <strong>{Object.keys(selections).length ? `${Object.keys(selections).length} ${t.partsSelected}` : t.noParts}</strong>
        <em>{language === "zh" ? "展开" : "Open"}</em>
      </button>
      <div className="parts-dropdown open">
        <div className="parts-dropdown-inner" ref={dropdownRef}>
          <label className="parts-search">
            <Search size={15} />
            <input value={assetSearch} onChange={(event) => setAssetSearch(event.target.value)} placeholder={t.searchParts} />
          </label>
          {assetSuggestions.length > 0 && (
            <div className="parts-suggestion-list" role="listbox" aria-label="Part search suggestions">
              {assetSuggestions.map(({ asset, categoryLabel }) => (
                <button key={asset.id} type="button" onClick={() => revealAsset(asset)}>
                  <span>{categoryLabel}</span>
                  <strong>{mobileDisplayAssetTitle(asset, mobileExhaustLayoutLabels)}</strong>
                  <em>{mobileDisplayAssetSubtitle(asset)}</em>
                </button>
              ))}
            </div>
          )}
          <section className="parts-accordion">
            {categories.map((category) => {
              const isOpen = expandedCategory === category.id
              const isDryCarbonCategory = category.id === mobileDryCarbonCategoryId
              const categoryBrands = isMobileBrandResourceCategory(category) ? catalog.brands.filter((brand) => brand.categoryId === category.id) : []
              const activeBrandId = brandFilters[category.id] || categoryBrands[0]?.id || ""
              const categoryAssets = catalog.assets.filter((asset) => {
                if (asset.categoryId !== category.id) return false
                if (!isMobileConfigAssetVisible(asset, mobileFixedStyleAssetIdByCategory)) return false
                if (activeBrandId && categoryBrands.length && asset.brandId !== activeBrandId) return false
                if (!search) return true
                return [asset.brand, asset.model, asset.variant, asset.color, asset.finish, category.label].some((value) =>
                  value.toLowerCase().includes(search),
                )
              })
              const selectedAsset = catalog.assets.find((asset) => selections[category.id] === asset.id)
              const selectedDryCarbonParts = isDryCarbonCategory ? mobileSelectedDryCarbonPartsFor(selections) : []

              return (
                <article
                  key={category.id}
                  ref={(node) => {
                    categoryRefs.current[category.id] = node
                  }}
                  className={isOpen ? "accordion-card expanded" : "accordion-card"}
                >
                  <button type="button" className="accordion-trigger" onClick={() => toggleCategory(category.id, isOpen)}>
                    <span className="accordion-mark">{isOpen ? <X size={16} /> : <Plus size={16} />}</span>
                    <span className="accordion-copy">
                      <span className="accordion-label-row">
                        <strong>{category.label}</strong>
                        {riskInfoCategoryIds.has(category.id) && (
                          <span
                            role="button"
                            tabIndex={0}
                            className={`accordion-risk-icon${riskPopup?.id === category.id ? " active" : ""}`}
                            aria-label={language === "zh" ? "风险提示" : "Risk notice"}
                            onClick={(event) => {
                              event.stopPropagation()
                              if (riskPopup?.id === category.id) setRiskPopup(null)
                              else showRiskPopup(event.currentTarget, category.id)
                            }}
                          >
                            <CircleHelp size={14} />
                          </span>
                        )}
                      </span>
                      <small>{isDryCarbonCategory ? mobileDisplayDryCarbonCategorySelectionStatus(language, selectedDryCarbonParts) : mobileDisplayCategorySelectionStatus(language, selectedAsset, mobileExhaustLayoutLabels)}</small>
                    </span>
                    {(selectedAsset || selectedDryCarbonParts.length > 0) && <BadgeCheck className="selected-check" size={15} />}
                  </button>
                  <div className="accordion-content" aria-hidden={!isOpen}>
                      <div className="accordion-content-inner">
                        {categoryBrands.length > 0 && (
                          <div className="brand-filter-row">
                            <span>{t.chooseBrand}</span>
                            {categoryBrands.map((brand) => (
                              <button key={brand.id} className={activeBrandId === brand.id ? "selected" : ""} onClick={() => setBrandFilters((current) => ({ ...current, [category.id]: brand.id }))}>
                                {brand.label}
                              </button>
                            ))}
                          </div>
                        )}
                        {isDryCarbonCategory ? (
                          <MobileDryCarbonPartsList
                            language={language}
                            catalog={catalog}
                            selections={selections}
                            focusedAssetId={focusedAssetId}
                            search={search}
                            toggleDryCarbonPart={toggleDryCarbonPart}
                          />
                        ) : categoryAssets.length ? (
                          isMobileResourceSubcategoryCategory(category) ? (
                            <MobileExhaustLayoutList
                              language={language}
                              assets={categoryAssets}
                              selectedAssetId={selections[category.id]}
                              focusedAssetId={focusedAssetId}
                              selectAsset={selectAsset}
                              layoutGroups={mobileExhaustLayoutGroups}
                              layoutLabels={mobileExhaustLayoutLabels}
                            />
                          ) : isMobileBrandResourceCategory(category) && category.id === "calipers" ? (
                            <MobileCaliperCaseList
                              language={language}
                              assets={categoryAssets}
                              selectedAssetId={selections.calipers}
                              expandedAssetId={expandedCaliperAssetId}
                              focusedAssetId={focusedAssetId}
                              selectionOptions={selectionOptions}
                              selectAsset={selectAsset}
                              setExpandedAssetId={setExpandedCaliperAssetId}
                              updatePartSelectionOption={updatePartSelectionOption}
                            />
                          ) : isMobileResourceWithImageCategory(category) ? (
                            <MobileWingStyleList
                              language={language}
                              assets={categoryAssets}
                              selectedAssetId={selections[category.id]}
                              focusedAssetId={focusedAssetId}
                              selectionOptions={selectionOptions}
                              selectAsset={selectAsset}
                              updatePartSelectionOption={updatePartSelectionOption}
                            />
                          ) : isMobileResourceNoImageCategory(category) ? (
                            <MobileSurfaceInstallControl
                              language={language}
                              asset={categoryAssets[0]}
                              selectedAssetId={selections[category.id]}
                              focusedAssetId={focusedAssetId}
                              selectionOptions={selectionOptions}
                              selectAsset={selectAsset}
                              updatePartSelectionOption={updatePartSelectionOption}
                            />
                          ) : (
                            <div className="asset-grid">
                              {categoryAssets.map((asset) => {
                                const isAssetSelected = selections[asset.categoryId] === asset.id
                                return (
                                  <button
                                    key={asset.id}
                                    type="button"
                                    data-asset-id={asset.id}
                                    className={`${isAssetSelected ? "asset-card selected" : "asset-card"} ${focusedAssetId === asset.id ? "spotlight" : ""}`.trim()}
                                    onClick={() => selectAsset(asset)}
                                  >
                                    <img src={asset.imageUrl} alt={`${mobileDisplayAssetTitle(asset, mobileExhaustLayoutLabels)} ${mobileDisplayAssetSubtitle(asset)}`} style={{ objectPosition: asset.imageCrop || "center" }} />
                                    <strong>{mobileDisplayAssetTitle(asset, mobileExhaustLayoutLabels)}</strong>
                                    <span>{mobileDisplayAssetSubtitle(asset)}</span>
                                    <small>{asset.finish}</small>
                                  </button>
                                )
                              })}
                            </div>
                          )
                        ) : (
                          <div className="empty-category">{t.emptyCategory}</div>
                        )}
                      </div>
                  </div>
                </article>
              )
            })}
          </section>
          <MobilePartOptionsPanel
            language={language}
            selectionOptions={selectionOptions}
            selectedSurfaceAssets={selectedSurfaceAssets}
            updatePartSelectionOption={updatePartSelectionOption}
          />
        </div>
      </div>
      {riskPopup &&
        createPortal(
          <div
            className="wing-style-popover wing-style-popover-tap"
            style={{ top: riskPopup.top, left: riskPopup.left, "--wing-style-popover-width": `${riskPopup.width}px` } as CSSProperties}
            role="dialog"
          >
            <p>{riskTooltipText(language)}</p>
          </div>,
          document.body,
        )}
    </section>
  )
}

function MobileCaliperCaseList({
  language,
  assets,
  selectedAssetId,
  expandedAssetId,
  focusedAssetId,
  selectionOptions,
  selectAsset,
  setExpandedAssetId,
  updatePartSelectionOption,
}: {
  language: Language
  assets: PartAsset[]
  selectedAssetId?: string
  expandedAssetId: string
  focusedAssetId: string
  selectionOptions: PartSelectionOptions
  selectAsset: (asset: PartAsset) => void
  setExpandedAssetId: (value: string) => void
  updatePartSelectionOption: (categoryId: string, patch: PartSelectionOptions[string]) => void
}) {
  return (
    <div className="caliper-case-list">
      {assets.map((asset) => {
        const selected = selectedAssetId === asset.id
        const expanded = selected && expandedAssetId === asset.id
        return (
          <article key={asset.id} className={`caliper-case-row${selected ? " selected" : ""}${expanded ? " expanded" : ""}${focusedAssetId === asset.id ? " spotlight" : ""}`}>
            <div className="caliper-case-trigger">
              <button
                type="button"
                data-asset-id={asset.id}
                className="caliper-case-main"
                aria-expanded={expanded}
                disabled={!selected}
                onClick={() => setExpandedAssetId(expanded ? "" : asset.id)}
              >
                <span className="caliper-case-thumb">
                  <img src={asset.imageUrl} alt={`${mobileDisplayAssetTitle(asset)} ${mobileDisplayAssetSubtitle(asset)}`} style={{ objectPosition: asset.imageCrop || "center" }} />
                </span>
                <span className="caliper-case-copy">
                  <strong>{mobileDisplayAssetTitle(asset)}</strong>
                  <small>{mobileDisplayAssetSubtitle(asset) || asset.finish}</small>
                </span>
                {selected ? <ChevronDown className={`caliper-case-chevron${expanded ? " expanded" : ""}`} size={18} /> : <span aria-hidden="true" />}
              </button>
              <button
                type="button"
                className={`caliper-case-select-button${selected ? " selected" : ""}`}
                aria-pressed={selected}
                onClick={() => {
                  selectAsset(asset)
                  setExpandedAssetId(selected ? "" : asset.id)
                }}
              >
                {selected && <BadgeCheck size={14} />}
                {language === "zh" ? (selected ? "取消" : "选择") : selected ? "Remove" : "Select"}
              </button>
            </div>
            <div className="caliper-case-content" aria-hidden={!expanded}>
              <div className="caliper-case-content-inner">
                <MobileCaliperCaseControls
                  language={language}
                  selectedAsset={asset}
                  selectionOptions={selectionOptions}
                  updatePartSelectionOption={updatePartSelectionOption}
                />
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}

function MobileDryCarbonPartsList({
  language,
  catalog,
  selections,
  focusedAssetId,
  search,
  toggleDryCarbonPart,
}: {
  language: Language
  catalog: CatalogResponse
  selections: SelectionMap
  focusedAssetId: string
  search: string
  toggleDryCarbonPart: (part: (typeof mobileDryCarbonParts)[number]) => void
}) {
  const assetsById = useMemo(() => new Map(catalog.assets.map((asset) => [asset.id, asset])), [catalog.assets])
  const visibleParts = mobileDryCarbonParts.filter((part) => mobileDryCarbonPartMatchesSearch(part, assetsById.get(part.assetId), search, language))
  const [riskPopup, setRiskPopup] = useState<{ id: string; top: number; left: number; width: number } | null>(null)

  useEffect(() => {
    if (!riskPopup) return
    const close = () => setRiskPopup(null)
    window.addEventListener("scroll", close, true)
    window.addEventListener("resize", close)
    return () => {
      window.removeEventListener("scroll", close, true)
      window.removeEventListener("resize", close)
    }
  }, [riskPopup])

  const showRiskPopup = (element: HTMLElement, id: string) => {
    const rect = element.getBoundingClientRect()
    const width = Math.min(280, window.innerWidth - 24)
    const left = Math.min(window.innerWidth - width - 12, Math.max(12, rect.right - width))
    const top = Math.min(window.innerHeight - 100, Math.max(12, rect.bottom + 8))
    setRiskPopup({ id, top, left, width })
  }

  if (!visibleParts.length) {
    return <div className="empty-category">{language === "zh" ? "没有匹配的干碳纤维部件" : "No matching dry carbon parts"}</div>
  }

  return (
    <>
    <div className="wing-style-list dry-carbon-list">
      {visibleParts.map((part) => {
        const asset = assetsById.get(part.assetId)
        if (!asset) return null
        const selected = selections[part.id] === part.assetId
        return (
          <article key={part.id} className={`wing-style-row dry-carbon-row${selected ? " selected" : ""}${focusedAssetId === asset.id ? " spotlight" : ""}`}>
            <div className="wing-style-trigger">
              <button type="button" data-asset-id={asset.id} className="wing-style-main dry-carbon-main" aria-pressed={selected} onClick={() => toggleDryCarbonPart(part)}>
                <span className="wing-style-thumb">
                  <img src={asset.imageUrl} alt={`${part.label[language]} ${mobileDisplayAssetSubtitle(asset)}`} style={{ objectPosition: asset.imageCrop || "center" }} />
                </span>
                <span className="wing-style-copy">
                  <strong>{part.label[language]}</strong>
                  <small>{language === "zh" ? "裸碳局部材质" : "Exposed carbon part"}</small>
                </span>
                {selected && <BadgeCheck className="wing-style-selected-mark" size={16} />}
              </button>
              {riskInfoCategoryIds.has(part.id) && (
                <button
                  type="button"
                  className={`wing-style-info-button${riskPopup?.id === part.id ? " active" : ""}`}
                  aria-label={language === "zh" ? `${part.label[language]}风险提示` : `${part.label[language]} risk notice`}
                  onClick={(event) => {
                    event.stopPropagation()
                    if (riskPopup?.id === part.id) setRiskPopup(null)
                    else showRiskPopup(event.currentTarget, part.id)
                  }}
                >
                  <CircleHelp size={16} />
                </button>
              )}
            </div>
          </article>
        )
      })}
    </div>
    {riskPopup &&
      createPortal(
        <div
          className="wing-style-popover wing-style-popover-tap"
          style={{ top: riskPopup.top, left: riskPopup.left, "--wing-style-popover-width": `${riskPopup.width}px` } as CSSProperties}
          role="dialog"
        >
          <p>{riskTooltipText(language)}</p>
        </div>,
        document.body,
      )}
    </>
  )
}

function MobileWingStyleList({
  language,
  assets,
  selectedAssetId,
  focusedAssetId,
  selectionOptions,
  selectAsset,
  updatePartSelectionOption,
}: {
  language: Language
  assets: PartAsset[]
  selectedAssetId?: string
  focusedAssetId: string
  selectionOptions: PartSelectionOptions
  selectAsset: (asset: PartAsset) => void
  updatePartSelectionOption: (categoryId: string, patch: PartSelectionOptions[string]) => void
}) {
  const [infoPopup, setInfoPopup] = useState<{ assetId: string; body: string; top: number; left: number; width: number } | null>(null)
  const fixedAssets = assets.filter((asset) => mobileWingStyleInfoById[asset.id])
  const visibleAssets = fixedAssets.length ? fixedAssets : assets

  useEffect(() => {
    if (!infoPopup) return
    const closeOnPointer = (event: Event) => {
      const target = event.target instanceof Element ? event.target : null
      if (target?.closest(".wing-style-info-button")) return
      setInfoPopup(null)
    }
    const close = () => setInfoPopup(null)
    window.addEventListener("pointerdown", closeOnPointer)
    window.addEventListener("scroll", close, true)
    window.addEventListener("resize", close)
    return () => {
      window.removeEventListener("pointerdown", closeOnPointer)
      window.removeEventListener("scroll", close, true)
      window.removeEventListener("resize", close)
    }
  }, [infoPopup])

  return (
    <>
      <div className="wing-style-list">
        {visibleAssets.map((asset) => {
          const selected = selectedAssetId === asset.id
          const info = mobileWingStyleInfoById[asset.id]
          const title = info ? (language === "zh" ? info.zh : info.en) : mobileDisplayAssetTitle(asset)
          const subtitle = info ? (language === "zh" ? info.en : info.zh) : mobileDisplayAssetSubtitle(asset)
          const infoOpen = infoPopup?.assetId === asset.id
          const description = info?.description || asset.promptHint || asset.finish
          return (
            <article key={asset.id} className={`wing-style-row${selected ? " selected" : ""}${infoOpen ? " info-open" : ""}${focusedAssetId === asset.id ? " spotlight" : ""}`}>
              <div className="wing-style-trigger">
                <button
                  type="button"
                  data-asset-id={asset.id}
                  className="wing-style-main"
                  aria-pressed={selected}
                  onClick={() => {
                    setInfoPopup(null)
                    selectAsset(asset)
                  }}
                >
                  <span className="wing-style-thumb">
                    <img src={asset.imageUrl} alt={`${title} ${subtitle}`} style={{ objectPosition: asset.imageCrop || "center" }} />
                  </span>
                  <span className="wing-style-copy">
                    <strong>{title}</strong>
                    <small>{subtitle}</small>
                  </span>
                  {selected && <BadgeCheck className="wing-style-selected-mark" size={16} />}
                </button>
                {info && (
                <button
                  type="button"
                  className={`wing-style-info-button${infoOpen ? " active" : ""}`}
                  aria-expanded={infoOpen}
                  aria-label={language === "zh" ? `${title}说明` : `${subtitle || title} info`}
                  onClick={(event) => {
                    event.stopPropagation()
                    const rect = event.currentTarget.getBoundingClientRect()
                    const width = Math.min(300, window.innerWidth - 24)
                    const nextPopup = {
                      assetId: asset.id,
                      body: description,
                      top: Math.min(window.innerHeight - 132, Math.max(12, rect.bottom + 8)),
                      left: Math.min(window.innerWidth - width - 12, Math.max(12, rect.right - width)),
                      width,
                    }
                    setInfoPopup((current) => {
                      if (current?.assetId === asset.id) return null
                      return nextPopup
                    })
                  }}
                >
                  <CircleHelp size={16} />
                </button>
                )}
              </div>
              <div className="wing-style-content" aria-hidden={!selected}>
                <div className="wing-style-content-inner">
                  <MobileWingSurfaceControls
                    language={language}
                    asset={asset}
                    selectionOptions={selectionOptions}
                    updatePartSelectionOption={updatePartSelectionOption}
                  />
                </div>
              </div>
            </article>
          )
        })}
      </div>
      {infoPopup &&
        createPortal(
          <div className="wing-style-popover wing-style-popover-tap" style={{ top: infoPopup.top, left: infoPopup.left, "--wing-style-popover-width": `${infoPopup.width}px` } as CSSProperties} role="dialog">
            <p>{infoPopup.body}</p>
          </div>,
          document.body,
        )}
    </>
  )
}

function MobileExhaustLayoutList({
  language,
  assets,
  selectedAssetId,
  focusedAssetId,
  selectAsset,
  layoutGroups,
  layoutLabels,
}: {
  language: Language
  assets: PartAsset[]
  selectedAssetId?: string
  focusedAssetId: string
  selectAsset: (asset: PartAsset) => void
  layoutGroups: MobileExhaustLayoutGroup[]
  layoutLabels: Record<string, { zh: string; en: string }>
}) {
  const [expandedGroupId, setExpandedGroupId] = useState("")
  const assetById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets])

  return (
    <div className="wing-style-list exhaust-layout-list">
      {layoutGroups.map((group) => {
        const groupAssets = group.assetIds.map((assetId) => assetById.get(assetId)).filter((asset): asset is PartAsset => Boolean(asset))
        if (!groupAssets.length) return null
        const selectedAsset = selectedAssetId ? groupAssets.find((asset) => asset.id === selectedAssetId) : undefined
        const selected = Boolean(selectedAsset)
        const expanded = expandedGroupId === group.id
        const hasChildren = groupAssets.length > 1
        const primaryAsset = selectedAsset || groupAssets[0]
        const groupLabel = language === "zh" ? group.label.zh : group.label.en
        const status = selectedAsset
          ? language === "zh"
            ? `已选择：${mobileDisplayExhaustLayoutLeafLabel(selectedAsset, language, layoutLabels)}`
            : `Selected: ${mobileDisplayExhaustLayoutLeafLabel(selectedAsset, language, layoutLabels)}`
          : language === "zh"
            ? "未选择"
            : "Not selected"

        return (
          <article key={group.id} className={`wing-style-row exhaust-layout-row${expanded ? " expanded" : ""}${groupAssets.some((asset) => asset.id === focusedAssetId) ? " spotlight" : ""}`}>
            <div className="wing-style-trigger">
              <button
                type="button"
                data-asset-id={selectedAsset?.id || groupAssets[0].id}
                className="wing-style-main exhaust-layout-main"
                aria-expanded={hasChildren ? expanded : undefined}
                aria-pressed={selected}
                onClick={() => {
                  if (hasChildren) {
                    setExpandedGroupId((current) => (current === group.id ? "" : group.id))
                    return
                  }
                  setExpandedGroupId("")
                  selectAsset(groupAssets[0])
                }}
              >
                <span className="wing-style-thumb">
                  <img src={primaryAsset.imageUrl} alt={`${groupLabel} ${status}`} style={{ objectPosition: primaryAsset.imageCrop || "center" }} />
                </span>
                <span className="wing-style-copy">
                  <strong>{groupLabel}</strong>
                  <small>{status}</small>
                </span>
                {selected ? (
                  <BadgeCheck className="wing-style-selected-mark" size={16} />
                ) : hasChildren ? (
                  <ChevronDown className={`exhaust-layout-chevron${expanded ? " expanded" : ""}`} size={16} />
                ) : (
                  <span aria-hidden="true" />
                )}
              </button>
            </div>
            {hasChildren && (
              <div className="wing-style-content exhaust-layout-content" aria-hidden={!expanded}>
                <div className="wing-style-content-inner">
                  <div className="exhaust-layout-children">
                    <strong className="exhaust-layout-icon" aria-label={language === "zh" ? "排气位置" : "Exhaust position"} title={language === "zh" ? "排气位置" : "Exhaust position"}>
                      <MobileExhaustPipeIcon />
                    </strong>
                    <div className="exhaust-layout-option-row">
                    {groupAssets.map((asset) => {
                      const childSelected = selectedAssetId === asset.id
                      const childLabel = mobileChildExhaustLayoutLabel(group, asset.id, language)
                      return (
                        <button
                          key={asset.id}
                          type="button"
                          data-asset-id={asset.id}
                          className={`exhaust-layout-child${childSelected ? " selected" : ""}${focusedAssetId === asset.id ? " spotlight" : ""}`}
                          aria-pressed={childSelected}
                          onClick={() => selectAsset(asset)}
                        >
                          {childLabel}
                        </button>
                      )
                    })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </article>
        )
      })}
    </div>
  )
}

function MobileSurfaceInstallControl({
  language,
  asset,
  selectedAssetId,
  focusedAssetId,
  selectionOptions,
  selectAsset,
  updatePartSelectionOption,
}: {
  language: Language
  asset: PartAsset
  selectedAssetId?: string
  focusedAssetId: string
  selectionOptions: PartSelectionOptions
  selectAsset: (asset: PartAsset) => void
  updatePartSelectionOption: (categoryId: string, patch: PartSelectionOptions[string]) => void
}) {
  const selected = selectedAssetId === asset.id
  const title = mobileDisplayAssetTitle(asset)
  const ariaLabel = selected ? (language === "zh" ? `取消安装${title}` : `Remove ${title}`) : language === "zh" ? `安装${title}` : `Install ${title}`

  return (
    <div className={`surface-install-control${selected ? " selected" : ""}${focusedAssetId === asset.id ? " spotlight" : ""}`}>
      <button type="button" data-asset-id={asset.id} className="surface-install-button" aria-label={ariaLabel} aria-pressed={selected} onClick={() => selectAsset(asset)}>
        <i aria-hidden="true" />
      </button>
      <div className="surface-install-options">
        <MobileWingSurfaceControls
          language={language}
          asset={asset}
          selectionOptions={selectionOptions}
          updatePartSelectionOption={updatePartSelectionOption}
        />
      </div>
    </div>
  )
}

function MobileWingSurfaceControls({
  language,
  asset,
  selectionOptions,
  updatePartSelectionOption,
}: {
  language: Language
  asset: PartAsset
  selectionOptions: PartSelectionOptions
  updatePartSelectionOption: (categoryId: string, patch: PartSelectionOptions[string]) => void
}) {
  const activeSurface = selectionOptions[asset.categoryId]?.surfaceColor || mobileInferDefaultSurfaceColor(asset)
  return (
    <div className="wing-surface-controls">
      <strong className="wing-surface-icon-label" aria-label={language === "zh" ? "颜色" : "Color"} title={language === "zh" ? "颜色" : "Color"}>
        <Palette size={14} strokeWidth={2.2} />
      </strong>
      <div className="wing-surface-row" aria-label={language === "zh" ? "颜色/材质" : "Color/material"}>
        {mobileSurfaceColorOptions.map((option) => {
          const selected = activeSurface === option.id
          return (
            <button
              key={option.id}
              type="button"
              className={`wing-surface-chip${selected ? " selected" : ""}`}
              aria-pressed={selected}
              onClick={() => updatePartSelectionOption(asset.categoryId, { surfaceColor: option.id })}
            >
              {option.label[language]}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function MobileCaliperCaseControls({
  language,
  selectedAsset,
  selectionOptions,
  updatePartSelectionOption,
}: {
  language: Language
  selectedAsset: PartAsset
  selectionOptions: PartSelectionOptions
  updatePartSelectionOption: (categoryId: string, patch: PartSelectionOptions[string]) => void
}) {
  const activeColor = selectionOptions.calipers?.caliperColor || mobileInferDefaultCaliperColor(selectedAsset)
  const customColorSelected = mobileIsHexColorValue(activeColor)
  const customColorValue = customColorSelected ? activeColor : "#d71920"
  const activeRotor = selectionOptions.calipers?.rotorOption || "stock"

  return (
    <div className="caliper-case-controls">
      <div className="caliper-case-control-group">
        <div className="caliper-color-dot-row" aria-label={language === "zh" ? "卡钳颜色" : "Caliper color"}>
          {mobileCaliperColorOptions.map((option) => {
            const selected = activeColor === option.id
            return (
              <button
                key={option.id}
                type="button"
                className={`caliper-color-dot${selected ? " selected" : ""}`}
                style={{ "--caliper-color": option.swatch } as CSSProperties}
                aria-label={option.label[language]}
                title={option.label[language]}
                aria-pressed={selected}
                onClick={() => updatePartSelectionOption("calipers", { caliperColor: option.id })}
              />
            )
          })}
          <label className={`caliper-color-picker${customColorSelected ? " selected" : ""}`} aria-label={language === "zh" ? "自定义卡钳颜色" : "Custom caliper color"} title={language === "zh" ? "调色" : "Custom"}>
            <span style={{ "--caliper-color": customColorValue } as CSSProperties} />
            <Palette size={17} />
            <input type="color" value={customColorValue} onChange={(event) => updatePartSelectionOption("calipers", { caliperColor: event.target.value })} />
          </label>
        </div>
      </div>
      <div className="caliper-case-control-group caliper-style-control-group">
        <strong className="caliper-style-icon-label" aria-label={language === "zh" ? "样式" : "Style"} title={language === "zh" ? "样式" : "Style"}>
          <SlidersHorizontal size={14} strokeWidth={2.2} />
        </strong>
        <div className="caliper-rotor-row" aria-label={language === "zh" ? "样式选择" : "Style selection"}>
          {mobileRotorOptions.map((option) => {
            const selected = activeRotor === option.id
            return (
              <button
                key={option.id}
                type="button"
                className={`caliper-rotor-option${selected ? " selected" : ""}`}
                aria-pressed={selected}
                onClick={() => updatePartSelectionOption("calipers", { rotorOption: option.id })}
              >
                {option.label[language]}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function MobileCaliperInlineOptions({
  language,
  selectedAsset,
  selectionOptions,
  updatePartSelectionOption,
}: {
  language: Language
  selectedAsset: PartAsset
  selectionOptions: PartSelectionOptions
  updatePartSelectionOption: (categoryId: string, patch: PartSelectionOptions[string]) => void
}) {
  const activeColor = selectionOptions.calipers?.caliperColor || mobileInferDefaultCaliperColor(selectedAsset)
  const customColorSelected = mobileIsHexColorValue(activeColor)
  const customColorValue = customColorSelected ? activeColor : "#d71920"

  return (
    <div className="caliper-inline-options">
      <div className="caliper-inline-heading">
        <strong>{language === "zh" ? "卡钳配置" : "Caliper setup"}</strong>
        <span>{mobileDisplayAssetTitle(selectedAsset)}</span>
      </div>
      <div className="caliper-inline-row" aria-label={language === "zh" ? "卡钳颜色" : "Caliper color"}>
        {mobileCaliperColorOptions.map((option) => {
          const selected = activeColor === option.id
          return (
            <button
              key={option.id}
              type="button"
              className={`caliper-inline-chip${selected ? " selected" : ""}`}
              aria-pressed={selected}
              onClick={() => updatePartSelectionOption("calipers", { caliperColor: option.id })}
            >
              <span className="caliper-inline-swatch" style={{ background: option.swatch }} />
              {option.label[language]}
            </button>
          )
        })}
        <label className={`caliper-custom-color${customColorSelected ? " selected" : ""}`}>
          <span className="caliper-inline-swatch" style={{ background: customColorValue }} />
          <input type="color" value={customColorValue} onChange={(event) => updatePartSelectionOption("calipers", { caliperColor: event.target.value })} />
          <span>{language === "zh" ? "调色" : "Custom"}</span>
        </label>
      </div>
      <div className="caliper-inline-row" aria-label={language === "zh" ? "刹车盘样式" : "Brake rotor style"}>
        {mobileRotorOptions.map((option) => {
          const selected = (selectionOptions.calipers?.rotorOption || "stock") === option.id
          return (
            <button
              key={option.id}
              type="button"
              className={`caliper-inline-chip${selected ? " selected" : ""}`}
              aria-pressed={selected}
              onClick={() => updatePartSelectionOption("calipers", { rotorOption: option.id })}
            >
              {option.label[language]}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function MobilePartOptionsPanel({
  language,
  selectionOptions,
  selectedSurfaceAssets,
  updatePartSelectionOption,
}: {
  language: Language
  selectionOptions: PartSelectionOptions
  selectedSurfaceAssets: PartAsset[]
  updatePartSelectionOption: (categoryId: string, patch: PartSelectionOptions[string]) => void
}) {
  if (selectedSurfaceAssets.length === 0) return null

  return (
    <article className="mobile-sheet-card part-v2-options-card">
      <h3>{language === "zh" ? "配件细项" : "Part options"}</h3>
      {selectedSurfaceAssets.map((asset) => (
        <div key={asset.id} className="part-v2-option-group">
          <div className="part-v2-option-heading">
            <strong>{mobileDisplayAssetTitle(asset)}</strong>
            <span>{language === "zh" ? "颜色/材质" : "Color/material"}</span>
          </div>
          <div className="part-v2-segment-row">
            {mobileSurfaceColorOptions.map((option) => {
              const selected = (selectionOptions[asset.categoryId]?.surfaceColor || mobileInferDefaultSurfaceColor(asset)) === option.id
              return (
                <button key={option.id} type="button" className={`part-v2-chip${selected ? " selected" : ""}`} onClick={() => updatePartSelectionOption(asset.categoryId, { surfaceColor: option.id })}>
                  <span className="part-v2-swatch" style={{ background: option.swatch }} />
                  {option.label[language]}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </article>
  )
}

function MobilePaintSheet({
  language,
  t,
  catalog,
  paintId,
  setPaintId,
  paintChoices,
  setPaintFinishEffect,
  setDraftPaintFinishEffect,
  selectedPaintLabel,
  customColorOpen,
  setCustomColorOpen,
  customPaintHex,
  customPaintRgb,
  customPaintPreviewHex,
  setCustomColorFromHex,
  setCustomRgbChannel,
  applyCustomPaint,
  customPaintApplied,
  customPickerHsv,
  setCustomSvFromPointer,
  setCustomHue,
  gradientFromHex,
  gradientToHex,
  gradientFrom,
  gradientTo,
  gradientPaintValid,
  setGradientColor,
  setGradientRgbChannel,
  applyGradientPaint,
  gradientPaintApplied,
  selectPaintFinishEffect,
  draftPaintFinishEffect,
  colorPolicyAssets,
  selectAssetColorPolicy,
}: MobileStudioAppProps) {
  const isGradientEditorOpen = draftPaintFinishEffect === "gradient"
  const [effectsExpanded, setEffectsExpanded] = useState(false)
  const showEffectOptions = effectsExpanded || customColorOpen
  const collapsePaintOptions = () => {
    setCustomColorOpen(false)
    setEffectsExpanded(false)
  }
  const expandPaintOptions = () => {
    setEffectsExpanded(true)
    selectPaintFinishEffect(draftPaintFinishEffect || "gloss")
  }
  const gradientControls = [
    { slot: "from" as const, label: language === "zh" ? "起始色" : "Start color", hex: gradientFromHex, preview: gradientFrom },
    { slot: "to" as const, label: language === "zh" ? "结束色" : "End color", hex: gradientToHex, preview: gradientTo },
  ]

  return (
    <section className="mobile-paint-panel">
      <div className="mobile-paint-primary-stack">
      <article className="mobile-sheet-card paint-card">
        <div className="mobile-paint-card-head">
          <div>
            <h3>{language === "zh" ? "车身颜色" : "Body paint"}</h3>
            <p>{t.colorShown}: {selectedPaintLabel}</p>
          </div>
          <button
            type="button"
            className={showEffectOptions ? "mobile-paint-more active" : "mobile-paint-more"}
            onClick={() => {
              if (showEffectOptions) {
                collapsePaintOptions()
                return
              }
              expandPaintOptions()
            }}
            aria-expanded={showEffectOptions}
          >
            <Palette size={15} />
            {showEffectOptions ? (language === "zh" ? "收起" : "Less") : (language === "zh" ? "更多" : "More")}
          </button>
        </div>
        <div className="color-dots">
          {paintChoices.map((paint) => (
            <button
              key={paint.id}
              type="button"
              className={paint.id === paintId ? "selected" : ""}
              style={{ backgroundColor: paint.hex }}
              title={paint.label}
              onClick={() => {
                const classicPaint = catalog.classicPaints.find((item) => item.id === paint.id)
                setPaintId(paint.id)
                setPaintFinishEffect(classicPaint?.material ?? "gloss")
                setDraftPaintFinishEffect(classicPaint?.material ?? "gloss")
                collapsePaintOptions()
              }}
            />
          ))}
        </div>
      </article>

      <motion.div
        className="mobile-paint-expand-region"
        initial={false}
        animate={{ height: showEffectOptions ? "auto" : 0, opacity: showEffectOptions ? 1 : 0, y: showEffectOptions ? 0 : -6 }}
        transition={{ height: { duration: 0.48, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.32 }, y: { duration: 0.32 } }}
        style={{ overflow: "hidden", willChange: "height, opacity, transform", pointerEvents: showEffectOptions ? "auto" : "none" }}
        aria-hidden={!showEffectOptions}
      >
        <div className="mobile-paint-expand-inner">
          <article className="mobile-sheet-card mobile-paint-effects-card">
            <h3>{language === "zh" ? "车漆效果" : "Paint effect"}</h3>
            <div className="paint-finish-options">
              {paintEffects.map((effect) => (
                <button
                  key={effect}
                  type="button"
                  className={draftPaintFinishEffect === effect ? "selected" : ""}
                  onClick={() => {
                    selectPaintFinishEffect(effect)
                    setEffectsExpanded(true)
                  }}
                >
                  {paintEffectLabel[language][effect]}
                </button>
              ))}
            </div>
          </article>

          <motion.article
            className="mobile-sheet-card mobile-custom-paint"
            initial={{ height: 0, opacity: 0, y: 8 }}
            animate={{
              height: customColorOpen ? "auto" : 0,
              opacity: customColorOpen ? 1 : 0,
              y: customColorOpen ? 0 : 8,
              marginTop: customColorOpen ? 12 : 0,
            }}
            transition={{ height: { duration: 0.46, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.32 }, y: { duration: 0.32 }, marginTop: { duration: 0.46, ease: [0.22, 1, 0.36, 1] } }}
            style={{ overflow: "hidden", willChange: "height, opacity, transform, margin-top", pointerEvents: customColorOpen ? "auto" : "none" }}
            aria-hidden={!customColorOpen}
          >
            <h3>{isGradientEditorOpen ? (language === "zh" ? "渐变颜色" : "Gradient color") : language === "zh" ? "自定义颜色" : "Custom color"}</h3>
            <AnimatePresence initial={false} mode="wait">
              {!isGradientEditorOpen ? (
                <motion.div key="single-color" className="single-color-editor" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
                  <div className="mobile-pc-color-grid">
                    <label className="mobile-color-native">
                      <span>{language === "zh" ? "取色" : "Pick"}</span>
                      <i style={{ "--custom-paint": customPaintPreviewHex } as CSSProperties} />
                      <input
                        className="mobile-native-color-input"
                        type="color"
                        value={customPaintPreviewHex}
                        aria-label={language === "zh" ? "取色" : "Pick color"}
                        onChange={(event) => setCustomColorFromHex(event.target.value)}
                      />
                    </label>
                    <label className="mobile-color-field mobile-color-hex">
                      <span>HEX</span>
                      <input value={customPaintHex} onChange={(event) => setCustomColorFromHex(event.target.value)} spellCheck={false} />
                    </label>
                    <div className="mobile-rgb-fields" aria-label="RGB">
                      {(["r", "g", "b"] as const).map((channel) => (
                        <label key={channel} className="mobile-color-field">
                          <span>{channel.toUpperCase()}</span>
                          <input inputMode="numeric" value={customPaintRgb[channel]} onChange={(event) => setCustomRgbChannel(channel, event.target.value)} />
                        </label>
                      ))}
                    </div>
                  </div>
                  <div
                    className="custom-picker-popover mobile-picker-popover"
                    style={{
                      "--custom-paint": customPaintPreviewHex,
                      "--picker-hue": customPickerHsv.h,
                      "--picker-hue-color": `hsl(${Math.round(customPickerHsv.h)} 100% 50%)`,
                      "--picker-s": customPickerHsv.s,
                      "--picker-v": customPickerHsv.v,
                    } as CSSProperties}
                  >
                    <button
                      type="button"
                      className="custom-picker-map"
                      aria-label={language === "zh" ? "选择颜色明暗和饱和度" : "Choose color saturation and brightness"}
                      onPointerDown={(event) => {
                        event.currentTarget.setPointerCapture(event.pointerId)
                        setCustomSvFromPointer(event)
                      }}
                      onPointerMove={(event) => {
                        if (event.buttons !== 1) return
                        setCustomSvFromPointer(event)
                      }}
                    >
                      <span className="custom-picker-cursor" />
                    </button>
                    <div className="custom-picker-controls">
                      <span className="custom-picker-preview" />
                      <input className="custom-hue-slider" type="range" min={0} max={360} value={Math.round(customPickerHsv.h)} aria-label={language === "zh" ? "色相" : "Hue"} onChange={(event) => setCustomHue(event.target.value)} />
                      <button type="button" className={`custom-color-apply-small${customPaintApplied ? " applied" : ""}`} onClick={applyCustomPaint}>
                        {customPaintApplied ? (language === "zh" ? "已应用" : "Applied") : language === "zh" ? "应用" : "Apply"}
                      </button>
                    </div>
                  </div>
                  <div className="custom-color-swatches mobile-custom-swatches" aria-label={language === "zh" ? "常用自定义颜色" : "Common custom colors"}>
                    {mobileCustomPaintSwatches.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        className={customPaintPreviewHex.toUpperCase() === hex ? "selected" : ""}
                        style={{ backgroundColor: hex }}
                        title={hex}
                        onClick={() => setCustomColorFromHex(hex)}
                      />
                    ))}
                  </div>
                  <div className="custom-color-footer mobile-custom-footer">
                    <span className="custom-color-preview-stack">
                      <span className="custom-color-preview" style={{ "--custom-paint": customPaintPreviewHex } as CSSProperties}>
                        {language === "zh" ? "预览色" : "Preview"}
                      </span>
                      <span className="custom-color-value">
                        Custom {customPaintPreviewHex} / RGB({customPaintRgb.r},{customPaintRgb.g},{customPaintRgb.b})
                      </span>
                    </span>
                  </div>
                </motion.div>
              ) : (
                <motion.div key="gradient-color" className="gradient-paint-panel" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.3 }}>
                  <div className="gradient-preview" style={{ "--gradient-from": gradientFrom, "--gradient-to": gradientTo } as CSSProperties} />
                  <div className="mobile-gradient-control-grid">
                    {gradientControls.map(({ slot, label, hex, preview }) => {
                      const rgb = mobileRgbFromHex(preview)
                      return (
                        <article className="mobile-gradient-control" key={slot}>
                          <div className="mobile-gradient-control-head">
                            <strong>{label}</strong>
                            <label className="mobile-gradient-swatch">
                              <span style={{ backgroundColor: preview }} />
                              <input
                                type="color"
                                value={preview}
                                aria-label={label}
                                onChange={(event) => setGradientColor(slot, event.target.value)}
                              />
                            </label>
                          </div>
                          <label className="mobile-color-field">
                            <span>HEX</span>
                            <input value={hex} onChange={(event) => setGradientColor(slot, event.target.value)} spellCheck={false} />
                          </label>
                          <div className="mobile-rgb-fields">
                            {(["r", "g", "b"] as const).map((channel) => (
                              <label key={channel} className="mobile-color-field">
                                <span>{channel.toUpperCase()}</span>
                                <input inputMode="numeric" value={rgb[channel]} onChange={(event) => setGradientRgbChannel(slot, channel, event.target.value)} />
                              </label>
                            ))}
                          </div>
                        </article>
                      )
                    })}
                  </div>
                  <div className="gradient-color-actions">
                    <button type="button" className={`custom-color-apply-small${gradientPaintApplied ? " applied" : ""}`} disabled={!gradientPaintValid} onClick={applyGradientPaint}>
                      {gradientPaintApplied ? (language === "zh" ? "已应用" : "Applied") : language === "zh" ? "应用" : "Apply"}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.article>
        </div>
      </motion.div>
      </div>
    </section>
  )
}

function MobileDetailsSheet({ language, colorPolicyAssets, selectAssetColorPolicy }: MobileStudioAppProps) {
  return (
    <section className="mobile-details-panel">
      {colorPolicyAssets.length === 0 && (
        <article className="mobile-sheet-card mobile-detail-group">
          <h3>{language === "zh" ? "\u88f8\u78b3" : "Carbon"}</h3>
          <p className="mobile-detail-empty-text">
            {language === "zh" ? "\u9009\u62e9\u652f\u6301\u88f8\u78b3\u7b56\u7565\u7684\u673a\u76d6\u6216\u540e\u89c6\u955c\u540e\u53ef\u8bbe\u7f6e\u3002" : "Select a hood or mirror-cap part that supports carbon policy to configure this."}
          </p>
        </article>
      )}
      {colorPolicyAssets.map(({ asset, policies, selected }) => (
        <article className="mobile-sheet-card policy-card" key={asset.categoryId}>
          <h3>{asset.categoryId === "hood" ? (language === "zh" ? "机盖颜色" : "Hood color") : language === "zh" ? "后视镜颜色" : "Mirror caps"}</h3>
          <div className="color-policy-segment">
            {policies.map((policy) => (
              <button
                key={policy}
                type="button"
                className={selected === policy ? "color-policy-button selected" : "color-policy-button"}
                onClick={(event) => selectAssetColorPolicy(event, asset, policy)}
              >
                {colorPolicyLabel[language][policy] ?? policy}
              </button>
            ))}
          </div>
        </article>
      ))}
      <article className="mobile-sheet-card mobile-detail-group">
        <h3>{language === "zh" ? "\u8f66\u724c" : "License plate"}</h3>
        <div className="mobile-detail-placeholder">
          <span>
            <CreditCard size={18} />
          </span>
          <div>
            <strong>{language === "zh" ? "\u4fee\u6539 / \u906e\u76d6" : "Edit / Mask"}</strong>
            <small>{language === "zh" ? "\u5373\u5c06\u652f\u6301" : "Coming soon"}</small>
          </div>
        </div>
        <div className="mobile-detail-disabled-actions" aria-disabled="true">
          <button type="button" disabled>{language === "zh" ? "\u4fee\u6539" : "Edit"}</button>
          <button type="button" disabled>{language === "zh" ? "\u906e\u76d6" : "Mask"}</button>
        </div>
      </article>
    </section>
  )
}

function MobileStanceSheet({ language, stance, setStance, stanceName, stancePresets }: MobileStudioAppProps) {
  return (
    <section className="mobile-sheet-card mobile-stance-panel stance-card">
      <h3>{language === "zh" ? "车身高度" : "Ride height"}</h3>
      <p>{language === "zh" ? "当前高度" : "Current height"}: {stanceName}</p>
      <div className="stance-preset-options">
        {stancePresets.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={stance === preset.value ? "stance-preset-button selected" : "stance-preset-button"}
            style={{ "--stance-glow": stanceGlowById[preset.id] } as CSSProperties}
            onClick={() => setStance(stance === preset.value ? 0 : preset.value)}
          >
            <span className="stance-preset-item-glow" aria-hidden="true" />
            <span className="stance-preset-face stance-preset-front">
              <span>{preset.label[language]}</span>
            </span>
            <span className="stance-preset-face stance-preset-back" aria-hidden="true">
              <span>{preset.label[language]}</span>
            </span>
          </button>
        ))}
      </div>
    </section>
  )
}

function MobileMenuDrawer({
  open,
  onClose,
  language,
  appMode,
  chatSessions,
  chatActiveSessionId,
  onSelectChatSession,
  generationHistory,
  generationJob,
  onSelectGenerationHistory,
  onDeleteGenerationHistory,
  formatHistoryTitle,
  onSelect,
}: {
  open: boolean
  onClose: () => void
  language: Language
  appMode: AppMode
  chatSessions: ChatSession[]
  chatActiveSessionId: string
  onSelectChatSession: (id: string) => void
  generationHistory: GenerationJob[]
  generationJob: GenerationJob | null
  onSelectGenerationHistory: (job: GenerationJob) => void
  onDeleteGenerationHistory: (job: GenerationJob) => void
  formatHistoryTitle?: (job: GenerationJob) => string
  onSelect: (menu: AppMenu) => void
}) {
  const isZh = language === "zh"
  const menuItems: { key: AppMenu; icon: ReactNode; label: string; desc: string }[] = [
    { key: "edit", icon: <PencilRuler size={22} />, label: isZh ? "改图" : "Edit", desc: isZh ? "AI 汽车改装效果预览" : "AI car modification preview" },
    { key: "generate", icon: <ImagePlus size={22} />, label: isZh ? "生图" : "Generate", desc: isZh ? "AI 图像生成" : "AI image generation" },
    { key: "video", icon: <Film size={22} />, label: isZh ? "视频" : "Video", desc: isZh ? "AI 视频生成" : "AI video generation" },
    { key: "effect", icon: <Zap size={22} />, label: isZh ? "特效" : "Effects", desc: isZh ? "AI 特效处理" : "AI effects" },
  ]
  const pinned = chatSessions.filter((s) => s.pinned)
  const recent = chatSessions.filter((s) => !s.pinned)
  const showChatList = appMode === "chat"
  const showGenerationHistory = appMode === "config"

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            key="mobile-menu-drawer-backdrop"
            type="button"
            className="mobile-history-overlay"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.aside
            key="mobile-menu-drawer"
            className="mobile-menu-drawer"
            initial={{ x: "-105%" }}
            animate={{ x: 0 }}
            exit={{ x: "-105%" }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
          >
            <header className="mobile-menu-drawer-head">
              <button type="button" onClick={onClose} aria-label={isZh ? "关闭" : "Close"}>
                <X size={18} />
              </button>
            </header>
            <div className="mobile-menu-grid">
              {menuItems.map((item) => (
                <button
                  type="button"
                  key={item.key}
                  className="mobile-menu-card"
                  onClick={() => onSelect(item.key)}
                >
                  <span className="mobile-menu-card-icon">{item.icon}</span>
                  <strong>{item.label}</strong>
                  <small>{item.desc}</small>
                </button>
              ))}
            </div>
            {showChatList && (
              <div className="mobile-menu-chat-list">
                {pinned.length > 0 && (
                  <div className="mobile-menu-chat-section">
                    <span className="mobile-menu-chat-section-title">{isZh ? "置顶会话" : "Pinned"}</span>
                    {pinned.map((session) => (
                      <button
                        type="button"
                        key={session.id}
                        className={`mobile-menu-chat-item${session.id === chatActiveSessionId ? " active" : ""}`}
                        onClick={() => onSelectChatSession(session.id)}
                      >
                        <strong>{session.title}</strong>
                        <small>{session.preview}</small>
                      </button>
                    ))}
                  </div>
                )}
                <div className="mobile-menu-chat-section">
                  <span className="mobile-menu-chat-section-title">{isZh ? "最近会话" : "Recent"}</span>
                  {recent.length > 0 ? recent.map((session) => (
                    <button
                      type="button"
                      key={session.id}
                      className={`mobile-menu-chat-item${session.id === chatActiveSessionId ? " active" : ""}`}
                      onClick={() => onSelectChatSession(session.id)}
                    >
                      <strong>{session.title}</strong>
                      <small>{session.preview}</small>
                    </button>
                  )) : (
                    <p className="mobile-menu-chat-empty">{isZh ? "暂无历史会话" : "No chat history"}</p>
                  )}
                </div>
              </div>
            )}
            {showGenerationHistory && (
              <div className="mobile-menu-history-list">
                <div className="mobile-menu-history-section">
                  <span className="mobile-menu-history-section-title">{isZh ? "生成历史" : "Generation history"}</span>
                  {generationHistory.length > 0 ? (
                    generationHistory.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        className={`mobile-menu-history-item${item.id === generationJob?.id ? " active" : ""}`}
                        onClick={() => {
                          onSelectGenerationHistory(item)
                          onClose()
                        }}
                      >
                        <img src={canvasSafeImageUrl(item.resultImageUrl || item.sourceImageUrl)} alt={item.id} />
                        <div>
                          <strong>{formatHistoryTitle?.(item) || mobileHistoryTitle(item)}</strong>
                          <small>{new Date(item.createdAt).toLocaleString()}</small>
                        </div>
                        <span
                          className="mobile-menu-history-delete"
                          onClick={(e) => {
                            e.stopPropagation()
                            void onDeleteGenerationHistory(item)
                          }}
                          role="button"
                          aria-label="Delete"
                        >
                          <X size={13} />
                        </span>
                      </button>
                    ))
                  ) : (
                    <p className="mobile-menu-history-empty">{isZh ? "暂无生成记录" : "No generation history"}</p>
                  )}
                </div>
              </div>
            )}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

function MobileHistoryDrawer({ open, onClose, ...props }: MobileStudioAppProps & { open: boolean; onClose: () => void }) {
  const { t } = props

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            className="mobile-history-overlay"
            aria-label="Close history"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.62 }}
            exit={{ opacity: 0 }}
          />
          <motion.aside
            className="mobile-history-drawer"
            initial={{ x: "-105%" }}
            animate={{ x: 0 }}
            exit={{ x: "-105%" }}
            transition={{ type: "spring", stiffness: 260, damping: 30 }}
          >
            <header className="mobile-history-drawer-head">
              <div>
                <strong>{t.history}</strong>
              </div>
              <button type="button" onClick={onClose} aria-label="Close history">
                <X size={18} />
              </button>
            </header>
            <MobileHistorySheet {...props} onClose={onClose} />
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  )
}

function MobileHistorySheet({
  t,
  history,
  job,
  selectHistoryJob,
  deleteHistoryJob,
  formatHistoryTitle,
  setSheet,
  onClose,
}: Pick<MobileStudioAppProps, "t" | "history" | "job" | "selectHistoryJob" | "deleteHistoryJob" | "formatHistoryTitle"> & { setSheet?: (sheet: MobileSheet) => void; onClose?: () => void }) {
  return (
    <section className="mobile-history-panel">
      {history.length ? (
        history.map((item) => (
          <article className={item.id === job?.id ? "mobile-history-card selected" : "mobile-history-card"} key={item.id}>
            <button
              type="button"
              onClick={() => {
                selectHistoryJob(item)
                setSheet?.(null)
                onClose?.()
              }}
            >
              <img src={canvasSafeImageUrl(item.resultImageUrl || item.sourceImageUrl)} alt={item.id} />
              <span>
                <strong>{formatHistoryTitle?.(item) || mobileHistoryTitle(item)}</strong>
                <small>{new Date(item.createdAt).toLocaleString()}</small>
              </span>
            </button>
            <button type="button" className="mobile-history-delete" onClick={() => void deleteHistoryJob(item)} aria-label="Delete">
              <X size={13} />
            </button>
          </article>
        ))
      ) : (
        <p className="mobile-history-empty">{t.historyEmpty}</p>
      )}
    </section>
  )
}

function mobileHistoryTitle(item: GenerationJob) {
  const candidates = [item.displayVehicleModel, item.standardJson?.vehicle?.model]
  return candidates.map((value) => cleanMobileHistoryTitle(value)).find(Boolean) || "Vehicle"
}

function cleanMobileHistoryTitle(value: unknown) {
  const text = String(value || "").trim().replace(/\s+/g, " ")
  if (!text) return ""
  const normalized = text.toLowerCase()
  if (normalized === "user uploaded vehicle, preserve exact identity") return ""
  if (normalized === "vehicle model pending" || normalized === "unknown" || normalized === "n/a") return ""
  if (/^(gen|upload|garage|job|usage)_[a-z0-9-]+$/i.test(text)) return ""
  return text
}

type MobileProfileSection = "overview" | "history" | "profile" | "password" | "phone" | "messages" | "orders"
type MobileProfileRouteDirection = "forward" | "back"

const mobileProfileRouteVariants = {
  enter: (direction: MobileProfileRouteDirection) => ({
    opacity: 0,
    x: direction === "forward" ? 34 : -34,
    filter: "blur(6px)",
  }),
  center: {
    opacity: 1,
    x: 0,
    filter: "blur(0px)",
  },
  exit: (direction: MobileProfileRouteDirection) => ({
    opacity: 0,
    x: direction === "forward" ? -34 : 34,
    filter: "blur(6px)",
  }),
}

const mobileProfileRouteTransition = { duration: 0.22, ease: "easeOut" } as const

function MobileProfilePage({
  open,
  onClose,
  language,
  t,
  mobileTheme,
  authUser,
  billing,
  setAuthOpen,
  setSubscribeOpen,
  onAuthed,
  logout,
  history,
  job,
  selectHistoryJob,
  deleteHistoryJob,
  formatHistoryTitle,
}: MobileStudioAppProps & { open: boolean; onClose: () => void }) {
  const isZh = language === "zh"
  const [section, setSection] = useState<MobileProfileSection>("overview")
  const [profileRouteDirection, setProfileRouteDirection] = useState<MobileProfileRouteDirection>("forward")
  const [name, setName] = useState(authUser?.name || authUser?.username || "")
  const [email, setEmail] = useState(authUser?.email || "")
  const [avatarId, setAvatarId] = useState(authUser?.avatarId || "person_default")
  const [avatarPresets, setAvatarPresets] = useState<AccountAvatarPreset[]>([])
  const [currentPassword, setCurrentPassword] = useState("")
  const [nextPassword, setNextPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [phone, setPhone] = useState(authUser?.phone || "")
  const [phoneCode, setPhoneCode] = useState("")
  const [status, setStatus] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [messages, setMessages] = useState<AccountMessage[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [messagesError, setMessagesError] = useState("")
  const [selectedMessageId, setSelectedMessageId] = useState("")
  const [orders, setOrders] = useState<PaymentOrder[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [ordersError, setOrdersError] = useState("")

  useEffect(() => {
    if (!open) return
    setSection("overview")
    setProfileRouteDirection("forward")
    setName(authUser?.name || authUser?.username || "")
    setEmail(authUser?.email || "")
    setAvatarId(authUser?.avatarId || "person_default")
    setPhone(authUser?.phone || "")
    setCurrentPassword("")
    setNextPassword("")
    setConfirmPassword("")
    setPhoneCode("")
    setStatus("")
    setError("")
    setLoading(false)
    setMessagesError("")
    setSelectedMessageId("")
    setOrders([])
    setOrdersError("")
  }, [authUser, open])

  useEffect(() => {
    if (!open || !authUser) {
      setMessages([])
      return undefined
    }

    let cancelled = false
    setMessagesLoading(true)
    setMessagesError("")
    listAccountMessages()
      .then((payload) => {
        if (!cancelled) setMessages(payload.messages)
      })
      .catch((messageError) => {
        if (!cancelled) setMessagesError(messageError instanceof Error ? messageError.message : isZh ? "消息加载失败。" : "Messages failed to load.")
      })
      .finally(() => {
        if (!cancelled) setMessagesLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [authUser, isZh, open])

  useEffect(() => {
    if (!open) return undefined
    let cancelled = false
    listAccountAvatarPresets()
      .then((payload) => {
        if (!cancelled) setAvatarPresets(payload.avatars)
      })
      .catch(() => {
        if (!cancelled) setAvatarPresets([])
      })
    return () => {
      cancelled = true
    }
  }, [open])

  const displayName = authUser ? authUser.name || authUser.username : isZh ? "未登录" : "Guest"
  const planIdDisplay = billing?.plan.id || authUser?.plan || (isZh ? "游客" : "guest")
  const configBalance = billing ? formatMobileProfileBalance(billing.configRemaining, isZh ? "不限" : "Unlimited") : "--"
  const chatBalance = billing ? formatMobileProfileBalance(billing.chatRemainingToday, isZh ? "不限" : "Unlimited") : "--"
  const activeAvatarPresets = avatarPresets.length
    ? avatarPresets
    : authUser?.avatarUrl
      ? [{ id: authUser.avatarId, label: displayName, imageUrl: authUser.avatarUrl, active: true, sortOrder: 0, builtIn: true, createdAt: 0, updatedAt: 0 }]
      : []

  const openAuth = () => {
    onClose()
    setAuthOpen(true)
  }

  const openSubscribe = () => {
    setSubscribeOpen(true)
  }

  const unreadMessageCount = messages.filter((message) => !message.readAt).length

  const reloadMessages = useCallback(async () => {
    if (!authUser) return
    setMessagesLoading(true)
    setMessagesError("")
    try {
      const payload = await listAccountMessages()
      setMessages(payload.messages)
    } catch (messageError) {
      setMessagesError(messageError instanceof Error ? messageError.message : isZh ? "消息加载失败。" : "Messages failed to load.")
    } finally {
      setMessagesLoading(false)
    }
  }, [authUser, isZh])

  useEffect(() => {
    if (!open || !authUser) return undefined

    const handleRefresh = () => {
      void reloadMessages()
    }
    window.addEventListener(ACCOUNT_MESSAGES_REFRESH_EVENT, handleRefresh)
    return () => window.removeEventListener(ACCOUNT_MESSAGES_REFRESH_EVENT, handleRefresh)
  }, [authUser, open, reloadMessages])

  const openProfileSection = (nextSection: Exclude<MobileProfileSection, "overview">) => {
    setProfileRouteDirection("forward")
    setStatus("")
    setError("")
    setSection(nextSection)
  }

  const openMessages = () => {
    openProfileSection("messages")
    void reloadMessages()
  }

  const loadOrders = useCallback(async () => {
    if (!authUser) return
    setOrdersLoading(true)
    setOrdersError("")
    try {
      const payload = await getAccountOrders()
      setOrders(payload.orders)
    } catch (orderError) {
      setOrdersError(orderError instanceof Error ? orderError.message : isZh ? "订单加载失败。" : "Orders loading failed.")
    } finally {
      setOrdersLoading(false)
    }
  }, [authUser, isZh])

  const openOrders = () => {
    openProfileSection("orders")
    void loadOrders()
  }

  const backToProfileOverview = () => {
    setProfileRouteDirection("back")
    setStatus("")
    setError("")
    setSelectedMessageId("")
    setSection("overview")
  }

  const viewMessage = async (message: AccountMessage) => {
    if (selectedMessageId === message.id) {
      setSelectedMessageId("")
      return
    }
    setSelectedMessageId(message.id)
    if (message.readAt) return
    try {
      const payload = await markAccountMessageRead(message.id)
      setMessages(payload.messages)
    } catch (messageError) {
      setMessagesError(messageError instanceof Error ? messageError.message : isZh ? "消息更新失败。" : "Message update failed.")
    }
  }

  const readAllMessages = async () => {
    try {
      const payload = await markAllAccountMessagesRead()
      setMessages(payload.messages)
    } catch (messageError) {
      setMessagesError(messageError instanceof Error ? messageError.message : isZh ? "消息更新失败。" : "Messages update failed.")
    }
  }

  const runProfileAction = async (action: () => Promise<void>) => {
    setLoading(true)
    setStatus("")
    setError("")
    try {
      await action()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : isZh ? "操作失败。" : "Action failed.")
    } finally {
      setLoading(false)
    }
  }

  const saveProfile = () => runProfileAction(async () => {
    const payload = await updateAccountProfile({ name, email, avatarId })
    onAuthed(payload)
    setStatus(isZh ? "资料已保存" : "Profile saved")
  })

  const savePassword = () => runProfileAction(async () => {
    if (nextPassword !== confirmPassword) {
      setError(isZh ? "两次输入的新密码不一致。" : "The new passwords do not match.")
      return
    }
    const payload = await changeAccountPassword({ currentPassword, nextPassword })
    onAuthed(payload)
    setCurrentPassword("")
    setNextPassword("")
    setConfirmPassword("")
    setStatus(isZh ? "密码已修改" : "Password updated")
  })

  const sendCode = () => runProfileAction(async () => {
    await sendPhoneChangeCode(phone)
    setStatus(isZh ? "验证码已发送" : "Code sent")
  })

  const savePhone = () => runProfileAction(async () => {
    const payload = await changeAccountPhone({ phone, code: phoneCode })
    onAuthed(payload)
    setPhone(payload.user.phone)
    setPhoneCode("")
    setStatus(isZh ? "手机号已更新" : "Phone updated")
  })


  const profileSectionTitle = section === "messages"
    ? (isZh ? "消息提醒" : "Notifications")
    : section === "orders"
    ? (isZh ? "我的订单" : "My orders")
    : section === "profile"
    ? (isZh ? "编辑资料" : "Edit profile")
    : section === "phone"
      ? (isZh ? "换绑手机号" : "Change phone")
      : section === "password"
        ? (isZh ? "修改密码" : "Change password")
        : (isZh ? "个人中心" : "Profile")

  const profileSectionSubtitle = section === "profile"
    ? (isZh ? "个性化你的账号资料和头像" : "Personalize your profile and avatar")
    : section === "phone"
      ? (isZh ? "输入新手机号并完成验证" : "Enter a new phone number and verify")
      : section === "password"
        ? (isZh ? "设置一个新的登录密码" : "Set a new login password")
        : ""

  const renderInput = (
    value: string,
    onChange: (value: string) => void,
    placeholder: string,
    ariaLabel: string,
    type?: string,
  ) => (
    <div className="mobile-profile-input-wrap">
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
      />
      {value && (
        <button
          type="button"
          className="mobile-profile-clear-btn"
          onClick={() => onChange("")}
          aria-label={isZh ? "清除" : "Clear"}
        >
          <X size={11} />
        </button>
      )}
    </div>
  )

  const renderStatus = () => (
    (status || error) ? (
      <p className={error ? "mobile-profile-status error" : "mobile-profile-status"}>
        {error ? <AlertCircle size={14} /> : <Check size={14} />}
        {error || status}
      </p>
    ) : null
  )

  const renderProfileEditorShell = (children: ReactNode | null) => (
    <AnimatePresence mode="wait" initial={false} custom={profileRouteDirection}>
      {authUser && section !== "overview" && (
        <motion.div
          key={section}
          className="mobile-profile-edit-screen"
          custom={profileRouteDirection}
          variants={mobileProfileRouteVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={mobileProfileRouteTransition}
        >
          <header className="mobile-profile-topbar">
            <button type="button" onClick={backToProfileOverview} aria-label={isZh ? "返回" : "Back"}>
              <ChevronLeft size={22} />
            </button>
            <strong>{profileSectionTitle}</strong>
          </header>
          {profileSectionSubtitle && (
            <p className="mobile-profile-subtitle">{profileSectionSubtitle}</p>
          )}
          <section className="mobile-profile-edit-body">
            {children}
          </section>
        </motion.div>
      )}
    </AnimatePresence>
  )

  const messageKindLabel = (kind: AccountMessage["kind"]) => {
    if (kind === "payment") return isZh ? "充值" : "Payment"
    if (kind === "subscription") return isZh ? "订阅" : "Subscription"
    if (kind === "quota") return isZh ? "额度" : "Quota"
    return isZh ? "站内信" : "System"
  }

  const renderMessages = () => (
    <section className="mobile-message-page">
      <div className="mobile-message-actions">
        <span>{isZh ? `${unreadMessageCount} 条未读` : `${unreadMessageCount} unread`}</span>
        <button type="button" onClick={() => void readAllMessages()} disabled={!unreadMessageCount || messagesLoading}>
          <CheckCheck size={15} />
          {isZh ? "全部已读" : "Mark all read"}
        </button>
      </div>
      {messagesError && <p className="mobile-profile-status error">{messagesError}</p>}
      {messagesLoading && !messages.length ? (
        <p className="mobile-message-empty">{isZh ? "正在加载消息..." : "Loading messages..."}</p>
      ) : messages.length ? (
        <div className="mobile-message-list">
          {messages.map((message) => {
            const selected = selectedMessageId === message.id
            const unread = !message.readAt
            return (
              <article className={unread ? "mobile-message-card unread" : "mobile-message-card"} key={message.id}>
                <button type="button" onClick={() => void viewMessage(message)}>
                  <span className="mobile-message-icon"><MailOpen size={17} /></span>
                  <div>
                    <span className="mobile-message-meta">
                      <em>{messageKindLabel(message.kind)}</em>
                      <time>{new Date(message.createdAt).toLocaleString(isZh ? "zh-CN" : "en-US")}</time>
                    </span>
                    <strong>{message.title}</strong>
                    {!selected && <small>{message.body}</small>}
                  </div>
                  {unread && <i aria-label={isZh ? "未读" : "Unread"} />}
                </button>
                <AnimatePresence initial={false}>
                  {selected && (
                    <motion.p
                      className="mobile-message-body"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.18 }}
                    >
                      {message.body}
                    </motion.p>
                  )}
                </AnimatePresence>
              </article>
            )
          })}
        </div>
      ) : (
        <p className="mobile-message-empty">{isZh ? "暂无消息提醒" : "No notifications yet"}</p>
      )}
    </section>
  )

  const orderStatusLabel = (status: PaymentOrder["status"]) => {
    const map: Record<PaymentOrder["status"], string> = isZh
      ? { pending: "待支付", paid: "已支付", failed: "失败", refunded: "已退款" }
      : { pending: "Pending", paid: "Paid", failed: "Failed", refunded: "Refunded" }
    return map[status] || status
  }

  const orderMethodLabel = (method: PaymentOrder["method"]) => {
    return method === "wechat" ? (isZh ? "微信支付" : "WeChat Pay") : (isZh ? "支付宝" : "Alipay")
  }

  const formatOrderAmount = (cents: number) => `¥${(cents / 100).toFixed(2)}`

  const renderOrders = () => (
    <section className="mobile-orders-page">
      {ordersError && <p className="mobile-profile-status error">{ordersError}</p>}
      {ordersLoading && !orders.length ? (
        <p className="mobile-message-empty">{isZh ? "正在加载订单..." : "Loading orders..."}</p>
      ) : orders.length ? (
        <div className="mobile-orders-list">
          {orders.map((order) => (
            <article className="mobile-order-card" key={order.id}>
              <div className="mobile-order-header">
                <span className="mobile-order-id" title={order.id}>{order.id.slice(0, 12)}</span>
                <span className={`mobile-order-status ${order.status}`}>{orderStatusLabel(order.status)}</span>
              </div>
              <div className="mobile-order-body">
                <div className="mobile-order-row">
                  <span>{isZh ? "套餐" : "Plan"}</span>
                  <strong>{order.planId}</strong>
                </div>
                <div className="mobile-order-row">
                  <span>{isZh ? "金额" : "Amount"}</span>
                  <strong>{formatOrderAmount(order.amountCents)}</strong>
                </div>
                <div className="mobile-order-row">
                  <span>{isZh ? "支付方式" : "Method"}</span>
                  <strong>{orderMethodLabel(order.method)}</strong>
                </div>
                <div className="mobile-order-row">
                  <span>{isZh ? "时间" : "Time"}</span>
                  <strong>{new Date(order.createdAt).toLocaleString(isZh ? "zh-CN" : "en-US")}</strong>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="mobile-message-empty">{isZh ? "暂无订单记录" : "No orders yet"}</p>
      )}
    </section>
  )

  const renderEditor = () => {
    if (!authUser || section === "overview") return renderProfileEditorShell(null)

    if (section === "messages") {
      return renderProfileEditorShell(renderMessages())
    }

    if (section === "orders") {
      return renderProfileEditorShell(renderOrders())
    }

    if (section === "history") {
      return renderProfileEditorShell(
        <div className="mobile-profile-history-list">
          <MobileHistorySheet
            t={t}
            history={history}
            job={job}
            selectHistoryJob={selectHistoryJob}
            deleteHistoryJob={deleteHistoryJob}
            formatHistoryTitle={formatHistoryTitle}
            setSheet={() => {}}
          />
        </div>
      )
    }

    if (section === "profile") {
      return renderProfileEditorShell(
        <form className="mobile-profile-editor" onSubmit={(event) => {
          event.preventDefault()
          void saveProfile()
        }}>
          <fieldset className="mobile-avatar-picker" aria-label={isZh ? "选择头像" : "Choose avatar"}>
            <div>
              {activeAvatarPresets.map((preset) => (
                <button
                  type="button"
                  key={preset.id}
                  className={avatarId === preset.id ? "selected" : ""}
                  onClick={() => setAvatarId(preset.id)}
                  aria-pressed={avatarId === preset.id}
                  aria-label={preset.label}
                >
                  <AccountAvatar imageUrl={preset.imageUrl} label={preset.label} />
                </button>
              ))}
            </div>
          </fieldset>
          {renderInput(name, setName, isZh ? "昵称" : "Display name", isZh ? "昵称" : "Display name")}
          {renderInput(email, setEmail, isZh ? "邮箱" : "Email", isZh ? "邮箱" : "Email")}
          {renderStatus()}
          <button type="submit" className="mobile-profile-submit-btn" disabled={loading}>
            {isZh ? "保存资料" : "Save profile"}
          </button>
        </form>
      )
    }

    if (section === "password") {
      return renderProfileEditorShell(
        <form className="mobile-profile-editor" onSubmit={(event) => {
          event.preventDefault()
          void savePassword()
        }}>
          {renderInput(currentPassword, setCurrentPassword, isZh ? "当前密码" : "Current password", isZh ? "当前密码" : "Current password", "password")}
          {renderInput(nextPassword, setNextPassword, isZh ? "新密码" : "New password", isZh ? "新密码" : "New password", "password")}
          {renderInput(confirmPassword, setConfirmPassword, isZh ? "确认新密码" : "Confirm new password", isZh ? "确认新密码" : "Confirm new password", "password")}
          {renderStatus()}
          <button type="submit" className="mobile-profile-submit-btn" disabled={loading}>
            {isZh ? "修改密码" : "Change password"}
          </button>
        </form>
      )
    }

    return renderProfileEditorShell(
      <form className="mobile-profile-editor" onSubmit={(event) => {
        event.preventDefault()
        void savePhone()
      }}>
        {renderInput(phone, setPhone, isZh ? "新手机号" : "New phone", isZh ? "新手机号" : "New phone")}
        <div className="mobile-profile-code-wrap">
          <input
            value={phoneCode}
            onChange={(event) => setPhoneCode(event.target.value)}
            placeholder={isZh ? "验证码" : "Code"}
            aria-label={isZh ? "验证码" : "Code"}
          />
          <button
            type="button"
            className="mobile-profile-code-send"
            onClick={() => void sendCode()}
            disabled={loading}
          >
            {isZh ? "发送验证码" : "Send code"}
          </button>
        </div>
        {renderStatus()}
        <button type="submit" className="mobile-profile-submit-btn" disabled={loading}>
          {isZh ? "确认换绑" : "Update phone"}
        </button>
      </form>
    )
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.section
          className="mobile-profile-page"
          data-mobile-theme={mobileTheme}
          initial={{ x: "100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 30 }}
          aria-label={isZh ? "个人中心" : "Profile"}
        >
          <header className="mobile-profile-topbar">
            <button type="button" onClick={onClose} aria-label={isZh ? "返回" : "Back"}>
              <ChevronLeft size={18} />
            </button>
          </header>

          <section className="mobile-profile-card">
            <div className="mobile-profile-card-header">
              <button type="button" className="mobile-profile-avatar mobile-profile-avatar-sm" onClick={() => authUser && openProfileSection("profile")} aria-label={isZh ? "更改头像" : "Change avatar"}>
                <AccountAvatar user={authUser} />
              </button>
              <span className="mobile-profile-card-name">{displayName}</span>
              {authUser ? (
                <button type="button" className="mobile-profile-card-edit" onClick={openSubscribe}>
                  {planIdDisplay}
                </button>
              ) : (
                <button type="button" className="mobile-profile-card-edit" onClick={openAuth}>
                  {isZh ? "登录" : "Sign in"}
                </button>
              )}
            </div>
            <div className="mobile-profile-card-actions">
              <span className="mobile-profile-card-action-readonly">
                <Sparkles size={16} />
                {isZh ? `生成 ${configBalance}` : `Gen ${configBalance}`}
              </span>
              <span className="mobile-profile-card-action-readonly">
                <Zap size={16} />
                {isZh ? `对话 ${chatBalance}` : `Chat ${chatBalance}`}
              </span>
            </div>
          </section>

          {renderEditor()}
          {section === "overview" && renderStatus()}

          <section className="mobile-profile-simple-list">
            {!authUser ? (
              <button type="button" className="mobile-profile-simple-row" onClick={openAuth}>
                <span>{isZh ? "登录账号" : "Sign in"}</span>
                <ChevronRight size={20} />
              </button>
            ) : (
              <>
                <button type="button" className="mobile-profile-simple-row" onClick={openMessages}>
                  <span>{isZh ? "消息通知" : "Notifications"}</span>
                  <div className="mobile-profile-simple-row-tail">
                    {unreadMessageCount > 0 && <em className="mobile-profile-badge">{unreadMessageCount > 99 ? "99+" : unreadMessageCount}</em>}
                    <ChevronRight size={20} />
                  </div>
                </button>
                <button type="button" className="mobile-profile-simple-row" onClick={() => openProfileSection("phone")}>
                  <span>{isZh ? "换绑手机号" : "Change phone"}</span>
                  <div className="mobile-profile-simple-row-tail">
                    <small>{authUser.phone || (isZh ? "未绑定" : "Not bound")}</small>
                    <ChevronRight size={20} />
                  </div>
                </button>
                <button type="button" className="mobile-profile-simple-row" onClick={() => openProfileSection("password")}>
                  <span>{isZh ? "修改密码" : "Change password"}</span>
                  <ChevronRight size={20} />
                </button>
                <button type="button" className="mobile-profile-simple-row" onClick={openOrders}>
                  <span>{isZh ? "我的订单" : "My orders"}</span>
                  <ChevronRight size={20} />
                </button>
                <button
                  type="button"
                  className="mobile-profile-simple-row danger"
                  onClick={() => {
                    onClose()
                    void logout()
                  }}
                >
                  <span>{isZh ? "退出账号" : "Sign out"}</span>
                  <ChevronRight size={20} />
                </button>
              </>
            )}
          </section>
        </motion.section>
      )}
    </AnimatePresence>
  )
}

function LegacyMobileProfilePage({
  open,
  onClose,
  language,
  mobileTheme,
  authUser,
  billing,
  setAuthOpen,
  setSubscribeOpen,
  logout,
}: MobileStudioAppProps & { open: boolean; onClose: () => void }) {
  const [nickname, setNickname] = useState(authUser?.name || authUser?.username || "")

  useEffect(() => {
    if (open) setNickname(authUser?.name || authUser?.username || "")
  }, [authUser?.name, authUser?.username, open])

  const isZh = language === "zh"
  const displayName = authUser ? nickname || authUser.name || authUser.username : isZh ? "未登录" : "Guest"
  const accountLine = authUser?.email || authUser?.phone || authUser?.username || (isZh ? "登录后管理你的账号" : "Sign in to manage your account")
  const planName = billing?.plan.label || authUser?.plan || (isZh ? "游客" : "Guest")
  const configBalance = billing ? formatMobileProfileBalance(billing.configRemaining, isZh ? "不限" : "Unlimited") : "--"
  const chatBalance = billing ? formatMobileProfileBalance(billing.chatRemainingToday, isZh ? "不限" : "Unlimited") : "--"
  const openAuth = () => {
    onClose()
    setAuthOpen(true)
  }

  const openSubscribe = () => {
    setSubscribeOpen(true)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.section
          className="mobile-profile-page"
          data-mobile-theme={mobileTheme}
          initial={{ x: "100%", opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: "100%", opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 30 }}
          aria-label={isZh ? "个人中心" : "Profile"}
        >
          <header className="mobile-profile-topbar">
            <button type="button" onClick={onClose} aria-label={isZh ? "返回" : "Back"}>
              <ChevronLeft size={22} />
            </button>
            <strong>{isZh ? "个人中心" : "Profile"}</strong>
          </header>

          <section className="mobile-profile-hero">
            <div className="mobile-profile-avatar">
              <AccountAvatar user={authUser} />
            </div>
            <h2>{displayName}</h2>
            <p>{accountLine}</p>
            {authUser && (
              <label className="mobile-profile-nickname">
                <span>{isZh ? "昵称" : "Nickname"}</span>
                <input value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder={authUser.name || authUser.username} />
              </label>
            )}
          </section>

          <section className="mobile-profile-stats" aria-label={isZh ? "账号余额" : "Account balance"}>
            <div>
              <strong>{configBalance}</strong>
              <span>{isZh ? "生成余额" : "Generations"}</span>
            </div>
            <div>
              <strong>{chatBalance}</strong>
              <span>{isZh ? "对话余额" : "Chat quota"}</span>
            </div>
            <div>
              <strong>{planName}</strong>
              <span>{isZh ? "当前套餐" : "Current plan"}</span>
            </div>
          </section>

          <section className="mobile-profile-list">
            {!authUser && (
              <button type="button" className="mobile-profile-row primary" onClick={openAuth}>
                <span><KeyRound size={19} /></span>
                <div>
                  <strong>{isZh ? "登录账号" : "Sign in"}</strong>
                  <small>{isZh ? "登录后解锁完整账号管理" : "Unlock account management"}</small>
                </div>
                <ChevronRight size={19} />
              </button>
            )}
            <button type="button" className="mobile-profile-row">
              <span><Pencil size={19} /></span>
              <div>
                <strong>{isZh ? "编辑资料" : "Edit profile"}</strong>
                <small>{isZh ? "设置昵称、头像和个人信息" : "Nickname, avatar and personal info"}</small>
              </div>
              <ChevronRight size={19} />
            </button>
            <button type="button" className="mobile-profile-row" onClick={openAuth}>
              <span><LockKeyhole size={19} /></span>
              <div>
                <strong>{isZh ? "修改密码" : "Change password"}</strong>
                <small>{isZh ? "密码、安全验证与账号绑定" : "Password and account security"}</small>
              </div>
              <ChevronRight size={19} />
            </button>
            <button type="button" className="mobile-profile-row" onClick={openSubscribe}>
              <span><BadgeCheck size={19} /></span>
              <div>
                <strong>{isZh ? "订阅与套餐" : "Subscription"}</strong>
                <small>{isZh ? `当前套餐：${planName}` : `Current plan: ${planName}`}</small>
              </div>
              <ChevronRight size={19} />
            </button>
            <button type="button" className="mobile-profile-row">
              <span><WalletCards size={19} /></span>
              <div>
                <strong>{isZh ? "余额" : "Balance"}</strong>
                <small>{isZh ? `生成 ${configBalance} / 对话 ${chatBalance}` : `Gen ${configBalance} / Chat ${chatBalance}`}</small>
              </div>
              <ChevronRight size={19} />
            </button>
            <button type="button" className="mobile-profile-row">
              <span><CreditCard size={19} /></span>
              <div>
                <strong>{isZh ? "绑定银行卡" : "Linked cards"}</strong>
                <small>{isZh ? "管理后续支付方式" : "Manage payment methods"}</small>
              </div>
              <ChevronRight size={19} />
            </button>
            {authUser && (
              <button
                type="button"
                className="mobile-profile-row danger"
                onClick={() => {
                  onClose()
                  void logout()
                }}
              >
                <span><LogOut size={19} /></span>
                <div>
                  <strong>{isZh ? "退出账号" : "Sign out"}</strong>
                  <small>{isZh ? "退出当前登录状态" : "End current session"}</small>
                </div>
                <ChevronRight size={19} />
              </button>
            )}
          </section>
        </motion.section>
      )}
    </AnimatePresence>
  )
}

function formatMobileProfileBalance(value: number | "unlimited", unlimitedText: string) {
  return value === "unlimited" ? unlimitedText : String(value)
}

function MobileChatMode({
  language,
  t,
  authUser,
  billing,
  setAuthOpen,
  setSubscribeOpen,
  onBillingChanged,
  logout,
  toggleLanguage,
  mobileAccessKind,
  onMobileAccessBlocked,
  mobileSidebarOpen,
  setMobileSidebarOpen,
  onSessionsChange,
  pendingSessionId,
  onPendingSessionConsumed,
}: MobileStudioAppProps & { mobileSidebarOpen: boolean; setMobileSidebarOpen: (open: boolean) => void }) {
  return (
    <section className="mobile-screen mobile-chat-screen">
      <MobileScreenHead
        eyebrow=""
        title={language === "zh" ? "对话模式" : "Chat mode"}
        language={language}
        onLanguage={toggleLanguage}
      />
      <div className="mobile-shared-mode-spacer" aria-hidden="true" />
      <div className="mobile-chat-shell">
        <ChatMode
          language={language}
          authUser={authUser}
          billing={billing}
          mobileVariant
          mobileAccessKind={mobileAccessKind}
          onMobileAccessBlocked={onMobileAccessBlocked}
          mobileSidebarOpen={mobileSidebarOpen}
          setMobileSidebarOpen={setMobileSidebarOpen}
          hideMobileMenu
          onSessionsChange={onSessionsChange}
          pendingSessionId={pendingSessionId}
          onPendingSessionConsumed={onPendingSessionConsumed}
          onAuthRequired={() => setAuthOpen(true)}
          onSubscribeRequired={(nextBilling) => {
            if (nextBilling) onBillingChanged(nextBilling)
            setSubscribeOpen(true)
          }}
          onBillingChanged={onBillingChanged}
        />
      </div>
    </section>
  )
}

function MobileAccountStrip({
  language,
  t,
  authUser,
  setAuthOpen,
  setSubscribeOpen,
  logout,
  toggleLanguage,
}: Pick<MobileStudioAppProps, "language" | "t" | "authUser" | "setAuthOpen" | "setSubscribeOpen" | "logout" | "toggleLanguage">) {
  return (
    <div className="mobile-account-strip">
      {authUser ? (
        <>
          <button type="button" onClick={() => setSubscribeOpen(true)}>
            <BadgeCheck size={15} />
            <span>{t.member}</span>
          </button>
          <button type="button" onClick={logout}>
            <span>{t.logout}</span>
          </button>
        </>
      ) : (
        <button type="button" onClick={() => setAuthOpen(true)}>
          <KeyRound size={15} />
          <span>{t.login}</span>
        </button>
      )}
      <button type="button" onClick={toggleLanguage}>
        <Languages size={15} />
        <span>{language === "en" ? "EN" : "中"}</span>
      </button>
    </div>
  )
}

function MobileFloatingTopBar({
  authUser,
  language,
  onLanguage,
  onMenu,
  onProfile,
}: {
  authUser?: AuthUser | null
  language: Language
  onLanguage: () => void
  onMenu: () => void
  onProfile: () => void
}) {
  return (
    <header className="mobile-floating-topbar">
      <div className="mobile-floating-brand">
        <button type="button" className="mobile-floating-menu" onClick={onMenu} aria-label="Open drawer">
          <Menu size={19} />
        </button>
        <img src="/logo/logo.svg" alt="OnCar AI" className="mobile-floating-logo" />
      </div>
      <div className="mobile-floating-actions">
        <button type="button" className="mobile-floating-profile" onClick={onProfile} aria-label="Profile">
          <UserRound size={19} />
        </button>
        <button
          type="button"
          className="mobile-floating-language"
          onClick={onLanguage}
          aria-label={language === "zh" ? "Switch to English" : "\u5207\u6362\u5230\u4e2d\u6587"}
        >
          <Languages size={20} />
        </button>
      </div>
    </header>
  )
}

function MobileScreenHead({
  eyebrow,
  title,
  language,
  onLanguage,
  leftAction,
  rightAction,
}: {
  eyebrow: string
  title: string
  language: Language
  onLanguage: () => void
  leftAction?: ReactNode
  rightAction?: ReactNode
}) {
  return (
    <header className="mobile-screen-head">
      <div className="mobile-screen-title">
        {leftAction}
        <span>{eyebrow}</span>
        <strong>{title}</strong>
      </div>
      <div className="mobile-mini-actions">
        {rightAction}
        <button type="button" onClick={onLanguage} aria-label={language === "zh" ? "Switch to English" : "切换到中文"}>
          <Languages size={18} />
          <span>{language === "en" ? "EN" : "中"}</span>
        </button>
      </div>
    </header>
  )
}

function MobileModeSwitch({ mode, setMode, labels }: { mode: AppMode; setMode: (mode: AppMode) => void; labels: { config: string; chat: string } }) {
  return (
    <div className="mobile-mode-switch" role="tablist">
      <motion.span className="mobile-mode-thumb" animate={{ x: mode === "config" ? 0 : "100%" }} transition={{ type: "spring", stiffness: 360, damping: 34 }} />
      <button type="button" className={mode === "config" ? "active" : ""} onClick={() => setMode("config")}>
        {labels.config}
      </button>
      <button type="button" className={mode === "chat" ? "active" : ""} onClick={() => setMode("chat")}>
        {labels.chat}
      </button>
    </div>
  )
}
