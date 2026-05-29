"use client"

import type { CSSProperties, Dispatch, MouseEvent, PointerEvent as ReactPointerEvent, ReactNode, RefObject, SetStateAction } from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  ArrowDownToLine,
  BadgeCheck,
  Bell,
  Camera,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
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
  Save,
  SlidersHorizontal,
  Sparkles,
  Upload,
  UserRound,
  WalletCards,
  Wand2,
  X,
} from "lucide-react"
import { AuthModal } from "@/components/auth-modal"
import { ChatMode } from "@/components/chat-mode"
import { SubscribeModal } from "@/components/subscribe-modal"
import { ACCOUNT_MESSAGES_REFRESH_EVENT } from "@/lib/account-events"
import {
  changeAccountPassword,
  changeAccountPhone,
  formatAccountQuota,
  listAccountMessages,
  markAccountMessageRead,
  markAllAccountMessagesRead,
  sendPhoneChangeCode,
  updateAccountProfile,
} from "@/lib/account-client"
import { canvasSafeImageUrl } from "@/lib/client/image-download"
import type {
  AccountMessage,
  AuthUser,
  CatalogResponse,
  EntitlementStatus,
  GenerationJob,
  GenerationProgressEvent,
  PaintFinishEffect,
  PartAsset,
  PartCategory,
  PartColorPolicy,
  SelectionMap,
} from "@/lib/types"

type Language = "en" | "zh"
type AppMode = "config" | "chat"
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
  focusedAssetId: string
  paintId: string
  setPaintId: (value: string) => void
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
  job: GenerationJob | null
  history: GenerationJob[]
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
}

const paintEffects: PaintFinishEffect[] = ["gloss", "metallic", "matte", "satin", "pearl", "chrome", "gradient"]
const mobileCustomPaintSwatches = ["#2F6BFF", "#0F6B55", "#243B53", "#7B1E3B", "#FFD21F", "#7A4DF3", "#D96C2C", "#E8E1D4", "#5D676F", "#101114"]

function mobileRgbFromHex(hex: string): CustomRgb {
  const normalized = hex.trim().replace(/^#/, "")
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return { r: "0", g: "0", b: "0" }
  return {
    r: String(Number.parseInt(normalized.slice(0, 2), 16)),
    g: String(Number.parseInt(normalized.slice(2, 4), 16)),
    b: String(Number.parseInt(normalized.slice(4, 6), 16)),
  }
}

const stanceGlowById: Record<string, string> = {
  raise: "radial-gradient(circle, rgba(20, 184, 166, 0.3) 0%, rgba(20, 184, 166, 0.12) 46%, rgba(20, 184, 166, 0) 72%)",
  "slight-lower": "radial-gradient(circle, rgba(125, 92, 255, 0.3) 0%, rgba(125, 92, 255, 0.12) 46%, rgba(125, 92, 255, 0) 72%)",
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
const mobilePartsAccordionTransition = {
  height: { duration: 0.46, ease: [0.22, 1, 0.36, 1] },
  opacity: { duration: 0.28, ease: "easeOut" },
  y: { duration: 0.34, ease: [0.22, 1, 0.36, 1] },
} as const

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

  const mobileOverlayOpen = configHistoryOpen || profileOpen || authOpen || subscribeOpen || chatSidebarOpen

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
        language={language}
        onLanguage={toggleLanguage}
        onProfile={() => setProfileOpen(true)}
        onMenu={() => {
          if (accessKind === "login") {
            triggerAccessBanner()
            return
          }
          if (appMode === "config") {
            setConfigHistoryOpen(true)
            return
          }
          setChatSidebarOpen(true)
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
        {visibleModes.map((mode) => {
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
                <MobileChatMode {...frameProps} mobileSidebarOpen={chatSidebarOpen} setMobileSidebarOpen={setChatSidebarOpen} />
              )}
            </div>
          )
        })}
      </section>
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
        <strong>AI MOD STUDIO</strong>
        <span>{language === "zh" ? "正在加载改装工作室" : "Loading tuning studio"}</span>
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
  const isLoginBlocked = mobileAccessKind === "login"
  const isGenerateBlocked = mobileAccessKind === "login" || mobileAccessKind === "config_quota"
  const generatedResultUrl = job?.status === "succeeded" ? job.resultImageUrl : ""
  const safeVehiclePreview = canvasSafeImageUrl(vehiclePreview)
  const safeGeneratedResultUrl = canvasSafeImageUrl(generatedResultUrl)
  const hasGenerated = Boolean(generatedResultUrl)
  const canUseGeneratedView = hasGenerated
  const canUseCompareView = Boolean(vehiclePreview && hasGenerated)
  const effectiveViewMode = vehiclePreview ? viewMode : "original"
  const isCompareView = effectiveViewMode === "compare" && hasGenerated
  const isGeneratedResultView = effectiveViewMode === "generated" && hasGenerated
  const canToggleMediaChrome = isCompareView || isGeneratedResultView
  const canUploadFromMedia = effectiveViewMode === "original"
  const mediaCardClassName = [
    "mobile-media-card",
    isCompareView ? "is-compare" : "",
    isGeneratedResultView ? "is-generated-result" : "",
    canToggleMediaChrome ? "can-toggle-chrome" : "",
    mediaChromeHidden ? "chrome-hidden" : "",
  ].filter(Boolean).join(" ")
  const summaryText = selectedAssets.map((asset) => `${asset.brand} ${asset.variant}`).join(" / ") || selectedPaintLabel
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
          className={`${vehiclePreview ? "mobile-media-upload has-image" : "mobile-media-upload"}${canUploadFromMedia ? "" : " view-only"}${canToggleMediaChrome ? " can-toggle-chrome" : ""}`}
          disabled={!vehiclePreview && !canUploadFromMedia}
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
            if (!canUploadFromMedia) return
            inputRef.current?.click()
          }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault()
            if (isLoginBlocked) {
              blockMobileAccess()
              return
            }
            if (!canUploadFromMedia) return
            onFile(event.dataTransfer.files[0])
          }}
        >
          {vehiclePreview ? (
            isCompareView ? (
              <div className="mobile-compare-grid">
                <img src={safeVehiclePreview} alt="Original vehicle" />
                <img src={safeGeneratedResultUrl} alt="Generated vehicle" />
              </div>
            ) : (
              <img src={effectiveViewMode === "original" || !hasGenerated ? safeVehiclePreview : safeGeneratedResultUrl} alt="Vehicle preview" />
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
        <div className="mobile-view-tabs" role="tablist" aria-hidden={canToggleMediaChrome && mediaChromeHidden}>
          <button type="button" className={effectiveViewMode === "original" ? "active" : ""} onClick={() => runMobileAction(() => setViewMode("original"))}>
            {t.original}
          </button>
          <button type="button" className={effectiveViewMode === "generated" ? "active" : ""} disabled={!canUseGeneratedView && !isLoginBlocked} onClick={() => runMobileAction(() => setViewMode("generated"))}>
            {t.generated}
          </button>
          <button type="button" className={effectiveViewMode === "compare" ? "active" : ""} disabled={!canUseCompareView && !isLoginBlocked} onClick={() => runMobileAction(() => setViewMode("compare"))}>
            {t.compare}
          </button>
        </div>
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
        <button type="button" className="mobile-action-save" disabled={!hasGenerated} onClick={() => runMobileAction(() => saveResult(isCompareView ? "compare" : "generated"))}>
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
  focusedAssetId,
}: MobileStudioAppProps) {
  const search = assetSearch.trim().toLowerCase()

  return (
    <section className="mobile-parts-panel parts-selector-block">
      <button type="button" className="parts-select-trigger">
        <span>{language === "zh" ? "当前配件组合" : "Current parts"}</span>
        <strong>{Object.keys(selections).length ? `${Object.keys(selections).length} ${t.partsSelected}` : t.noParts}</strong>
        <em>{language === "zh" ? "展开" : "Open"}</em>
      </button>
      <div className="parts-dropdown open">
        <div className="parts-dropdown-inner">
          <label className="parts-search">
            <Search size={15} />
            <input value={assetSearch} onChange={(event) => setAssetSearch(event.target.value)} placeholder={t.searchParts} />
          </label>
          {assetSuggestions.length > 0 && (
            <div className="parts-suggestion-list" role="listbox" aria-label="Part search suggestions">
              {assetSuggestions.map(({ asset, categoryLabel }) => (
                <button key={asset.id} type="button" onClick={() => revealAsset(asset)}>
                  <span>{categoryLabel}</span>
                  <strong>{asset.brand}</strong>
                  <em>
                    {asset.model} {asset.variant}
                  </em>
                </button>
              ))}
            </div>
          )}
          <section className="parts-accordion">
            {categories.map((category) => {
              const isOpen = expandedCategory === category.id
              const categoryBrands = catalog.brands.filter((brand) => brand.categoryId === category.id)
              const activeBrandId = brandFilters[category.id] || categoryBrands[0]?.id || ""
              const categoryAssets = catalog.assets.filter((asset) => {
                if (asset.categoryId !== category.id) return false
                if (activeBrandId && asset.brandId !== activeBrandId) return false
                if (!search) return true
                return [asset.brand, asset.model, asset.variant, asset.color, asset.finish, category.label].some((value) =>
                  value.toLowerCase().includes(search),
                )
              })
              const selectedAsset = catalog.assets.find((asset) => selections[category.id] === asset.id)

              return (
                <article key={category.id} className={isOpen ? "accordion-card expanded" : "accordion-card"}>
                  <button type="button" className="accordion-trigger" onClick={() => setExpandedCategory(isOpen ? "" : category.id)}>
                    <span className="accordion-mark">{isOpen ? <X size={16} /> : <Plus size={16} />}</span>
                    <span className="accordion-copy">
                      <strong>{category.label}</strong>
                      <small>{selectedAsset ? `${selectedAsset.brand} ${selectedAsset.model} ${selectedAsset.variant}` : category.description}</small>
                    </span>
                    {selectedAsset && <BadgeCheck className="selected-check" size={15} />}
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                    <motion.div
                      className="accordion-content"
                      initial={{ height: 0, opacity: 0, y: -8 }}
                      animate={{ height: "auto", opacity: 1, y: 0 }}
                      exit={{ height: 0, opacity: 0, y: -6 }}
                      transition={mobilePartsAccordionTransition}
                      style={{ contain: "layout paint", overflow: "clip", willChange: "height, opacity, transform" } as CSSProperties}
                    >
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
                        {categoryAssets.length ? (
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
                                  <img src={asset.imageUrl} alt={`${asset.brand} ${asset.model}`} style={{ objectPosition: asset.imageCrop || "center" }} />
                                  <strong>{asset.brand} {asset.model}</strong>
                                  <span>{asset.variant}</span>
                                  <small>{asset.finish}</small>
                                </button>
                              )
                            })}
                          </div>
                        ) : (
                          <div className="empty-category">{t.emptyCategory}</div>
                        )}
                      </div>
                    </motion.div>
                    )}
                  </AnimatePresence>
                </article>
              )
            })}
          </section>
        </div>
      </div>
    </section>
  )
}

function MobilePaintSheet({
  language,
  t,
  catalog,
  paintId,
  setPaintId,
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
          {catalog.paints.map((paint) => (
            <button
              key={paint.id}
              type="button"
              className={paint.id === paintId ? "selected" : ""}
              style={{ backgroundColor: paint.hex }}
              title={paint.label}
              onClick={() => {
                setPaintId(paint.id)
                setPaintFinishEffect("gloss")
                setDraftPaintFinishEffect("gloss")
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
                <span>AI Mod Studio</span>
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
}: MobileStudioAppProps & { setSheet?: (sheet: MobileSheet) => void; onClose?: () => void }) {
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
  const candidates = [item.displayVehicleModel, item.standardJson?.vehicle?.model, item.id]
  return candidates.map((value) => cleanMobileHistoryTitle(value)).find(Boolean) || item.id
}

function cleanMobileHistoryTitle(value: unknown) {
  const text = String(value || "").trim().replace(/\s+/g, " ")
  if (!text) return ""
  const normalized = text.toLowerCase()
  if (normalized === "user uploaded vehicle, preserve exact identity") return ""
  if (normalized === "vehicle model pending" || normalized === "unknown" || normalized === "n/a") return ""
  return text
}

type MobileProfileSection = "overview" | "profile" | "password" | "phone" | "messages"
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
  mobileTheme,
  authUser,
  billing,
  setAuthOpen,
  setSubscribeOpen,
  onAuthed,
  logout,
}: MobileStudioAppProps & { open: boolean; onClose: () => void }) {
  const isZh = language === "zh"
  const [section, setSection] = useState<MobileProfileSection>("overview")
  const [profileRouteDirection, setProfileRouteDirection] = useState<MobileProfileRouteDirection>("forward")
  const [name, setName] = useState(authUser?.name || authUser?.username || "")
  const [email, setEmail] = useState(authUser?.email || "")
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

  useEffect(() => {
    if (!open) return
    setSection("overview")
    setProfileRouteDirection("forward")
    setName(authUser?.name || authUser?.username || "")
    setEmail(authUser?.email || "")
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

  const displayName = authUser ? authUser.name || authUser.username : isZh ? "未登录" : "Guest"
  const accountLine = authUser?.phone || authUser?.email || authUser?.username || (isZh ? "登录后管理你的账号" : "Sign in to manage your account")
  const planName = billing?.plan.label || authUser?.plan || (isZh ? "游客" : "Guest")
  const unlimitedText = isZh ? "不限" : "Unlimited"
  const configBalance = formatAccountQuota(billing?.configRemaining, unlimitedText)
  const chatBalance = formatAccountQuota(billing?.chatRemainingToday, unlimitedText)
  const initials = authUser ? (displayName.trim().slice(0, 2) || "AM").toUpperCase() : "AM"

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
    const payload = await updateAccountProfile({ name, email })
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
    const result = await sendPhoneChangeCode(phone)
    setStatus(result.mockCode ? `${isZh ? "验证码已发送" : "Code sent"}: ${result.mockCode}` : isZh ? "验证码已发送" : "Code sent")
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
    : section === "profile"
    ? (isZh ? "编辑资料" : "Edit profile")
    : section === "phone"
      ? (isZh ? "换绑手机号" : "Change phone")
      : section === "password"
        ? (isZh ? "修改密码" : "Change password")
        : (isZh ? "个人中心" : "Profile")

  const renderStatus = () => (
    (status || error) ? <p className={error ? "mobile-profile-status error" : "mobile-profile-status"}>{error || status}</p> : null
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
          <section className="mobile-profile-edit-body">
            {children}
            {renderStatus()}
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

  const renderEditor = () => {
    if (!authUser || section === "overview") return renderProfileEditorShell(null)

    if (section === "messages") {
      return renderProfileEditorShell(renderMessages())
    }

    if (section === "profile") {
      return renderProfileEditorShell(
        <form className="mobile-profile-editor" onSubmit={(event) => {
          event.preventDefault()
          void saveProfile()
        }}>
          <label>
            <span>{isZh ? "昵称" : "Display name"}</span>
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label>
            <span>{isZh ? "邮箱" : "Email"}</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <button type="submit" disabled={loading}>
            <Save size={17} />
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
          <label>
            <span>{isZh ? "当前密码" : "Current password"}</span>
            <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
          </label>
          <label>
            <span>{isZh ? "新密码" : "New password"}</span>
            <input type="password" value={nextPassword} onChange={(event) => setNextPassword(event.target.value)} />
          </label>
          <label>
            <span>{isZh ? "确认新密码" : "Confirm new password"}</span>
            <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
          </label>
          <button type="submit" disabled={loading}>
            <Save size={17} />
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
        <label>
          <span>{isZh ? "新手机号" : "New phone"}</span>
          <input value={phone} onChange={(event) => setPhone(event.target.value)} />
        </label>
        <label>
          <span>{isZh ? "验证码" : "Code"}</span>
          <div className="mobile-profile-code-row">
            <input value={phoneCode} onChange={(event) => setPhoneCode(event.target.value)} />
            <button type="button" onClick={() => void sendCode()} disabled={loading}>
              {isZh ? "发送" : "Send"}
            </button>
          </div>
        </label>
        <button type="submit" disabled={loading}>
          <Save size={17} />
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
          data-has-messages={authUser ? "true" : "false"}
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

          {authUser && (
            <button type="button" className="mobile-profile-message-trigger" onClick={openMessages} aria-label={isZh ? "消息提醒" : "Notifications"}>
              <Bell size={18} />
              <span>{isZh ? "消息" : "Messages"}</span>
              {unreadMessageCount > 0 && <em>{unreadMessageCount > 99 ? "99+" : unreadMessageCount}</em>}
            </button>
          )}

          <section className="mobile-profile-hero">
            <div className="mobile-profile-avatar">
              <span>{initials}</span>
            </div>
            <h2>{displayName}</h2>
            <p>{accountLine}</p>
          </section>

          <section className="mobile-profile-stats" aria-label={isZh ? "账号额度" : "Account balance"}>
            <div>
              <strong>{configBalance}</strong>
              <span>{isZh ? "生成额度" : "Generations"}</span>
            </div>
            <div>
              <strong>{chatBalance}</strong>
              <span>{isZh ? "对话额度" : "Chat quota"}</span>
            </div>
            <div>
              <strong>{planName}</strong>
              <span>{isZh ? "当前套餐" : "Current plan"}</span>
            </div>
          </section>

          {renderEditor()}
          {section === "overview" && renderStatus()}

          <section className="mobile-profile-list">
            {!authUser ? (
              <button type="button" className="mobile-profile-row primary" onClick={openAuth}>
                <span><KeyRound size={19} /></span>
                <div>
                  <strong>{isZh ? "登录账号" : "Sign in"}</strong>
                  <small>{isZh ? "登录后解锁完整账号管理" : "Unlock account management"}</small>
                </div>
                <ChevronRight size={19} />
              </button>
            ) : (
              <>
                <button type="button" className="mobile-profile-row" onClick={() => openProfileSection("profile")}>
                  <span><Pencil size={19} /></span>
                  <div>
                    <strong>{isZh ? "编辑资料" : "Edit profile"}</strong>
                    <small>{isZh ? "昵称和邮箱会保存到账号" : "Save display name and email"}</small>
                  </div>
                  <ChevronRight size={19} />
                </button>
                <button type="button" className="mobile-profile-row" onClick={() => openProfileSection("phone")}>
                  <span><UserRound size={19} /></span>
                  <div>
                    <strong>{isZh ? "换绑手机号" : "Change phone"}</strong>
                    <small>{authUser.phone || (isZh ? "绑定手机号" : "Bind phone number")}</small>
                  </div>
                  <ChevronRight size={19} />
                </button>
                <button type="button" className="mobile-profile-row" onClick={() => openProfileSection("password")}>
                  <span><LockKeyhole size={19} /></span>
                  <div>
                    <strong>{isZh ? "修改密码" : "Change password"}</strong>
                    <small>{isZh ? "需要输入当前密码" : "Current password required"}</small>
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
  const initials = authUser ? (displayName.trim().slice(0, 2) || "AM").toUpperCase() : "AM"

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
              <span>{initials}</span>
              <button type="button" aria-label={isZh ? "更换头像" : "Change avatar"}>
                <Camera size={17} />
              </button>
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
  setAuthOpen,
  setSubscribeOpen,
  onBillingChanged,
  logout,
  toggleLanguage,
  mobileAccessKind,
  onMobileAccessBlocked,
  mobileSidebarOpen,
  setMobileSidebarOpen,
}: MobileStudioAppProps & { mobileSidebarOpen: boolean; setMobileSidebarOpen: (open: boolean) => void }) {
  return (
    <section className="mobile-screen mobile-chat-screen">
      <MobileScreenHead
        eyebrow="AI Mod Studio"
        title={language === "zh" ? "对话模式" : "Chat mode"}
        language={language}
        onLanguage={toggleLanguage}
      />
      <div className="mobile-shared-mode-spacer" aria-hidden="true" />
      <div className="mobile-chat-shell">
        <ChatMode
          language={language}
          authUser={authUser}
          mobileVariant
          mobileAccessKind={mobileAccessKind}
          onMobileAccessBlocked={onMobileAccessBlocked}
          mobileSidebarOpen={mobileSidebarOpen}
          setMobileSidebarOpen={setMobileSidebarOpen}
          hideMobileMenu
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
  language,
  onLanguage,
  onMenu,
  onProfile,
}: {
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
        <span className="mobile-floating-title">AI Mod Studio</span>
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
  rightAction,
}: {
  eyebrow: string
  title: string
  language: Language
  onLanguage: () => void
  rightAction?: ReactNode
}) {
  return (
    <header className="mobile-screen-head">
      <div className="mobile-screen-title">
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
