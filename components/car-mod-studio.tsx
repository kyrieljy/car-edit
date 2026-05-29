"use client"

import type { CSSProperties, MouseEvent, PointerEvent as ReactPointerEvent } from "react"
import { useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import {
  ArrowDownToLine,
  BadgeCheck,
  Camera,
  ChevronDown,
  CircleStop,
  History,
  ImageIcon,
  KeyRound,
  Languages,
  Layers3,
  LockKeyhole,
  LogOut,
  Mail,
  MessageSquare,
  Moon,
  Palette,
  Phone,
  Plus,
  Save,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Upload,
  UserRound,
  Wand2,
  X,
} from "lucide-react"
import { AuthModal } from "@/components/auth-modal"
import { ChatMode } from "@/components/chat-mode"
import { MobileLoadingScreen, MobileStudioApp } from "@/components/mobile/mobile-studio-app"
import { SubscribeModal } from "@/components/subscribe-modal"
import {
  accountInitials,
  changeAccountPassword,
  changeAccountPhone,
  formatAccountQuota,
  sendPhoneChangeCode,
  updateAccountProfile,
  type AccountPayload,
} from "@/lib/account-client"
import { readProgressResponse } from "@/lib/progress-client"
import type {
  AuthUser,
  CatalogResponse,
  EntitlementStatus,
  GenerationProgressEvent,
  GenerationJob,
  PaintFinishEffect,
  PaintOption,
  PartAsset,
  PartColorPolicy,
  PartSelectionOptions,
  SelectionMap,
} from "@/lib/types"

type Language = "en" | "zh"
type AppMode = "config" | "chat"
type ViewMode = "generated" | "original" | "compare"
type MobileTheme = "dark" | "light"
type MobileControlSheet = "parts" | "paint" | "stance" | null
const LANGUAGE_STORAGE_KEY = "car-mod-studio-language"
const MOBILE_THEME_STORAGE_KEY = "car-mod-studio-mobile-theme"
const HISTORY_VEHICLE_MODEL_STORAGE_KEY = "car-mod-studio-history-vehicle-models"


const colorPolicyDisplayLabels: Partial<Record<PartColorPolicy, { zh: string; en: string }>> = {
  body_color: { zh: "\u540c\u8272", en: "Body color" },
  exposed_carbon: { zh: "\u88f8\u78b3", en: "Exposed carbon" },
}

const partColorPolicyCopy: Record<Language, Record<string, { label: string; options: Partial<Record<PartColorPolicy, string>> }>> = {
  en: {
    hood: {
      label: "Hood color",
      options: {
        body_color: "Body color",
        exposed_carbon: "Exposed carbon",
      },
    },
    mirrors: {
      label: "Mirror caps",
      options: {
        body_color: "Body color",
        exposed_carbon: "Exposed carbon",
      },
    },
  },
  zh: {
    hood: {
      label: "\u673a\u76d6\u989c\u8272",
      options: {
        body_color: "\u8f66\u8eab\u540c\u8272",
        exposed_carbon: "\u88f8\u78b3",
      },
    },
    mirrors: {
      label: "\u540e\u89c6\u955c\u5916\u58f3",
      options: {
        body_color: "\u8f66\u8eab\u540c\u8272",
        exposed_carbon: "\u88f8\u78b3",
      },
    },
  },
}

const categoryCopy: Record<Language, Record<string, { label: string; description: string }>> = {
  en: {
    wheels: { label: "Wheels", description: "Forged wheels, colors, offsets and fitment." },
    calipers: { label: "Brake calipers", description: "Caliper colors and performance brake styles." },
    "rear-wing": { label: "Rear wing", description: "Ducktail, GT wing and carbon aero pieces." },
    "front-bumper": { label: "Front aero", description: "Front lips, splitters and bumper profiles." },
    "side-skirts": { label: "Side skirts", description: "Carbon side extensions and lower body lines." },
    diffuser: { label: "Diffuser", description: "Rear diffusers, lower splitters and aero fins." },
    exhaust: { label: "Exhaust", description: "Tip finishes and rear exhaust layouts." },
    hood: { label: "Hood", description: "Vented hoods and carbon hood panels." },
    lights: { label: "Light tint", description: "Smoked light film and lamp treatment." },
    wrap: { label: "Wrap", description: "Body finish, matte, gloss and metallic paint." },
    mirrors: { label: "Mirrors", description: "Mirror caps and carbon trim." },
    grille: { label: "Grille", description: "Kidney grille, mesh and front intake detail." },
  },
  zh: {
    wheels: { label: "轮毂", description: "锻造轮毂、颜色、尺寸和齐边姿态。" },
    calipers: { label: "刹车卡钳", description: "卡钳颜色和性能刹车样式。" },
    "rear-wing": { label: "尾翼", description: "鸭尾、GT 尾翼和碳纤维空气套件。" },
    "front-bumper": { label: "前包围", description: "前唇、前铲和前杠线条。" },
    "side-skirts": { label: "侧裙", description: "碳纤维侧裙和下车身线条。" },
    diffuser: { label: "扩散器", description: "后扩散器、下扰流和空气翼片。" },
    exhaust: { label: "排气", description: "尾嘴材质和排气布局。" },
    hood: { label: "机盖", description: "开孔机盖和碳纤维机盖。" },
    lights: { label: "灯膜", description: "熏黑灯膜和灯组处理。" },
    wrap: { label: "贴膜/车色", description: "车身颜色、哑光、亮面和金属漆。" },
    mirrors: { label: "后视镜", description: "后视镜壳和碳纤维饰件。" },
    grille: { label: "格栅", description: "中网、进气口和前脸细节。" },
  },
}

const paintCopy: Record<Language, Record<string, string>> = {
  en: {
    factory: "Factory paint",
    "pure-black": "Pure black",
    "matte-black": "Matte black",
    "pearl-white": "Pearl white",
    "nardo-gray": "Nardo gray",
    "racing-blue": "Racing blue",
    "track-red": "Track red",
  },
  zh: {
    factory: "原厂车色",
    "pure-black": "纯黑",
    "matte-black": "哑光黑",
    "pearl-white": "珍珠白",
    "nardo-gray": "纳多灰",
    "racing-blue": "赛道蓝",
    "track-red": "赛道红",
  },
}

const copy = {
  en: {
    title: "AI Mod Studio",
    configMode: "Config Mode",
    chatMode: "Chat Mode",
    input: "Input",
    result: "Result",
    detected: "Detected vehicle",
    images: "Images",
    upload: "Upload Vehicle",
    selectedParts: "Selected Parts",
    ratio: "4:3",
    mode: "Image-to-Image",
    colorsLead: "Colors.",
    colorsText: "Choose a body finish.",
    colorShown: "Selected finish",
    stanceLead: "Stance.",
    stanceText: "Tune the ride height.",
    stock: "Stock",
    slight: "Street",
    flush: "Flush",
    aggressive: "Aggressive",
    provider: "Provider",
    admin: "Admin",
    run: "Run",
    running: "Running...",
    cancel: "Cancel",
    original: "Original",
    generated: "Render",
    compare: "Compare",
    ready: "Ready to generate",
    waiting: "Upload a vehicle image, then run the render.",
    noParts: "No part selected",
    partSelected: "part selected",
    partsSelected: "parts selected",
    chooseBrand: "Brand",
    emptyCategory: "Add assets for this category in Admin.",
    save: "Save",
    export: "Export",
    rerun: "Run again",
    history: "History",
    records: "records",
    historyEmpty: "Generated thumbnails will appear here.",
    invalidFile: "Use jpg, png or webp.",
    missingVehicle: "Upload a vehicle image first.",
    generationFailed: "Generation failed.",
    emptyConfig: "Select a part, body color, or stance change first.",
    saved: "Saved to garage.",
    saveFailed: "Save failed.",
    mockNote: "Mock provider keeps the prototype cost-free until API keys are configured.",
    loading: "Loading studio...",
  },
  zh: {
    title: "AI 改装工作室",
    configMode: "自选配置",
    chatMode: "模型对话",
    input: "输入",
    result: "结果",
    detected: "识别车型",
    images: "图片",
    upload: "上传车辆",
    selectedParts: "已选配件",
    ratio: "4:3",
    mode: "图生图",
    colorsLead: "车身颜色。",
    colorsText: "选择车身效果。",
    colorShown: "当前颜色",
    stanceLead: "车身高度。",
    stanceText: "调整姿态。",
    stock: "原厂",
    slight: "街道",
    flush: "齐边",
    aggressive: "极低",
    provider: "模型接口",
    admin: "后台",
    run: "生成",
    running: "生成中...",
    cancel: "取消",
    original: "原图",
    generated: "生成图",
    compare: "对比",
    ready: "等待生成",
    waiting: "上传车辆图片后生成改装效果。",
    noParts: "未选择配件",
    partSelected: "个配件已选",
    partsSelected: "个配件已选",
    chooseBrand: "品牌",
    emptyCategory: "请在后台为该分类添加配件。",
    save: "保存",
    export: "导出",
    rerun: "重新生成",
    history: "历史",
    records: "条",
    historyEmpty: "生成后会在这里显示缩略图。",
    invalidFile: "请使用 jpg、png 或 webp。",
    missingVehicle: "请先上传车辆图片。",
    generationFailed: "生成失败。",
    saved: "已保存到案例库。",
    saveFailed: "保存失败。",
    mockNote: "Mock 接口用于原型演示，配置 API key 后可切换真实接口。",
    loading: "正在加载...",
  },
}

const studioCategoryCopy: typeof categoryCopy = {
  en: categoryCopy.en,
  zh: {
    wheels: { label: "轮毂", description: "锻造轮毂、颜色、尺寸和齐边姿态。" },
    calipers: { label: "刹车卡钳", description: "卡钳颜色和性能刹车样式。" },
    "rear-wing": { label: "尾翼", description: "鸭尾、GT 尾翼和碳纤维空力套件。" },
    "front-bumper": { label: "前包围", description: "前唇、前铲和前杠线条。" },
    "side-skirts": { label: "侧裙", description: "碳纤维侧裙和下车身线条。" },
    diffuser: { label: "扩散器", description: "后扩散器、下扰流和空力鳍片。" },
    exhaust: { label: "排气", description: "尾嘴材质和排气布局。" },
    hood: { label: "机盖", description: "开孔机盖和碳纤维机盖。" },
    lights: { label: "灯膜", description: "熏黑灯膜和灯组处理。" },
    wrap: { label: "贴膜/车色", description: "车身颜色、哑光、亮面和金属漆。" },
    mirrors: { label: "后视镜", description: "后视镜壳和碳纤维饰件。" },
    grille: { label: "格栅", description: "中网、进气口和前脸细节。" },
  },
}

const studioPaintCopy: typeof paintCopy = {
  en: paintCopy.en,
  zh: {
    factory: "原厂车色",
    "pure-black": "纯黑",
    "matte-black": "哑光黑",
    "pearl-white": "珍珠白",
    "nardo-gray": "纳多灰",
    "racing-blue": "赛道蓝",
    "track-red": "赛道红",
  },
}

const studioCopy: typeof copy = {
  en: copy.en,
  zh: {
    title: "AI 改装效果工作室",
    configMode: "自选配置",
    chatMode: "模型对话",
    input: "输入",
    result: "结果",
    detected: "识别车型",
    images: "图片",
    upload: "上传车辆",
    selectedParts: "已选配件",
    ratio: "4:3",
    mode: "图生图",
    colorsLead: "车身颜色。",
    colorsText: "选择车身效果。",
    colorShown: "当前颜色",
    stanceLead: "车身高度。",
    stanceText: "调整姿态。",
    stock: "原厂",
    slight: "街道",
    flush: "齐边",
    aggressive: "极低",
    provider: "模型接口",
    admin: "后台",
    run: "生成",
    running: "生成中...",
    cancel: "取消",
    original: "原图",
    generated: "生成图",
    compare: "对比",
    ready: "等待生成",
    waiting: "上传车辆图片后生成改装效果。",
    noParts: "未选择配件",
    partSelected: "个配件已选",
    partsSelected: "个配件已选",
    chooseBrand: "品牌",
    emptyCategory: "请在后台为该分类添加配件。",
    save: "保存",
    export: "导出",
    rerun: "重新生成",
    history: "历史",
    records: "条",
    historyEmpty: "生成后会在这里显示缩略图。",
    invalidFile: "请使用 jpg、png 或 webp。",
    missingVehicle: "请先上传车辆图片。",
    generationFailed: "生成失败。",
    saved: "已保存到案例库。",
    saveFailed: "保存失败。",
    mockNote: "Mock 接口用于原型演示，配置 API key 后可切换真实接口。",
    loading: "正在加载...",
  },
}

const cleanCategoryCopy: Record<Language, Record<string, { label: string; description: string }>> = {
  en: categoryCopy.en,
  zh: {
    wheels: { label: "轮毂", description: "锻造轮毂、颜色、ET 与姿态效果。" },
    calipers: { label: "卡钳", description: "刹车卡钳颜色与性能刹车风格。" },
    "rear-wing": { label: "尾翼", description: "鸭尾、GT 尾翼与碳纤维空气动力套件。" },
    "front-bumper": { label: "前包围", description: "前唇、分流器与前杠轮廓。" },
    "side-skirts": { label: "侧裙", description: "碳纤维侧裙与车身下沿线条。" },
    diffuser: { label: "扩散器", description: "后扩散器、底部分流器与导流鳍。" },
    exhaust: { label: "排气", description: "尾喉材质、颜色与排气布局。" },
    hood: { label: "机盖", description: "开孔机盖与碳纤维机盖面板。" },
    lights: { label: "灯膜", description: "熏黑灯膜与灯组处理。" },
    wrap: { label: "贴膜/车身色", description: "哑光、高亮、金属漆与整车改色。" },
    mirrors: { label: "后视镜", description: "后视镜壳与碳纤维饰件。" },
    grille: { label: "格栅", description: "双肾格栅、蜂窝网与前进气细节。" },
  },
}

const cleanPaintCopy: Record<Language, Record<string, string>> = {
  en: paintCopy.en,
  zh: {
    factory: "原厂漆",
    "pure-black": "纯黑",
    "matte-black": "哑光黑",
    "pearl-white": "珍珠白",
    "nardo-gray": "纳多灰",
    "racing-blue": "赛道蓝",
    "track-red": "赛道红",
  },
}

const customPaintSwatches = ["#2F6BFF", "#0F6B55", "#243B53", "#7B1E3B", "#FFD21F", "#7A4DF3", "#D96C2C", "#E8E1D4", "#5D676F", "#101114"]

const defaultCustomPaintHex = "#2F6BFF"
const defaultGradientFromHex = "#006DFF"
const defaultGradientToHex = "#7A2CFF"
type CustomRgb = { r: string; g: string; b: string }

const paintFinishEffects: PaintFinishEffect[] = ["gloss", "metallic", "matte", "satin", "pearl", "chrome", "gradient"]

const paintFinishCopy: Record<Language, Record<PaintFinishEffect, string>> = {
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

const stancePresets = [
  { id: "raise", value: 25, label: { zh: "升高", en: "Raise" } },
  { id: "slight-lower", value: 50, label: { zh: "降低", en: "Lower" } },
  { id: "flush-lower", value: 70, label: { zh: "齐边", en: "Flush" } },
  { id: "extreme-low", value: 90, label: { zh: "气动避震", en: "air suspension" } },
] as const

type StancePresetId = (typeof stancePresets)[number]["id"]

const stanceGlowById: Record<StancePresetId, string> = {
  raise: "radial-gradient(circle, rgba(20, 184, 166, 0.3) 0%, rgba(20, 184, 166, 0.12) 46%, rgba(20, 184, 166, 0) 72%)",
  "slight-lower": "radial-gradient(circle, rgba(125, 92, 255, 0.3) 0%, rgba(125, 92, 255, 0.12) 46%, rgba(125, 92, 255, 0) 72%)",
  "flush-lower": "radial-gradient(circle, rgba(34, 211, 238, 0.28) 0%, rgba(34, 211, 238, 0.11) 46%, rgba(34, 211, 238, 0) 72%)",
  "extreme-low": "radial-gradient(circle, rgba(236, 72, 153, 0.3) 0%, rgba(236, 72, 153, 0.12) 46%, rgba(236, 72, 153, 0) 72%)",
}

const cleanStudioCopy = {
  en: {
    ...copy.en,
    detected: "Detected model",
    selectedParts: "Selected parts",
    searchParts: "Search brand or model",
    saveExport: "Save / Export",
    login: "Login",
    logout: "Logout",
    member: "Membership",
    quota: "Quota",
    elapsed: "Elapsed",
    elapsedUnit: "sec",
  },
  zh: {
    title: "AI 改装效果工作室",
    configMode: "配置模式",
    chatMode: "对话模式",
    input: "输入",
    result: "结果",
    detected: "识别车型",
    images: "图片",
    upload: "上传车辆",
    selectedParts: "已选配件",
    ratio: "4:3",
    mode: "图生图",
    colorsLead: "颜色。",
    colorsText: "选择车身颜色。",
    colorShown: "当前颜色",
    stanceLead: "车身高度。",
    stanceText: "调节姿态高度。",
    stock: "原厂",
    slight: "街道",
    flush: "齐边",
    aggressive: "极低",
    provider: "模型接口",
    admin: "后台",
    run: "生成",
    running: "生成中...",
    cancel: "取消",
    original: "原图",
    generated: "生成图",
    compare: "对比",
    ready: "准备生成",
    waiting: "请先上传车辆图片，然后生成效果。",
    noParts: "未选择配件",
    partSelected: "个配件已选",
    partsSelected: "个配件已选",
    chooseBrand: "品牌",
    emptyCategory: "请在后台为该分类添加资源。",
    save: "保存",
    export: "导出",
    rerun: "重新生成",
    history: "历史",
    records: "条记录",
    historyEmpty: "生成后会在这里显示缩略图。",
    invalidFile: "请使用 jpg、png 或 webp。",
    missingVehicle: "请先上传车辆图片。",
    generationFailed: "生成失败。",
    emptyConfig: "请先选择配件、车身颜色或车身高度变化。",
    saved: "已保存到案例库。",
    saveFailed: "保存失败。",
    mockNote: "原型阶段使用 Mock Provider，配置密钥后可切换真实接口。",
    loading: "正在加载工作室...",
    searchParts: "搜索品牌或型号",
    saveExport: "保存 / 导出",
    login: "登录",
    logout: "退出",
    member: "会员",
    quota: "额度",
    elapsed: "耗时",
    elapsedUnit: "秒",
  },
}

type StudioCopy = (typeof cleanStudioCopy)["en"]

function ResponsiveStudioLoading({ language, text }: { language: Language; text: string }) {
  return (
    <main className="app-shell loading-shell responsive-loading-shell" aria-live="polite">
      <div className="loading-mark responsive-loading-desktop">
        <Sparkles />
        <span>{text}</span>
      </div>
      <div className="responsive-mobile-loading">
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
      </div>
    </main>
  )
}

export function CarModStudio() {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const partsDropdownRef = useRef<HTMLDivElement | null>(null)
  const assetRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [language, setLanguage] = useState<Language>("zh")
  const [appMode, setAppMode] = useState<AppMode>("config")
  const [shellMode, setShellMode] = useState<AppMode>("config")
  const [mobileTheme, setMobileTheme] = useState<MobileTheme>("dark")
  const [mobileControlSheet, setMobileControlSheet] = useState<MobileControlSheet>(null)
  const [catalog, setCatalog] = useState<CatalogResponse | null>(null)
  const [vehicleFile, setVehicleFile] = useState<File | null>(null)
  const [vehiclePreview, setVehiclePreview] = useState("")
  const [vehicleNote, setVehicleNote] = useState("")
  const [vehicleNoteEdited, setVehicleNoteEdited] = useState(false)
  const [vehicleRecognitionError, setVehicleRecognitionError] = useState("")
  const [isRecognizingVehicle, setIsRecognizingVehicle] = useState(false)
  const [expandedCategory, setExpandedCategory] = useState("")
  const [brandFilters, setBrandFilters] = useState<Record<string, string>>({ wheels: "brand-bbs" })
  const [partsOpen, setPartsOpen] = useState(false)
  const [assetSearch, setAssetSearch] = useState("")
  const [focusedAssetId, setFocusedAssetId] = useState("")
  const [selections, setSelections] = useState<SelectionMap>({})
  const [selectionOptions, setSelectionOptions] = useState<PartSelectionOptions>({})
  const [paintId, setPaintId] = useState("factory")
  const [paintFinishEffect, setPaintFinishEffect] = useState<PaintFinishEffect>("gloss")
  const [draftPaintFinishEffect, setDraftPaintFinishEffect] = useState<PaintFinishEffect>("gloss")
  const [customColorOpen, setCustomColorOpen] = useState(false)
  const [customPaintHex, setCustomPaintHex] = useState(defaultCustomPaintHex)
  const [customPaintRgb, setCustomPaintRgb] = useState<CustomRgb>(rgbStringsFromHex(defaultCustomPaintHex))
  const [activeCustomPaintHex, setActiveCustomPaintHex] = useState(defaultCustomPaintHex)
  const [gradientFromHex, setGradientFromHex] = useState(defaultGradientFromHex)
  const [gradientToHex, setGradientToHex] = useState(defaultGradientToHex)
  const [activeGradientFromHex, setActiveGradientFromHex] = useState(defaultGradientFromHex)
  const [activeGradientToHex, setActiveGradientToHex] = useState(defaultGradientToHex)
  const [stance, setStance] = useState(0)
  const [viewMode, setViewMode] = useState<ViewMode>("generated")
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationElapsedSeconds, setGenerationElapsedSeconds] = useState(0)
  const [generationDurationSeconds, setGenerationDurationSeconds] = useState<number | null>(null)
  const [generationProgress, setGenerationProgress] = useState<GenerationProgressEvent | null>(null)
  const [job, setJob] = useState<GenerationJob | null>(null)
  const [history, setHistory] = useState<GenerationJob[]>([])
  const [notice, setNotice] = useState("")
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [billing, setBilling] = useState<EntitlementStatus | null>(null)
  const [authOpen, setAuthOpen] = useState(false)
  const [subscribeOpen, setSubscribeOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [viewportReady, setViewportReady] = useState(false)
  const [isMobileViewport, setIsMobileViewport] = useState(false)

  const t = cleanStudioCopy[language]

  useEffect(() => {
    const query = window.matchMedia("(max-width: 760px)")
    const update = () => {
      setIsMobileViewport(query.matches)
      setViewportReady(true)
    }
    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])

  useEffect(() => {
    const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY)
    if (stored === "en" || stored === "zh") setLanguage(stored)
  }, [])

  useEffect(() => {
    // Multi-theme source is retained, but this release keeps the public mobile UI on dark theme.
    window.localStorage.setItem(MOBILE_THEME_STORAGE_KEY, "dark")
    setMobileTheme("dark")
  }, [])

  useEffect(() => {
    if (appMode !== "config") setMobileControlSheet(null)
  }, [appMode])

  const toggleLanguage = () => {
    setLanguage((current) => {
      const next: Language = current === "en" ? "zh" : "en"
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next)
      return next
    })
  }

  const toggleMobileTheme = () => {
    setMobileTheme((current) => {
      const next: MobileTheme = current === "dark" ? "light" : "dark"
      window.localStorage.setItem(MOBILE_THEME_STORAGE_KEY, next)
      return next
    })
  }

  useEffect(() => {
    fetch("/api/catalog")
      .then((response) => response.json())
      .then(setCatalog)
      .catch(() => setNotice("Failed to load catalog."))
  }, [])

  useEffect(() => {
    fetch("/api/auth/me")
      .then((response) => response.json())
      .then((body) => {
        setAuthUser(body.user ?? null)
        setBilling(body.billing ?? null)
      })
      .catch(() => undefined)
  }, [])

  useEffect(() => {
    if (!authUser) {
      setHistory([])
      return
    }
    let ignore = false
    fetch("/api/garage")
      .then((response) => {
        if (!response.ok) return { generations: [] }
        return response.json()
      })
      .then((body: { generations?: GenerationJob[] }) => {
        if (!ignore) setHistory(applyStoredHistoryVehicleModels((body.generations ?? []).filter(isRenderableGeneration)))
      })
      .catch(() => undefined)
    return () => {
      ignore = true
    }
  }, [authUser])

  useEffect(() => {
    if (!vehicleFile) return
    const url = URL.createObjectURL(vehicleFile)
    setVehiclePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [vehicleFile])

  useEffect(() => {
    if (!isGenerating) return
    const startedAt = Date.now()
    setGenerationElapsedSeconds(0)
    const timer = window.setInterval(() => {
      setGenerationElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [isGenerating])

  const categories = useMemo(() => {
    if (!catalog) return []
    return catalog.categories.map((category) => ({
      ...category,
      label: language === "zh" ? category.labelZh || category.label : category.labelEn || category.label,
      description: category.description,
    }))
  }, [catalog, language])

  const selectedAssets = useMemo(() => {
    if (!catalog) return []
    return Object.values(selections)
      .map((assetId) => catalog.assets.find((asset) => asset.id === assetId))
      .filter((asset): asset is PartAsset => Boolean(asset))
  }, [catalog, selections])
  const colorPolicyAssets = selectedAssets
    .map((asset) => ({
      asset,
      policies: getSelectableColorPolicies(asset),
      selected: selectionOptions[asset.categoryId]?.colorPolicy ?? getDefaultColorPolicy(asset),
    }))
    .filter((item) => item.policies.length > 1)

  const assetSuggestions = useMemo(() => {
    if (!catalog) return []
    const search = assetSearch.trim().toLowerCase()
    if (!search) return []
    return catalog.assets
      .map((asset) => {
        const category = categories.find((item) => item.id === asset.categoryId)
        const searchable = [category?.label, asset.brand, asset.model, asset.variant, asset.color, asset.finish].filter(Boolean).join(" ").toLowerCase()
        return { asset, categoryLabel: category?.label ?? asset.categoryId, searchable }
      })
      .filter((item) => item.searchable.includes(search))
      .slice(0, 8)
  }, [assetSearch, catalog, categories])

  const customPaintOption = useMemo(() => buildCustomPaintOption(customPaintHex, customPaintRgb), [customPaintHex, customPaintRgb])
  const activeCustomPaintOption = useMemo(() => buildCustomPaintOption(activeCustomPaintHex, rgbStringsFromHex(activeCustomPaintHex)), [activeCustomPaintHex])
  const customPaintPreviewHex = normalizeHexColor(customPaintHex) || rgbHexFromStrings(customPaintRgb) || activeCustomPaintHex
  const selectedPaint = paintId === "custom" ? activeCustomPaintOption ?? undefined : catalog?.paints.find((paint) => paint.id === paintId) ?? catalog?.paints[0]
  const gradientFrom = normalizeHexColor(gradientFromHex) || defaultGradientFromHex
  const gradientTo = normalizeHexColor(gradientToHex) || defaultGradientToHex
  const activeGradientFrom = normalizeHexColor(activeGradientFromHex) || defaultGradientFromHex
  const activeGradientTo = normalizeHexColor(activeGradientToHex) || defaultGradientToHex
  const gradientPaintValid = Boolean(normalizeHexColor(gradientFromHex) && normalizeHexColor(gradientToHex))
  const activeGradientPaintValid = Boolean(normalizeHexColor(activeGradientFromHex) && normalizeHexColor(activeGradientToHex))
  const isGradientPaint = paintFinishEffect === "gradient"
  const isGradientEditorOpen = draftPaintFinishEffect === "gradient"
  const selectedPaintBaseLabel = selectedPaint ? cleanPaintCopy[language][selectedPaint.id] ?? selectedPaint.label : ""
  const selectedPaintLabel = isGradientPaint
    ? `${paintFinishCopy[language].gradient} ${activeGradientFrom} \u2192 ${activeGradientTo}`
    : paintFinishEffect === "gloss" || paintId !== "custom"
      ? selectedPaintBaseLabel
      : `${selectedPaintBaseLabel} · ${paintFinishCopy[language][paintFinishEffect]}`
  const hasValidPaintSelection = isGradientPaint ? activeGradientPaintValid : paintId !== "custom" || Boolean(activeCustomPaintOption)
  const hasPaintChange = isGradientPaint || (paintId === "custom" && paintFinishEffect !== "gloss") || (paintId !== "factory" && hasValidPaintSelection)
  const hasConfigChange = selectedAssets.length > 0 || hasPaintChange || stance !== 0
  const canGenerate = Boolean(vehicleFile) && hasConfigChange && hasValidPaintSelection && !isGenerating && !isRecognizingVehicle
  const generationStatusRetryText = generationProgress?.retryAttempt ? (language === "zh" ? ` · 第 ${generationProgress.retryAttempt} 次重试` : ` · retry ${generationProgress.retryAttempt}`) : ""
  const generationStatusText = generationProgress?.message || t.running
  const generationStatusElapsedText =
    language === "zh"
      ? `已等待 ${generationElapsedSeconds} 秒`
      : `Waiting ${generationElapsedSeconds}s`
  const customPaintApplied = Boolean(
    !isGradientPaint &&
      !isGradientEditorOpen &&
      customPaintOption &&
      paintId === "custom" &&
      customPaintOption.hex === activeCustomPaintHex &&
      draftPaintFinishEffect === paintFinishEffect
  )
  const gradientPaintApplied = Boolean(isGradientPaint && gradientPaintValid && activeGradientFrom === gradientFrom && activeGradientTo === gradientTo)
  const customPickerHsv = useMemo(() => hsvFromHex(customPaintPreviewHex), [customPaintPreviewHex])
  const selectedStancePreset = stancePresets.find((preset) => preset.value === stance)
  const stanceName = selectedStancePreset?.label[language] ?? (language === "zh" ? "不变" : "Stock")
  const paintPreviewBackground = isGradientPaint ? `linear-gradient(90deg, ${activeGradientFrom}, ${activeGradientTo})` : (selectedPaint?.hex ?? "#050506")
  const displayVehicleNote = normalizeDetectedVehicleModel(vehicleNote)
  const vehicleDisplayName = vehiclePreview
    ? isRecognizingVehicle
      ? language === "en"
        ? "Recognizing vehicle..."
        : "正在识别车型..."
      : vehicleRecognitionError
        ? language === "en"
          ? "Recognition failed"
          : "识别失败"
        : displayVehicleNote || (language === "en" ? "Vehicle model pending" : "车型待识别")
    : language === "en"
      ? "Upload vehicle to detect"
      : "上传车辆后自动识别"

  const recognizeVehicle = async (file: File) => {
    const formData = new FormData()
    formData.append("vehicleImage", file)
    setIsRecognizingVehicle(true)
    setVehicleRecognitionError("")
    try {
      const response = await fetch("/api/vehicle-recognition", {
        method: "POST",
        body: formData,
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        const message = String(body.error || `Vehicle recognition failed. HTTP ${response.status}`)
        if (response.status === 401) setAuthOpen(true)
        setNotice(message)
        setVehicleRecognitionError(message)
        setVehicleNote("")
        setVehicleNoteEdited(false)
        return
      }
      const detectedModel = extractDetectedVehicleModel(body)
      if (detectedModel) {
        setVehicleNote(detectedModel)
        setVehicleNoteEdited(false)
        setVehicleRecognitionError("")
      } else {
        const message = language === "en" ? "Recognition completed, but no vehicle model was returned." : "识别已完成，但模型没有返回车型。"
        setVehicleNote("")
        setVehicleNoteEdited(false)
        setVehicleRecognitionError(message)
        setNotice(message)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Vehicle recognition failed."
      setNotice(message)
      setVehicleRecognitionError(message)
      setVehicleNote("")
      setVehicleNoteEdited(false)
    } finally {
      setIsRecognizingVehicle(false)
    }
  }

  const onFile = (file: File | undefined) => {
    if (!file) return
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setNotice(t.invalidFile)
      return
    }
    setVehicleFile(file)
    setVehicleNote("")
    setVehicleNoteEdited(false)
    setVehicleRecognitionError("")
    setGenerationDurationSeconds(null)
    setJob(null)
    setViewMode("original")
    setNotice("")
    void recognizeVehicle(file)
  }

  const selectAsset = (asset: PartAsset) => {
    const alreadySelected = selections[asset.categoryId] === asset.id
    setSelections((current) => {
      const next = { ...current }
      if (alreadySelected) delete next[asset.categoryId]
      else next[asset.categoryId] = asset.id
      return next
    })
    setSelectionOptions((current) => {
      const next = { ...current }
      const colorPolicy = getDefaultColorPolicy(asset)
      if (alreadySelected || !colorPolicy) {
        delete next[asset.categoryId]
      } else {
        next[asset.categoryId] = { ...next[asset.categoryId], colorPolicy }
      }
      return next
    })
  }

  const selectAssetColorPolicy = (event: MouseEvent<HTMLButtonElement>, asset: PartAsset, colorPolicy: PartColorPolicy) => {
    event.stopPropagation()
    setSelectionOptions((current) => ({
      ...current,
      [asset.categoryId]: { ...current[asset.categoryId], colorPolicy },
    }))
  }

  const setCustomColorFromHex = (value: string) => {
    const normalized = normalizeHexColor(value)
    setCustomPaintHex(normalized || value.toUpperCase())
    if (normalized) setCustomPaintRgb(rgbStringsFromHex(normalized))
  }

  const setCustomRgbChannel = (channel: keyof CustomRgb, value: string) => {
    const clean = value.replace(/[^\d]/g, "").slice(0, 3)
    const next = { ...customPaintRgb, [channel]: clean }
    setCustomPaintRgb(next)
    const hex = rgbHexFromStrings(next)
    if (hex) setCustomPaintHex(hex)
  }

  const setGradientColor = (slot: "from" | "to", value: string) => {
    const normalized = normalizeHexColor(value)
    const next = normalized || value.toUpperCase()
    if (slot === "from") setGradientFromHex(next)
    else setGradientToHex(next)
  }

  const setGradientRgbChannel = (slot: "from" | "to", channel: keyof CustomRgb, value: string) => {
    const clean = value.replace(/[^\d]/g, "").slice(0, 3)
    const currentHex = slot === "from" ? gradientFrom : gradientTo
    const nextRgb = { ...rgbStringsFromHex(currentHex), [channel]: clean }
    const nextHex = rgbHexFromStrings(nextRgb)
    if (nextHex) setGradientColor(slot, nextHex)
  }

  const applyCustomPaint = () => {
    if (!customPaintOption) return
    setActiveCustomPaintHex(customPaintOption.hex)
    setPaintId("custom")
    setPaintFinishEffect(draftPaintFinishEffect === "gradient" ? "gloss" : draftPaintFinishEffect)
  }

  const applyGradientPaint = () => {
    if (!gradientPaintValid) return
    setActiveGradientFromHex(gradientFrom)
    setActiveGradientToHex(gradientTo)
    setPaintFinishEffect("gradient")
    setDraftPaintFinishEffect("gradient")
  }

  const selectPaintFinishEffect = (effect: PaintFinishEffect) => {
    setDraftPaintFinishEffect(effect)
    setCustomColorOpen(true)
  }

  const setCustomSvFromPointer = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    const saturation = clampNumber(((event.clientX - rect.left) / rect.width) * 100, 0, 100)
    const value = clampNumber(100 - ((event.clientY - rect.top) / rect.height) * 100, 0, 100)
    setCustomColorFromHex(hexFromHsv({ ...customPickerHsv, s: saturation, v: value }))
  }

  const setCustomHue = (value: string) => {
    setCustomColorFromHex(hexFromHsv({ ...customPickerHsv, h: clampNumber(Number(value), 0, 360) }))
  }

  const revealAsset = (asset: PartAsset) => {
    setPartsOpen(true)
    setExpandedCategory(asset.categoryId)
    setBrandFilters((current) => ({ ...current, [asset.categoryId]: asset.brandId }))
    setFocusedAssetId(asset.id)
    setAssetSearch("")
    let didScroll = false
    ;[120, 520, 760].forEach((delay) => {
      window.setTimeout(() => {
        if (didScroll) return
        didScroll = scrollToAssetCard(asset.id, assetRefs.current[asset.id])
      }, delay)
    })
    window.setTimeout(() => setFocusedAssetId(""), 1800)
  }

  const generate = async () => {
    if (!authUser) {
      setAuthOpen(true)
      return
    }
    if (!catalog || !vehicleFile) {
      setNotice(t.missingVehicle)
      return
    }
    if (!hasConfigChange) {
      setNotice(t.emptyConfig)
      return
    }
    const generationStartedAt = Date.now()
    setIsGenerating(true)
    setGenerationProgress(null)
    setGenerationDurationSeconds(null)
    setNotice("")
    setJob(null)
    setViewMode("original")
    try {
      const formData = new FormData()
      formData.append("vehicleImage", vehicleFile)
      formData.append("vehicleNote", vehicleNoteEdited ? vehicleNote.trim() : "")
      formData.append("paintId", paintId)
      formData.append("paintFinishEffect", paintFinishEffect)
      if (isGradientPaint) {
        formData.append("gradientPaintJson", JSON.stringify({ fromHex: activeGradientFrom, toHex: activeGradientTo, direction: "front_to_rear" }))
      }
      if (!isGradientPaint && paintId === "custom" && selectedPaint?.id === "custom") {
        formData.append("customPaintJson", JSON.stringify({ label: selectedPaint.label, hex: selectedPaint.hex, rgb: rgbTextFromHex(selectedPaint.hex) }))
      }
      formData.append("stance", String(stance))
      formData.append("selections", JSON.stringify(selections))
      formData.append("selectionOptions", JSON.stringify(selectionOptions))
      formData.append("responseLanguage", language)
      formData.append("streamProgress", "1")
      const response = await fetch("/api/generations", { method: "POST", body: formData })
      const result = await readProgressResponse(response, setGenerationProgress)
      if (!result.ok) {
        const body = result.body
        if (result.status === 401) {
          setAuthOpen(true)
          return
        }
        if (result.status === 402) {
          setBilling(body.billing ?? billing)
          setSubscribeOpen(true)
          return
        }
        throw new Error(body.error || t.generationFailed)
      }
      const created = result.body as GenerationJob
      if (!isRenderableGeneration(created)) {
        throw new Error(created.failureReason || t.generationFailed)
      }
      const displayModel = displayVehicleNote && !isInternalVehicleModel(displayVehicleNote) ? displayVehicleNote : ""
      const createdWithDisplayModel = displayModel ? { ...created, displayVehicleModel: displayModel } : created
      if (displayModel) storeHistoryVehicleModel(created.id, displayModel)
      setGenerationDurationSeconds(Math.max(1, Math.ceil((Date.now() - generationStartedAt) / 1000)))
      setJob(createdWithDisplayModel)
      setHistory((items) => [createdWithDisplayModel, ...items].slice(0, 8))
      setViewMode("generated")
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t.generationFailed)
    } finally {
      window.setTimeout(() => setIsGenerating(false), 300)
      window.setTimeout(() => setGenerationProgress(null), 300)
    }
  }

  const saveResult = async (exportMode?: ViewMode) => {
    if (!authUser) {
      setAuthOpen(true)
      return
    }
    if (!job) return
    try {
      if (exportMode === "compare") {
        if (!vehiclePreview || !job.resultImageUrl) throw new Error(t.saveFailed)
        await downloadCompareImage(vehiclePreview, job.resultImageUrl, `ai-mod-compare-${job.id}.png`)
      } else if (exportMode === "generated" && job.resultImageUrl) {
        downloadImageAsset(job.resultImageUrl, `ai-mod-result-${job.id}${imageExtensionFromUrl(job.resultImageUrl)}`)
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t.saveFailed)
      return
    }
    const response = await fetch("/api/garage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ generationId: job.id }),
    })
    if (response.status === 401) {
      setAuthOpen(true)
      return
    }
    setNotice(response.ok ? t.saved : t.saveFailed)
  }

  const selectHistoryJob = (historyJob: GenerationJob) => {
    if (!isRenderableGeneration(historyJob)) return
    setJob(historyJob)
    setVehiclePreview(historyJob.sourceImageUrl)
    setVehicleNote(displayVehicleModelForHistory(historyJob, ""))
    setVehicleNoteEdited(false)
    setVehicleRecognitionError("")
    setGenerationDurationSeconds(null)
    setSelectionOptions(historyJob.selectionOptions ?? {})
    setIsRecognizingVehicle(false)
    setViewMode("generated")
    setNotice("")
  }

  const clearCurrentConfig = () => {
    setVehicleFile(null)
    setVehiclePreview("")
    setVehicleNote("")
    setVehicleNoteEdited(false)
    setVehicleRecognitionError("")
    setIsRecognizingVehicle(false)
    setJob(null)
    setGenerationDurationSeconds(null)
    setSelections({})
    setSelectionOptions({})
    setPaintId("factory")
    setPaintFinishEffect("gloss")
    setGradientFromHex(defaultGradientFromHex)
    setGradientToHex(defaultGradientToHex)
    setStance(0)
    setViewMode("original")
    setIsGenerating(false)
    setGenerationElapsedSeconds(0)
    setExpandedCategory("")
    setPartsOpen(false)
    setAssetSearch("")
    setFocusedAssetId("")
    setNotice("")
    if (inputRef.current) inputRef.current.value = ""
  }

  const deleteHistoryJob = async (historyJob: GenerationJob) => {
    const response = await fetch(`/api/garage/${historyJob.id}`, { method: "DELETE" })
    if (response.status === 401) {
      setAuthOpen(true)
      return
    }
    if (!response.ok) {
      const body = await response.json().catch(() => ({}))
      setNotice(typeof body.error === "string" ? body.error : "Delete failed.")
      return
    }
    setHistory((items) => items.filter((item) => item.id !== historyJob.id))
    forgetHistoryVehicleModel(historyJob.id)
    if (job?.id === historyJob.id) {
      setJob(null)
      setViewMode(vehiclePreview ? "original" : "generated")
    }
    setNotice("")
  }

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    setAuthUser(null)
    setBilling(null)
    setProfileOpen(false)
  }

  const renderGradientColorControl = (slot: "from" | "to", label: string, hex: string) => {
    const normalizedHex = normalizeHexColor(hex)
    const displayHex = normalizedHex || (slot === "from" ? defaultGradientFromHex : defaultGradientToHex)
    const rgb = rgbStringsFromHex(displayHex)
    return (
      <div className="gradient-color-control">
        <div className="gradient-color-control-head">
          <span>{label}</span>
          <input
            type="color"
            value={displayHex}
            tabIndex={customColorOpen && isGradientPaint ? 0 : -1}
            aria-label={label}
            onChange={(event) => setGradientColor(slot, event.target.value)}
          />
        </div>
        <label className="custom-color-field">
          <span>HEX</span>
          <input value={hex} tabIndex={customColorOpen && isGradientPaint ? 0 : -1} onChange={(event) => setGradientColor(slot, event.target.value)} spellCheck={false} />
        </label>
        <div className="gradient-rgb-fields" aria-label={`${label} RGB`}>
          {(["r", "g", "b"] as const).map((channel) => (
            <label key={channel} className="custom-color-field">
              <span>{channel.toUpperCase()}</span>
              <input
                inputMode="numeric"
                value={rgb[channel]}
                tabIndex={customColorOpen && isGradientPaint ? 0 : -1}
                onChange={(event) => setGradientRgbChannel(slot, channel, event.target.value)}
              />
            </label>
          ))}
        </div>
      </div>
    )
  }

  if (!viewportReady) {
    return <ResponsiveStudioLoading language={language} text={t.loading} />
  }

  if (!catalog) {
    if (isMobileViewport) {
      return <MobileLoadingScreen language={language} />
    }

    return (
      <main className="app-shell loading-shell">
        <div className="loading-mark">
          <Sparkles />
          <span>{t.loading}</span>
        </div>
      </main>
    )
  }

  if (isMobileViewport) {
    return (
      <MobileStudioApp
        language={language}
        t={t}
        appMode={appMode}
        setAppMode={setAppMode}
        mobileTheme={mobileTheme}
        toggleMobileTheme={toggleMobileTheme}
        toggleLanguage={toggleLanguage}
        catalog={catalog}
        categories={categories}
        inputRef={inputRef}
        onFile={onFile}
        vehiclePreview={vehiclePreview}
        vehicleNote={vehicleNote}
        setVehicleNote={setVehicleNote}
        setVehicleNoteEdited={setVehicleNoteEdited}
        vehicleDisplayName={vehicleDisplayName}
        vehicleRecognitionError={vehicleRecognitionError}
        selectedAssets={selectedAssets}
        selections={selections}
        selectAsset={selectAsset}
        brandFilters={brandFilters}
        setBrandFilters={setBrandFilters}
        assetSearch={assetSearch}
        setAssetSearch={setAssetSearch}
        assetSuggestions={assetSuggestions}
        revealAsset={revealAsset}
        expandedCategory={expandedCategory}
        setExpandedCategory={setExpandedCategory}
        focusedAssetId={focusedAssetId}
        paintId={paintId}
        setPaintId={setPaintId}
        setPaintFinishEffect={setPaintFinishEffect}
        setDraftPaintFinishEffect={setDraftPaintFinishEffect}
        selectedPaintLabel={selectedPaintLabel}
        customColorOpen={customColorOpen}
        setCustomColorOpen={setCustomColorOpen}
        customPaintHex={customPaintHex}
        customPaintRgb={customPaintRgb}
        customPaintPreviewHex={customPaintPreviewHex}
        setCustomColorFromHex={setCustomColorFromHex}
        setCustomRgbChannel={setCustomRgbChannel}
        applyCustomPaint={applyCustomPaint}
        customPaintApplied={customPaintApplied}
        customPickerHsv={customPickerHsv}
        setCustomSvFromPointer={setCustomSvFromPointer}
        setCustomHue={setCustomHue}
        gradientFromHex={gradientFromHex}
        gradientToHex={gradientToHex}
        gradientFrom={gradientFrom}
        gradientTo={gradientTo}
        gradientPaintValid={gradientPaintValid}
        setGradientColor={setGradientColor}
        setGradientRgbChannel={setGradientRgbChannel}
        applyGradientPaint={applyGradientPaint}
        gradientPaintApplied={gradientPaintApplied}
        selectPaintFinishEffect={selectPaintFinishEffect}
        draftPaintFinishEffect={draftPaintFinishEffect}
        colorPolicyAssets={colorPolicyAssets}
        selectAssetColorPolicy={selectAssetColorPolicy}
        stance={stance}
        setStance={setStance}
        stanceName={stanceName}
        stancePresets={stancePresets}
        viewMode={viewMode}
        setViewMode={setViewMode}
        job={job}
        history={history}
        selectHistoryJob={selectHistoryJob}
        deleteHistoryJob={deleteHistoryJob}
        isGenerating={isGenerating}
        generationElapsedSeconds={generationElapsedSeconds}
        generationDurationSeconds={generationDurationSeconds}
        generationProgress={generationProgress}
        setIsGenerating={setIsGenerating}
        canGenerate={canGenerate}
        generate={generate}
        saveResult={saveResult}
        clearCurrentConfig={clearCurrentConfig}
        notice={notice}
        authUser={authUser}
        billing={billing}
        authOpen={authOpen}
        setAuthOpen={setAuthOpen}
        subscribeOpen={subscribeOpen}
        setSubscribeOpen={setSubscribeOpen}
        onAuthed={({ user, billing: nextBilling }) => {
          setAuthUser(user)
          setBilling(nextBilling)
          setAuthOpen(false)
        }}
        onBillingUpdated={(nextBilling) => {
          setBilling(nextBilling)
          setSubscribeOpen(false)
        }}
        onBillingChanged={setBilling}
        logout={logout}
      />
    )
  }

  return (
    <main
      className={shellMode === "chat" ? "app-shell chat-active-shell" : "app-shell"}
      data-lang={language}
      data-mobile-theme={mobileTheme}
      data-mobile-sheet={mobileControlSheet ?? ""}
    >
      <div className={shellMode === "chat" ? "studio-card chat-card" : "studio-card"}>
        <header className="studio-header">
          <h1>{t.title}</h1>
          <ModeSwitch mode={appMode} setMode={setAppMode} labels={{ config: t.configMode, chat: t.chatMode }} />
          <div className="studio-header-actions" data-auth={authUser ? "authed" : "guest"} data-role={authUser?.role ?? "guest"}>
            <button className="language-toggle" data-lang={language} onClick={toggleLanguage}>
              <Languages size={15} />
              {language === "en" ? "EN" : "中"}
            </button>
            <button className="mobile-theme-toggle" data-theme={mobileTheme} onClick={toggleMobileTheme} aria-label={mobileTheme === "dark" ? "Switch to light theme" : "Switch to dark theme"}>
              {mobileTheme === "dark" ? <Moon size={15} /> : <Sun size={15} />}
              {mobileTheme === "dark" ? "\u6697" : "\u4eae"}
            </button>
            {authUser ? (
              <>
                <button className="admin-link" onClick={() => setSubscribeOpen(true)}>
                  <BadgeCheck size={15} />
                  {t.member}
                </button>
                {authUser.role === "admin" && (
                  <a className="admin-link desktop-admin-link" href="/admin">
                    <KeyRound size={15} />
                    {t.admin}
                  </a>
                )}
                <button className="admin-link" onClick={() => setProfileOpen(true)}>
                  <UserRound size={15} />
                  {language === "zh" ? "\u4e2a\u4eba\u4e2d\u5fc3" : "Profile"}
                </button>
              </>
            ) : (
              <button className="admin-link" onClick={() => setAuthOpen(true)}>
                <KeyRound size={15} />
                {t.login}
              </button>
            )}
          </div>
        </header>

        <AnimatePresence mode="wait" initial={false} onExitComplete={() => setShellMode(appMode)}>
          {appMode === "config" ? (
            <motion.div
              key="config"
              className="workspace-grid"
              initial={{ opacity: 0, x: -42, scale: 0.985 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: -42, scale: 0.985 }}
              transition={{ type: "spring", stiffness: 260, damping: 28 }}
            >
              <section className="input-column">
                <section className="detected-vehicle-card">
                  <label htmlFor="vehicle-model-input">{t.detected}</label>
                  <input
                    id="vehicle-model-input"
                    className="vehicle-model-input"
                    value={vehicleNote}
                    onChange={(event) => {
                      setVehicleNote(event.target.value)
                      setVehicleNoteEdited(true)
                    }}
                    placeholder={vehicleDisplayName}
                    disabled={!vehiclePreview && !vehicleNote}
                    autoComplete="off"
                    spellCheck={false}
                    aria-label={t.detected}
                  />
                  {vehicleRecognitionError ? (
                    <small className="vehicle-recognition-error">{vehicleRecognitionError}</small>
                  ) : null}
                </section>

                <section className="images-block">
                  <div className="block-title">
                    <span>{t.images}</span>
                    <button type="button" className="clear-config-button" onClick={clearCurrentConfig}>
                      <X size={14} />
                      {language === "en" ? "Clear" : "清空"}
                    </button>
                  </div>

                  <div className="upload-grid">
                    <button
                      type="button"
                      className={vehiclePreview ? "upload-tile has-preview" : "upload-tile"}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault()
                        onFile(event.dataTransfer.files[0])
                      }}
                      onClick={() => inputRef.current?.click()}
                    >
                      <input
                        ref={inputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(event) => {
                          onFile(event.target.files?.[0])
                          event.currentTarget.value = ""
                        }}
                      />
                      {vehiclePreview ? (
                        <img src={vehiclePreview} alt="Vehicle preview" />
                      ) : (
                        <>
                          <Upload size={25} />
                          <span>{t.upload}</span>
                        </>
                      )}
                    </button>
                  </div>

                  <div className="parts-selector-block">
                    <button type="button" className={partsOpen ? "upload-tile summary-tile open" : "upload-tile summary-tile"} onClick={() => setPartsOpen((value) => !value)} aria-expanded={partsOpen}>
                      <SlidersHorizontal size={24} />
                      <span>{selectedAssets.length}</span>
                      <small>{selectedAssets.length === 1 ? t.partSelected : t.partsSelected}</small>
                      <ChevronDown className="summary-chevron" size={16} />
                    </button>

                    <AnimatePresence initial={false}>
                      {partsOpen && (
                        <motion.section
                          key="parts-dropdown"
                          className="parts-dropdown open"
                          aria-label="Part library"
                          initial={{ height: 0, opacity: 0, y: -8 }}
                          animate={{ height: "auto", opacity: 1, y: 0 }}
                          exit={{ height: 0, opacity: 0, y: -8 }}
                          transition={{ type: "spring", stiffness: 260, damping: 30, mass: 0.7 }}
                        >
                          <div className="parts-dropdown-inner" ref={partsDropdownRef}>
                            <label className="parts-search">
                              <SlidersHorizontal size={15} />
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
                                const search = assetSearch.trim().toLowerCase()
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

                                    <div className="accordion-content">
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
                                                <div key={asset.id} className="asset-option">
                                                  <button
                                                    ref={(node) => {
                                                      assetRefs.current[asset.id] = node
                                                    }}
                                                    data-asset-id={asset.id}
                                                    className={`${isAssetSelected ? "asset-card selected" : "asset-card"} ${focusedAssetId === asset.id ? "spotlight" : ""}`.trim()}
                                                    onClick={() => selectAsset(asset)}
                                                  >
                                                    <AssetImage asset={asset} />
                                                    <strong>
                                                      {asset.brand} {asset.model}
                                                    </strong>
                                                    <span>{asset.variant}</span>
                                                    <small>{asset.finish}</small>
                                                  </button>
                                                </div>
                                              )
                                            })}
                                          </div>
                                        ) : (
                                          <div className="empty-category">{t.emptyCategory}</div>
                                        )}
                                      </div>
                                    </div>
                                  </article>
                                )
                              })}
                            </section>
                          </div>
                        </motion.section>
                      )}
                    </AnimatePresence>
                  </div>
                </section>

                <section className="option-card color-card">
                  <div className="color-card-heading">
                    <div>
                      <h2>
                        {leadWithColon(t.colorsLead, language)} <span>{t.colorsText}</span>
                      </h2>
                      <p>
                        {t.colorShown}: {selectedPaintLabel}
                      </p>
                    </div>
                    <button
                      type="button"
                      className={`palette-toggle${customColorOpen ? " active" : ""}`}
                      aria-label={language === "zh" ? "自定义颜色" : "Custom color"}
                      title={language === "zh" ? "自定义颜色" : "Custom color"}
                      onClick={() => {
                        setCustomColorOpen((open) => {
                          if (!open) setDraftPaintFinishEffect(paintFinishEffect)
                          return !open
                        })
                      }}
                    >
                      <Palette size={18} />
                    </button>
                  </div>
                  <div className="color-dots compact">
                    {catalog.paints.map((paint) => (
                      <button
                        key={paint.id}
                        className={`${paint.id === paintId ? "selected" : ""} ${paint.id === "factory" ? "factory-paint-swatch" : ""}`.trim()}
                        style={{ backgroundColor: paint.hex }}
                        title={studioPaintCopy[language][paint.id] ?? paint.label}
                        onClick={() => {
                          setPaintId(paint.id)
                          setPaintFinishEffect("gloss")
                          setDraftPaintFinishEffect("gloss")
                          setCustomColorOpen(false)
                        }}
                      />
                    ))}
                  </div>
                  <div className={`custom-color-panel${customColorOpen ? " open" : ""}`} aria-hidden={!customColorOpen}>
                    <div className="custom-color-panel-inner">
                      <div className="paint-finish-panel">
                        <div className="paint-finish-label">{language === "zh" ? "车漆效果" : "Paint effect"}</div>
                        <div className="paint-finish-options" role="group" aria-label={language === "zh" ? "车漆效果" : "Paint effect"}>
                          {paintFinishEffects.map((effect) => (
                            <button
                              key={effect}
                              type="button"
                              className={draftPaintFinishEffect === effect ? "selected" : ""}
                              aria-pressed={draftPaintFinishEffect === effect}
                              tabIndex={customColorOpen ? 0 : -1}
                              onClick={() => selectPaintFinishEffect(effect)}
                            >
                              {paintFinishCopy[language][effect]}
                            </button>
                          ))}
                        </div>
                      </div>
                      <AnimatePresence initial={false}>
                        {!isGradientEditorOpen && (
                          <motion.div
                            className="single-color-editor"
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ height: { duration: 0.22, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.16, ease: "easeOut" } }}
                            style={{ overflow: "hidden" }}
                          >
                        <div className="custom-color-grid">
                          <label className="custom-color-native">
                            <span>{language === "zh" ? "取色" : "Pick"}</span>
                            <span className="custom-color-preview-swatch" style={{ "--custom-paint": customPaintPreviewHex } as CSSProperties} />
                          </label>
                          <label className="custom-color-field custom-color-hex">
                            <span>HEX</span>
                            <input
                              value={customPaintHex}
                              tabIndex={customColorOpen ? 0 : -1}
                              onChange={(event) => setCustomColorFromHex(event.target.value)}
                              spellCheck={false}
                            />
                          </label>
                          <div className="custom-rgb-fields" aria-label="RGB">
                            {(["r", "g", "b"] as const).map((channel) => (
                              <label key={channel} className="custom-color-field">
                                <span>{channel.toUpperCase()}</span>
                                <input
                                  inputMode="numeric"
                                  value={customPaintRgb[channel]}
                                  tabIndex={customColorOpen ? 0 : -1}
                                  onChange={(event) => setCustomRgbChannel(channel, event.target.value)}
                                />
                              </label>
                            ))}
                          </div>
                        </div>
                        <div
                          className="custom-picker-popover"
                          style={{
                            "--custom-paint": customPaintPreviewHex,
                            "--picker-hue": customPickerHsv.h,
                            "--picker-s": customPickerHsv.s,
                            "--picker-v": customPickerHsv.v,
                          } as CSSProperties}
                        >
                          <button
                            type="button"
                            className="custom-picker-map"
                            tabIndex={customColorOpen ? 0 : -1}
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
                            <input
                              className="custom-hue-slider"
                              type="range"
                              min={0}
                              max={360}
                              value={Math.round(customPickerHsv.h)}
                              tabIndex={customColorOpen ? 0 : -1}
                              aria-label={language === "zh" ? "色相" : "Hue"}
                              onChange={(event) => setCustomHue(event.target.value)}
                            />
                            <button
                              type="button"
                              className={`custom-color-apply-small${customPaintApplied ? " applied" : ""}`}
                              disabled={!customPaintOption}
                              aria-pressed={customPaintApplied}
                              tabIndex={customColorOpen ? 0 : -1}
                              onClick={applyCustomPaint}
                            >
                              {customPaintApplied ? (language === "zh" ? "已应用" : "Applied") : language === "zh" ? "应用" : "Apply"}
                            </button>
                          </div>
                        </div>
                        <div className="custom-color-swatches" aria-label={language === "zh" ? "常用自定义颜色" : "Common custom colors"}>
                          {customPaintSwatches.map((hex) => (
                            <button
                              key={hex}
                              type="button"
                              className={normalizeHexColor(customPaintHex) === hex ? "selected" : ""}
                              style={{ backgroundColor: hex }}
                              title={hex}
                              tabIndex={customColorOpen ? 0 : -1}
                              onClick={() => {
                                setCustomColorFromHex(hex)
                              }}
                            />
                          ))}
                        </div>
                        <div className="custom-color-footer">
                          <span className="custom-color-preview-stack">
                            <span className="custom-color-preview" style={{ "--custom-paint": customPaintPreviewHex } as CSSProperties}>
                              {language === "zh" ? "预览色" : "Preview color"}
                            </span>
                            <span className={`custom-color-value${customPaintOption ? "" : " invalid"}`}>
                              {customPaintOption
                                  ? `${customPaintOption.label} / RGB(${rgbTextFromHex(customPaintOption.hex)})`
                                  : language === "zh"
                                    ? "颜色格式无效"
                                    : "Invalid color"}
                            </span>
                          </span>
                        </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                        <AnimatePresence initial={false}>
                          {isGradientEditorOpen && (
                            <motion.div
                              className="gradient-paint-panel"
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ height: { duration: 0.22, ease: [0.22, 1, 0.36, 1] }, opacity: { duration: 0.16, ease: "easeOut" } }}
                              style={{ overflow: "hidden" }}
                            >
                              <div className="gradient-preview" style={{ "--gradient-from": gradientFrom, "--gradient-to": gradientTo } as CSSProperties} />
                              <div className="gradient-color-grid">
                                {renderGradientColorControl("from", language === "zh" ? "起始色" : "Start color", gradientFromHex)}
                                {renderGradientColorControl("to", language === "zh" ? "结束色" : "End color", gradientToHex)}
                              </div>
                              <div className="gradient-color-actions">
                                <button
                                  type="button"
                                  className={`custom-color-apply-small${gradientPaintApplied ? " applied" : ""}`}
                                  disabled={!gradientPaintValid}
                                  aria-pressed={gradientPaintApplied}
                                  tabIndex={customColorOpen ? 0 : -1}
                                  onClick={applyGradientPaint}
                                >
                                  {gradientPaintApplied ? (language === "zh" ? "已应用" : "Applied") : language === "zh" ? "应用" : "Apply"}
                                </button>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                </section>

                <AnimatePresence initial={false}>
                  {colorPolicyAssets.map(({ asset, policies, selected }) => {
                    const copy = partColorPolicyCopy[language][asset.categoryId] ?? partColorPolicyCopy.en.hood
                    const hoodColorPolicyCopy = { [language]: copy } as Record<Language, typeof copy>
                    const hoodColorPolicies = policies
                    const selectedHoodColorPolicy = selected
                    const selectedHoodAsset = asset
                    return (
                    <motion.div
                      key={`part-color-policy-${asset.categoryId}`}
                      className="part-color-policy-motion"
                      initial={{ height: 0, opacity: 0, marginBottom: -12 }}
                      animate={{ height: 64, opacity: 1, marginBottom: 0 }}
                      exit={{ height: 0, opacity: 0, marginBottom: -12 }}
                      style={{ overflow: "hidden" }}
                      transition={{
                        height: { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
                        marginBottom: { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
                        opacity: { duration: 0.12, ease: "easeOut" },
                      }}
                    >
                      <section className="option-card hood-color-policy-card part-color-policy-card">
                      <h2>{hoodColorPolicyCopy[language].label}{language === "zh" ? "：" : ":"}</h2>
                      <div className="color-policy-segment" role="group" aria-label={hoodColorPolicyCopy[language].label}>
                        {hoodColorPolicies.map((colorPolicy) => {
                          const policyLabel = hoodColorPolicyCopy[language].options[colorPolicy] ?? colorPolicyDisplayLabels[colorPolicy]?.[language] ?? colorPolicy
                          const isSelectedPolicy = selectedHoodColorPolicy === colorPolicy

                          return (
                            <button
                              key={colorPolicy}
                              type="button"
                              className={`color-policy-button${isSelectedPolicy ? " selected" : ""}`}
                              aria-label={policyLabel}
                              aria-pressed={isSelectedPolicy}
                              onClick={(event) => selectAssetColorPolicy(event, selectedHoodAsset, colorPolicy)}
                            >
                              <span className="color-policy-copy">{policyLabel}</span>
                              {isSelectedPolicy && <span className="color-policy-check" aria-hidden="true" />}
                            </button>
                          )
                        })}
                      </div>
                      </section>
                    </motion.div>
                    )
                  })}
                </AnimatePresence>

                <section className="option-card stance-card">
                  <h2>
                    {leadWithColon(t.stanceLead, language)} <span>{t.stanceText}</span>
                  </h2>
                  <p>
                    {language === "zh" ? "当前高度" : "Current height"}: {stanceName}
                  </p>
                  <div className="stance-preset-options" role="group" aria-label={language === "zh" ? "车身高度" : "Ride height"}>
                    {stancePresets.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        className={`stance-preset-button${stance === preset.value ? " selected" : ""}`}
                        aria-pressed={stance === preset.value}
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

                <button className="run-button" onClick={generate} disabled={!canGenerate}>
                  {isGenerating ? <CircleStop size={18} /> : <Wand2 size={18} />}
                  {isGenerating ? t.running : t.run}
                </button>
                {isGenerating && (
                  <div className="config-generating-status">
                    <strong>{generationStatusText}</strong>
                    <span>{generationStatusElapsedText}{generationStatusRetryText}</span>
                  </div>
                )}
                {notice && <div className="notice">{notice}</div>}
              </section>

              <section className="result-column">
                <ResultPanel
                  t={t}
                  language={language}
                  viewMode={viewMode}
                  setViewMode={setViewMode}
                  vehiclePreview={vehiclePreview}
                  job={job}
                  isGenerating={isGenerating}
                  elapsedSeconds={generationElapsedSeconds}
                  completedElapsedSeconds={generationDurationSeconds}
                  generationProgress={generationProgress}
                  setIsGenerating={setIsGenerating}
                  selectedPaint={selectedPaint}
                  paintPreviewBackground={paintPreviewBackground}
                  stance={stance}
                  selectedAssets={selectedAssets}
                  generate={generate}
                  canGenerate={canGenerate}
                  saveResult={saveResult}
                  selectedPaintLabel={selectedPaintLabel}
                  vehicleNote={vehicleDisplayName}
                  history={history}
                  onHistorySelect={selectHistoryJob}
                  onHistoryDelete={deleteHistoryJob}
                />
              </section>

              <AnimatePresence initial={false}>
                {mobileControlSheet && (
                  <>
                    <motion.button
                      key="mobile-config-sheet-backdrop"
                      type="button"
                      className="mobile-config-sheet-backdrop"
                      aria-label="Close controls"
                      onClick={() => setMobileControlSheet(null)}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    />
                    <motion.div
                      key="mobile-config-sheet-toolbar"
                      className="mobile-config-sheet-toolbar"
                      initial={{ opacity: 0, y: 18 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 18 }}
                      transition={{ type: "spring", stiffness: 280, damping: 30 }}
                    >
                      <strong>
                        {mobileControlSheet === "parts"
                          ? language === "zh"
                            ? "\u914d\u4ef6\u9009\u62e9"
                            : "Parts"
                          : mobileControlSheet === "paint"
                            ? language === "zh"
                              ? "\u8f66\u8eab\u989c\u8272"
                              : "Paint"
                            : language === "zh"
                              ? "\u8f66\u8eab\u9ad8\u5ea6"
                              : "Ride height"}
                      </strong>
                      <button type="button" onClick={() => setMobileControlSheet(null)} aria-label="Close controls">
                        <X size={18} />
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>

              <section className="mobile-config-panel" aria-label="Mobile configuration">
                <div className="mobile-config-status-card">
                  <button
                    type="button"
                    className={vehiclePreview ? "mobile-upload-preview has-preview" : "mobile-upload-preview"}
                    onClick={() => inputRef.current?.click()}
                  >
                    {vehiclePreview ? <img src={vehiclePreview} alt="Vehicle preview" /> : <Upload size={22} />}
                  </button>
                  <label className="mobile-vehicle-model" htmlFor="vehicle-model-mobile-input">
                    <span>{t.detected}</span>
                    <input
                      id="vehicle-model-mobile-input"
                      value={vehicleNote}
                      onChange={(event) => {
                        setVehicleNote(event.target.value)
                        setVehicleNoteEdited(true)
                      }}
                      placeholder={vehicleDisplayName}
                      disabled={!vehiclePreview && !vehicleNote}
                      autoComplete="off"
                      spellCheck={false}
                    />
                  </label>
                  <button type="button" className="mobile-clear-config" onClick={clearCurrentConfig} aria-label={language === "zh" ? "\u6e05\u7a7a" : "Clear"}>
                    <X size={16} />
                  </button>
                </div>

                <div className="mobile-selected-summary">
                  <Layers3 size={17} />
                  <span>{selectedAssets.length ? `${selectedAssets.length} ${selectedAssets.length === 1 ? t.partSelected : t.partsSelected}` : t.noParts}</span>
                  <strong>{selectedPaintLabel}</strong>
                </div>

                {isGenerating && (
                  <div className="config-generating-status mobile-generating-status">
                    <strong>{generationStatusText}</strong>
                    <span>{generationStatusElapsedText}{generationStatusRetryText}</span>
                  </div>
                )}
                {notice && <div className="notice mobile-notice">{notice}</div>}

                <nav className="mobile-control-dock" aria-label="Mobile edit controls">
                  <button
                    type="button"
                    className={mobileControlSheet === "parts" ? "selected" : ""}
                    onClick={() => {
                      setMobileControlSheet("parts")
                      setPartsOpen(true)
                    }}
                  >
                    <SlidersHorizontal size={18} />
                    <span>{language === "zh" ? "\u914d\u4ef6" : "Parts"}</span>
                  </button>
                  <button
                    type="button"
                    className={mobileControlSheet === "paint" ? "selected" : ""}
                    onClick={() => {
                      setDraftPaintFinishEffect(paintFinishEffect)
                      setMobileControlSheet("paint")
                    }}
                  >
                    <Palette size={18} />
                    <span>{language === "zh" ? "\u989c\u8272" : "Paint"}</span>
                  </button>
                  <button
                    type="button"
                    className={mobileControlSheet === "stance" ? "selected" : ""}
                    onClick={() => setMobileControlSheet("stance")}
                  >
                    <SlidersHorizontal size={18} />
                    <span>{language === "zh" ? "\u9ad8\u5ea6" : "Height"}</span>
                  </button>
                  <button type="button" className="mobile-generate-button" onClick={generate} disabled={!canGenerate}>
                    {isGenerating ? <CircleStop size={18} /> : <Wand2 size={18} />}
                    <span>{isGenerating ? t.running : t.run}</span>
                  </button>
                </nav>
              </section>
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              className="chat-motion-frame"
              initial={{ opacity: 0, x: 58, scale: 0.985 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 58, scale: 0.985 }}
              transition={{ type: "spring", stiffness: 260, damping: 28 }}
            >
              <ChatMode
                language={language}
                authUser={authUser}
                onAuthRequired={() => setAuthOpen(true)}
                onSubscribeRequired={(nextBilling) => {
                  if (nextBilling) setBilling(nextBilling)
                  setSubscribeOpen(true)
                }}
                onBillingChanged={setBilling}
              />
            </motion.div>
          )}
        </AnimatePresence>
        <AuthModal
          open={authOpen}
          language={language}
          mobileTheme={mobileTheme}
          onClose={() => setAuthOpen(false)}
          onAuthed={({ user, billing: nextBilling }) => {
            setAuthUser(user)
            setBilling(nextBilling)
            setAuthOpen(false)
          }}
        />
        <DesktopAccountPanel
          open={profileOpen}
          language={language}
          authUser={authUser}
          billing={billing}
          onClose={() => setProfileOpen(false)}
          onAuth={() => {
            setProfileOpen(false)
            setAuthOpen(true)
          }}
          onSubscribe={() => {
            setProfileOpen(false)
            setSubscribeOpen(true)
          }}
          onAccountUpdated={({ user, billing: nextBilling }) => {
            setAuthUser(user)
            setBilling(nextBilling)
          }}
          onLogout={logout}
        />
        <SubscribeModal
          open={subscribeOpen}
          language={language}
          mobileTheme={mobileTheme}
          billing={billing}
          onClose={() => setSubscribeOpen(false)}
          onUpdated={(nextBilling) => {
            setBilling(nextBilling)
            setSubscribeOpen(false)
          }}
        />
      </div>
    </main>
  )
}

type AccountPanelMode = "overview" | "profile" | "password" | "phone"

function DesktopAccountPanel({
  open,
  language,
  authUser,
  billing,
  onClose,
  onAuth,
  onSubscribe,
  onAccountUpdated,
  onLogout,
}: {
  open: boolean
  language: Language
  authUser: AuthUser | null
  billing: EntitlementStatus | null
  onClose: () => void
  onAuth: () => void
  onSubscribe: () => void
  onAccountUpdated: (payload: AccountPayload) => void
  onLogout: () => Promise<void>
}) {
  const isZh = language === "zh"
  const [mode, setMode] = useState<AccountPanelMode>("overview")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [currentPassword, setCurrentPassword] = useState("")
  const [nextPassword, setNextPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [phone, setPhone] = useState("")
  const [phoneCode, setPhoneCode] = useState("")
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setMode("overview")
    setName(authUser?.name || authUser?.username || "")
    setEmail(authUser?.email || "")
    setPhone(authUser?.phone || "")
    setCurrentPassword("")
    setNextPassword("")
    setConfirmPassword("")
    setPhoneCode("")
    setNotice("")
    setError("")
    setLoading(false)
  }, [authUser, open])

  const copy = {
    title: isZh ? "个人中心" : "Profile",
    subtitle: isZh ? "管理账号、会员和额度" : "Manage account, membership and quota",
    signIn: isZh ? "登录账号" : "Sign in",
    plan: isZh ? "当前会员" : "Current plan",
    configQuota: isZh ? "配置额度" : "Config quota",
    chatQuota: isZh ? "对话额度" : "Chat quota",
    used: isZh ? "已用" : "used",
    unlimited: isZh ? "不限" : "Unlimited",
    upgrade: isZh ? "升级会员" : "Upgrade",
    profile: isZh ? "资料" : "Profile",
    password: isZh ? "密码" : "Password",
    phone: isZh ? "手机号" : "Phone",
    save: isZh ? "保存" : "Save",
    sendCode: isZh ? "发送验证码" : "Send code",
    changePhone: isZh ? "确认换绑" : "Update phone",
    logout: isZh ? "退出登录" : "Sign out",
    done: isZh ? "已保存" : "Saved",
    passwordDone: isZh ? "密码已修改" : "Password updated",
    phoneDone: isZh ? "手机号已更新" : "Phone updated",
    codeSent: isZh ? "验证码已发送" : "Code sent",
    mismatch: isZh ? "两次输入的新密码不一致。" : "The new passwords do not match.",
  }

  const displayName = authUser?.name || authUser?.username || copy.signIn
  const planName = billing?.plan.label || authUser?.plan || "--"
  const configRemaining = formatAccountQuota(billing?.configRemaining, copy.unlimited)
  const chatRemaining = formatAccountQuota(billing?.chatRemainingToday, copy.unlimited)
  const subscriptionEnd = billing?.subscription?.currentPeriodEnd
    ? new Date(billing.subscription.currentPeriodEnd).toLocaleDateString(isZh ? "zh-CN" : "en-US")
    : isZh ? "未订阅" : "No active subscription"

  const runAccountAction = async (action: () => Promise<void>) => {
    setLoading(true)
    setNotice("")
    setError("")
    try {
      await action()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : isZh ? "操作失败。" : "Action failed.")
    } finally {
      setLoading(false)
    }
  }

  const saveProfile = () => runAccountAction(async () => {
    const payload = await updateAccountProfile({ name, email })
    onAccountUpdated(payload)
    setNotice(copy.done)
  })

  const savePassword = () => runAccountAction(async () => {
    if (nextPassword !== confirmPassword) {
      setError(copy.mismatch)
      return
    }
    const payload = await changeAccountPassword({ currentPassword, nextPassword })
    onAccountUpdated(payload)
    setCurrentPassword("")
    setNextPassword("")
    setConfirmPassword("")
    setNotice(copy.passwordDone)
  })

  const sendCode = () => runAccountAction(async () => {
    const result = await sendPhoneChangeCode(phone)
    setNotice(result.mockCode ? `${copy.codeSent}: ${result.mockCode}` : copy.codeSent)
  })

  const savePhone = () => runAccountAction(async () => {
    const payload = await changeAccountPhone({ phone, code: phoneCode })
    onAccountUpdated(payload)
    setPhone(payload.user.phone)
    setPhoneCode("")
    setNotice(copy.phoneDone)
  })


  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="account-panel-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.section
            className="account-panel"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.98 }}
            transition={{ duration: 0.22 }}
            onClick={(event) => event.stopPropagation()}
            aria-label={copy.title}
          >
            <header className="account-panel-head">
              <div>
                <span>{copy.subtitle}</span>
                <h2>{copy.title}</h2>
              </div>
              <button type="button" onClick={onClose} aria-label="Close">
                <X size={18} />
              </button>
            </header>

            {authUser ? (
              <>
                <section className="account-panel-hero">
                  <div className="account-avatar">{accountInitials(authUser)}</div>
                  <div>
                    <strong>{displayName}</strong>
                    <span>{authUser.phone || authUser.email || authUser.username}</span>
                  </div>
                  <button type="button" onClick={onSubscribe}>
                    <BadgeCheck size={16} />
                    {copy.upgrade}
                  </button>
                </section>

                <section className="account-quota-grid">
                  <article>
                    <span>{copy.plan}</span>
                    <strong>{planName}</strong>
                    <small>{subscriptionEnd}</small>
                  </article>
                  <article>
                    <span>{copy.configQuota}</span>
                    <strong>{configRemaining}</strong>
                    <small>{billing ? `${billing.configUsed} ${copy.used}` : "--"}</small>
                  </article>
                  <article>
                    <span>{copy.chatQuota}</span>
                    <strong>{chatRemaining}</strong>
                    <small>{billing ? `${billing.chatUsedToday} ${copy.used}` : "--"}</small>
                  </article>
                </section>

                <nav className="account-panel-tabs" aria-label={copy.title}>
                  <button type="button" className={mode === "overview" ? "active" : ""} onClick={() => setMode("overview")}>
                    <UserRound size={15} />
                    {isZh ? "概览" : "Overview"}
                  </button>
                  <button type="button" className={mode === "profile" ? "active" : ""} onClick={() => setMode("profile")}>
                    <Mail size={15} />
                    {copy.profile}
                  </button>
                  <button type="button" className={mode === "password" ? "active" : ""} onClick={() => setMode("password")}>
                    <LockKeyhole size={15} />
                    {copy.password}
                  </button>
                  <button type="button" className={mode === "phone" ? "active" : ""} onClick={() => setMode("phone")}>
                    <Phone size={15} />
                    {copy.phone}
                  </button>
                </nav>

                <section className="account-panel-body">
                  {mode === "overview" && (
                    <div className="account-action-grid">
                      <button type="button" onClick={onSubscribe}>
                        <BadgeCheck size={16} />
                        {copy.upgrade}
                      </button>
                      <button type="button" className="danger" onClick={() => void onLogout()}>
                        <LogOut size={16} />
                        {copy.logout}
                      </button>
                    </div>
                  )}

                  {mode === "profile" && (
                    <form className="account-form" onSubmit={(event) => {
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
                        <Save size={16} />
                        {copy.save}
                      </button>
                    </form>
                  )}

                  {mode === "password" && (
                    <form className="account-form" onSubmit={(event) => {
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
                        <Save size={16} />
                        {copy.save}
                      </button>
                    </form>
                  )}

                  {mode === "phone" && (
                    <form className="account-form" onSubmit={(event) => {
                      event.preventDefault()
                      void savePhone()
                    }}>
                      <label>
                        <span>{isZh ? "新手机号" : "New phone"}</span>
                        <input value={phone} onChange={(event) => setPhone(event.target.value)} />
                      </label>
                      <label>
                        <span>{isZh ? "验证码" : "Code"}</span>
                        <div className="account-code-row">
                          <input value={phoneCode} onChange={(event) => setPhoneCode(event.target.value)} />
                          <button type="button" onClick={() => void sendCode()} disabled={loading}>
                            {copy.sendCode}
                          </button>
                        </div>
                      </label>
                      <button type="submit" disabled={loading}>
                        <Save size={16} />
                        {copy.changePhone}
                      </button>
                    </form>
                  )}
                </section>
              </>
            ) : (
              <section className="account-panel-empty">
                <UserRound size={30} />
                <strong>{isZh ? "尚未登录" : "Not signed in"}</strong>
                <button type="button" onClick={onAuth}>
                  <KeyRound size={16} />
                  {copy.signIn}
                </button>
              </section>
            )}

            {(notice || error) && <p className={error ? "account-panel-message error" : "account-panel-message"}>{error || notice}</p>}
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function downloadImageAsset(url: string, fileName: string) {
  if (!url) return
  const anchor = document.createElement("a")
  anchor.href = url
  anchor.download = fileName
  anchor.rel = "noopener"
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
}

async function downloadCompareImage(originalUrl: string, generatedUrl: string, fileName: string) {
  const [original, generated] = await Promise.all([loadImageElement(originalUrl), loadImageElement(generatedUrl)])
  const sourceWidth = Math.max(original.naturalWidth || original.width, generated.naturalWidth || generated.width, 1)
  const width = Math.min(1600, sourceWidth)
  const originalAspect = imageAspectRatio(original)
  const generatedAspect = imageAspectRatio(generated)
  const cellHeight = Math.max(Math.round(width / originalAspect), Math.round(width / generatedAspect))
  const separator = Math.max(2, Math.round(width * 0.002))
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = cellHeight * 2 + separator
  const context = canvas.getContext("2d")
  if (!context) throw new Error("无法创建对比拼图。")
  context.fillStyle = "#050607"
  context.fillRect(0, 0, canvas.width, canvas.height)
  drawContainedImage(context, original, 0, 0, width, cellHeight)
  context.fillStyle = "#262832"
  context.fillRect(0, cellHeight, width, separator)
  drawContainedImage(context, generated, 0, cellHeight + separator, width, cellHeight)
  const blob = await canvasToBlob(canvas)
  const objectUrl = URL.createObjectURL(blob)
  try {
    downloadImageAsset(objectUrl, fileName)
  } finally {
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2000)
  }
}

function loadImageElement(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("图片加载失败，无法保存。"))
    image.src = url
  })
}

function imageAspectRatio(image: HTMLImageElement) {
  const width = image.naturalWidth || image.width || 1
  const height = image.naturalHeight || image.height || 1
  return Math.max(0.1, width / height)
}

function drawContainedImage(context: CanvasRenderingContext2D, image: HTMLImageElement, x: number, y: number, width: number, height: number) {
  const imageWidth = image.naturalWidth || image.width || 1
  const imageHeight = image.naturalHeight || image.height || 1
  const scale = Math.min(width / imageWidth, height / imageHeight)
  const drawWidth = Math.round(imageWidth * scale)
  const drawHeight = Math.round(imageHeight * scale)
  const drawX = x + Math.round((width - drawWidth) / 2)
  const drawY = y + Math.round((height - drawHeight) / 2)
  context.drawImage(image, drawX, drawY, drawWidth, drawHeight)
}

function canvasToBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error("对比拼图保存失败。"))
    }, "image/png")
  })
}

function imageExtensionFromUrl(url: string) {
  const extension = url.split("?")[0].match(/\.(png|jpe?g|webp)$/i)?.[0]
  return extension || ".png"
}

function scrollToAssetCard(assetId: string, refTarget?: HTMLButtonElement | null) {
  const target =
    refTarget ??
    Array.from(document.querySelectorAll<HTMLButtonElement>("[data-asset-id]")).find((element) => element.dataset.assetId === assetId) ??
    null
  if (!target) return false

  const scrollContainer = target.closest<HTMLElement>(".parts-dropdown")
  if (scrollContainer && scrollContainer.scrollHeight > scrollContainer.clientHeight) {
    const targetRect = target.getBoundingClientRect()
    const containerRect = scrollContainer.getBoundingClientRect()
    const targetTop = scrollContainer.scrollTop + targetRect.top - containerRect.top - (scrollContainer.clientHeight - targetRect.height) / 2
    scrollContainer.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" })
  } else {
    target.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" })
  }
  target.focus({ preventScroll: true })
  return true
}

function normalizeHexColor(value: string) {
  const match = value.trim().match(/^#?([0-9a-f]{6})$/i)
  return match ? `#${match[1].toUpperCase()}` : ""
}

function rgbStringsFromHex(hex: string): CustomRgb {
  const normalized = normalizeHexColor(hex) || defaultCustomPaintHex
  const value = normalized.replace("#", "")
  return {
    r: String(Number.parseInt(value.slice(0, 2), 16)),
    g: String(Number.parseInt(value.slice(2, 4), 16)),
    b: String(Number.parseInt(value.slice(4, 6), 16)),
  }
}

function rgbHexFromStrings(rgb: CustomRgb) {
  const values = [rgb.r, rgb.g, rgb.b].map((value) => Number(value))
  if (!values.every((value) => Number.isInteger(value) && value >= 0 && value <= 255)) return ""
  return `#${values.map((value) => value.toString(16).padStart(2, "0")).join("").toUpperCase()}`
}

function rgbTextFromHex(hex: string) {
  const rgb = rgbStringsFromHex(hex)
  return `${rgb.r},${rgb.g},${rgb.b}`
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

function hsvFromHex(hex: string) {
  const normalized = normalizeHexColor(hex) || defaultCustomPaintHex
  const value = normalized.replace("#", "")
  const r = Number.parseInt(value.slice(0, 2), 16) / 255
  const g = Number.parseInt(value.slice(2, 4), 16) / 255
  const b = Number.parseInt(value.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  let h = 0
  if (delta > 0) {
    if (max === r) h = ((g - b) / delta) % 6
    else if (max === g) h = (b - r) / delta + 2
    else h = (r - g) / delta + 4
    h *= 60
    if (h < 0) h += 360
  }
  return {
    h,
    s: max === 0 ? 0 : (delta / max) * 100,
    v: max * 100,
  }
}

function hexFromHsv(hsv: { h: number; s: number; v: number }) {
  const h = ((hsv.h % 360) + 360) % 360
  const s = clampNumber(hsv.s, 0, 100) / 100
  const v = clampNumber(hsv.v, 0, 100) / 100
  const c = v * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = v - c
  let r = 0
  let g = 0
  let b = 0
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return `#${[r, g, b].map((channel) => Math.round((channel + m) * 255).toString(16).padStart(2, "0")).join("").toUpperCase()}`
}

function buildCustomPaintOption(hexInput: string, rgb: CustomRgb): PaintOption | null {
  const hex = normalizeHexColor(hexInput) || rgbHexFromStrings(rgb)
  if (!hex) return null
  const rgbText = rgbTextFromHex(hex)
  const label = `Custom ${hex}`
  return {
    id: "custom",
    label,
    hex,
    prompt: [
      `Change only the vehicle body paint to ${label} / RGB(${rgbText}).`,
      "Preserve the source vehicle identity, body shape, panel gaps, headlights, glass, wheels, tires, license plate shape, black plastic trim, carbon fiber parts, grille, rear wing or spoiler, camera angle, lighting, and background.",
      "Do not tint glass, lights, wheels, tires, license plate, black plastic trim, carbon fiber parts, grille, rear wing or spoiler, ground, nearby cars, or the background with the requested body color.",
    ].join(" "),
  }
}

function ModeSwitch({
  mode,
  setMode,
  labels,
}: {
  mode: AppMode
  setMode: (mode: AppMode) => void
  labels: { config: string; chat: string }
}) {
  return (
    <div className="trae-mode-switch" role="tablist" aria-label="Workspace mode">
      {[
        { id: "config" as AppMode, label: labels.config, icon: <SlidersHorizontal size={15} /> },
        { id: "chat" as AppMode, label: labels.chat, icon: <MessageSquare size={15} /> },
      ].map((item) => (
        <button key={item.id} className={mode === item.id ? "active" : ""} onClick={() => setMode(item.id)} role="tab" aria-selected={mode === item.id}>
          {mode === item.id && <motion.span className="mode-pill" layoutId="mode-pill" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
          <span className="mode-icon">{item.icon}</span>
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  )
}

function ResultPanel({
  t,
  language,
  viewMode,
  setViewMode,
  vehiclePreview,
  job,
  isGenerating,
  elapsedSeconds,
  completedElapsedSeconds,
  generationProgress,
  setIsGenerating,
  selectedPaint,
  paintPreviewBackground,
  stance,
  selectedAssets,
  generate,
  canGenerate,
  saveResult,
  selectedPaintLabel,
  vehicleNote,
  history,
  onHistorySelect,
  onHistoryDelete,
}: {
  t: StudioCopy
  language: Language
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
  vehiclePreview: string
  job: GenerationJob | null
  isGenerating: boolean
  elapsedSeconds: number
  completedElapsedSeconds: number | null
  generationProgress: GenerationProgressEvent | null
  setIsGenerating: (value: boolean) => void
  selectedPaint?: { hex: string }
  paintPreviewBackground: string
  stance: number
  selectedAssets: PartAsset[]
  generate: () => void
  canGenerate: boolean
  saveResult: () => void
  selectedPaintLabel: string
  vehicleNote: string
  history: GenerationJob[]
  onHistorySelect: (job: GenerationJob) => void
  onHistoryDelete: (job: GenerationJob) => void
}) {
  const historyGroups = groupHistoryByDate(history)
  const generatedResultUrl = job?.status === "succeeded" ? job.resultImageUrl : ""
  const hasGeneratedResult = Boolean(generatedResultUrl)
  const showCompletedElapsed = hasGeneratedResult && completedElapsedSeconds !== null && !isGenerating && viewMode !== "original"
  const progressRetryText = generationProgress?.retryAttempt ? (language === "zh" ? ` · 第 ${generationProgress.retryAttempt} 次重试` : ` · retry ${generationProgress.retryAttempt}`) : ""
  const progressText = generationProgress?.message || t.running

  return (
    <>
      <div className="result-heading">
        <h2>
          <ImageIcon size={22} />
          {t.result}
        </h2>
        <div className="view-switch">
          <button className={viewMode === "original" ? "selected" : ""} onClick={() => setViewMode("original")}>
            {t.original}
          </button>
          <button className={viewMode === "generated" ? "selected" : ""} onClick={() => setViewMode("generated")}>
            {t.generated}
          </button>
          <button className={viewMode === "compare" ? "selected" : ""} onClick={() => setViewMode("compare")}>
            {t.compare}
          </button>
        </div>
      </div>

      <section className="result-window" style={{ "--paint": selectedPaint?.hex ?? "#050506" } as CSSProperties}>
        {isGenerating && (
          <div className="progress-overlay">
            <div className="provider-wait-indicator" aria-hidden="true">
              <span />
            </div>
            <p>{progressText}</p>
            <small>{language === "zh" ? `已等待 ${elapsedSeconds} 秒` : `Waiting ${elapsedSeconds}s`}{progressRetryText}</small>
            <button onClick={() => setIsGenerating(false)}>{t.cancel}</button>
          </div>
        )}

        {!vehiclePreview && !job && (
          <div className="result-empty">
            <ImageIcon size={38} />
            <p>{t.ready}</p>
            <span>{t.waiting}</span>
          </div>
        )}
        {viewMode === "original" && vehiclePreview && <img className="main-image" src={vehiclePreview} alt="Original vehicle" />}
        {viewMode === "generated" &&
          (hasGeneratedResult ? <img className="main-image fixed-result-image" src={generatedResultUrl} alt="Generated vehicle render" /> : vehiclePreview ? <GeneratedPreview src={vehiclePreview} paintBackground={paintPreviewBackground} stance={stance} selectedAssets={selectedAssets} /> : null)}
        {viewMode === "compare" && vehiclePreview && (
          <div className="compare-grid">
            <div>
              <span>Before</span>
              <img src={vehiclePreview} alt="Before" />
            </div>
            <div>
              <span>After</span>
              {hasGeneratedResult ? <img className="main-image fixed-result-image" src={generatedResultUrl} alt="Generated vehicle render" /> : <GeneratedPreview src={vehiclePreview} paintBackground={paintPreviewBackground} stance={stance} selectedAssets={selectedAssets} />}
            </div>
          </div>
        )}
        {showCompletedElapsed && <span className="result-elapsed-badge">{`${t.elapsed} ${completedElapsedSeconds} ${t.elapsedUnit}`}</span>}
      </section>

      <section className="result-actions">
        <div className="selected-summary">
          <Layers3 size={18} />
          <div>
            <strong>{selectedAssets.length ? `${selectedAssets.length} ${selectedAssets.length === 1 ? t.partSelected : t.partsSelected}` : t.noParts}</strong>
            <span>{selectedAssets.map((asset) => `${asset.brand} ${asset.variant}`).join(" / ") || selectedPaintLabel}</span>
          </div>
        </div>
        <div className="action-row">
          <button onClick={generate} disabled={!canGenerate}>
            <Sparkles size={16} /> {t.rerun}
          </button>
          <a
            className={!hasGeneratedResult ? "disabled" : ""}
            href={generatedResultUrl || "#"}
            download
            onClick={(event) => {
              if (!hasGeneratedResult) {
                event.preventDefault()
                return
              }
              saveResult()
            }}
          >
            <ArrowDownToLine size={16} /> {t.saveExport}
          </a>
        </div>
      </section>

      <section className="history-strip">
        <div className="history-title">
          <History size={17} />
          <strong>{t.history}</strong>
          <span>
            {history.length} {t.records}
          </span>
        </div>
        <div className="history-groups">
          {history.length ? (
            historyGroups.map((group) => (
              <div className="history-date-group" key={group.dateKey}>
                <span className="history-date-label">{group.label}</span>
                <div className="history-list">
                  {group.items.map((item) => (
                    <div className={item.id === job?.id ? "history-thumb selected" : "history-thumb"} key={item.id}>
                      <button onClick={() => onHistorySelect(item)} title="Open render history">
                        <img src={item.resultImageUrl} alt={item.id} />
                        <span>{displayVehicleModelForHistory(item, item.id === job?.id || item.sourceImageUrl === vehiclePreview ? vehicleNote : "")}</span>
                      </button>
                      <button
                        type="button"
                        className="history-delete"
                        aria-label="Delete render history"
                        onClick={(event) => {
                          event.stopPropagation()
                          void onHistoryDelete(item)
                        }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <small>{t.historyEmpty}</small>
          )}
        </div>
      </section>
    </>
  )
}

function isRenderableGeneration(job: GenerationJob) {
  return job.status === "succeeded" && Boolean(job.resultImageUrl)
}

function getDefaultColorPolicy(asset: PartAsset): PartColorPolicy | undefined {
  const allowedColorPolicies = getSelectableColorPolicies(asset)
  if (!allowedColorPolicies.length) return undefined
  const defaultColorPolicy = asset.defaultColorPolicy
  return defaultColorPolicy && allowedColorPolicies.includes(defaultColorPolicy) ? defaultColorPolicy : allowedColorPolicies[0]
}

function getSelectableColorPolicies(asset: PartAsset): PartColorPolicy[] {
  const policies = (asset.allowedColorPolicies ?? []).filter((policy) => policy === "body_color" || policy === "exposed_carbon")
  if (policies.length > 1) return policies
  const carbonCapableCategory = asset.categoryId === "hood" || asset.categoryId === "mirrors"
  const carbonText = [asset.brand, asset.model, asset.variant, asset.keywords, asset.color, asset.finish, asset.promptHint].join(" ")
  if (carbonCapableCategory && /carbon|\u78b3/i.test(carbonText)) return ["body_color", "exposed_carbon"]
  return policies
}

function isInternalVehicleModel(value: unknown) {
  const model = cleanVehicleModelText(value).toLowerCase()
  return !model || model === "user uploaded vehicle, preserve exact identity"
}

function displayVehicleModelForHistory(item: GenerationJob, fallback = "") {
  const storedDisplayModel = normalizeDetectedVehicleModel(item.displayVehicleModel)
  if (storedDisplayModel) return storedDisplayModel
  const standardModel = normalizeDetectedVehicleModel(item.standardJson?.vehicle?.model)
  if (!isInternalVehicleModel(standardModel)) return standardModel
  return normalizeDetectedVehicleModel(fallback)
}

function readHistoryVehicleModels() {
  if (typeof window === "undefined") return {}
  try {
    const parsed = JSON.parse(window.localStorage.getItem(HISTORY_VEHICLE_MODEL_STORAGE_KEY) || "{}")
    return isRecord(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function applyStoredHistoryVehicleModels(items: GenerationJob[]) {
  const modelMap = readHistoryVehicleModels()
  return items.map((item) => {
    const storedModel = normalizeDetectedVehicleModel(modelMap[item.id])
    return storedModel ? { ...item, displayVehicleModel: storedModel } : item
  })
}

function storeHistoryVehicleModel(jobId: string, model: string) {
  const displayModel = normalizeDetectedVehicleModel(model)
  if (!displayModel || typeof window === "undefined") return
  const modelMap = readHistoryVehicleModels()
  modelMap[jobId] = displayModel
  window.localStorage.setItem(HISTORY_VEHICLE_MODEL_STORAGE_KEY, JSON.stringify(modelMap))
}

function forgetHistoryVehicleModel(jobId: string) {
  if (typeof window === "undefined") return
  const modelMap = readHistoryVehicleModels()
  if (!(jobId in modelMap)) return
  delete modelMap[jobId]
  window.localStorage.setItem(HISTORY_VEHICLE_MODEL_STORAGE_KEY, JSON.stringify(modelMap))
}

function normalizeDetectedVehicleModel(value: unknown) {
  const model = cleanVehicleModelText(value)
  if (!model) return ""
  const normalized = model.toLowerCase()
  const placeholders = ["unknown", "n/a", "na", "none", "null", "vehicle model pending", "车型待识别", "待识别", "未知", "未识别"]
  return placeholders.includes(normalized) || placeholders.includes(model) ? "" : model
}

function extractDetectedVehicleModel(payload: unknown): string {
  if (!isRecord(payload)) return ""
  const candidates: string[] = []
  const records = [
    payload,
    payload.vehicle,
    payload.car,
    payload.result,
    payload.data,
    payload.recognition,
    payload.detectedVehicle,
  ].filter(isRecord)

  for (const record of records) {
    for (const key of [
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
    ]) {
      const direct = normalizeDetectedVehicleModel(record[key])
      if (direct) candidates.push(direct)
    }

    if (isRecord(record.model)) {
      const nested: string = extractDetectedVehicleModel({ vehicle: record.model })
      if (nested) candidates.push(nested)
    }

    const make = firstRecordString(record, ["make", "brand", "manufacturer", "marque"])
    const series = firstRecordString(record, ["series", "model", "modelCode", "model_code", "name"])
    const trim = firstRecordString(record, ["trim", "submodel", "variant"])
    const bodyStyle = firstRecordString(record, ["bodyStyle", "body_style", "body", "bodyType", "body_type"])
    const generation = firstRecordString(record, ["generation", "chassis", "platform", "code"])
    const yearRange = firstRecordString(record, ["yearRange", "year_range", "modelYear", "model_year", "year"])
    const joined = normalizeDetectedVehicleModel(canonicalVehicleModel([make, series, trim, bodyStyle], generation || yearRange))
    if (joined) candidates.push(joined)
  }

  return bestDetectedVehicleCandidate(candidates)
}

function firstRecordString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key]
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
  }
  return ""
}

function joinUniqueModelSegments(segments: string[]) {
  const result: string[] = []
  for (const segment of segments.map((item) => item.trim()).filter(Boolean)) {
    const normalized = segment.toLowerCase()
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

function cleanVehicleModelText(value: unknown) {
  const raw = typeof value === "number" && Number.isFinite(value) ? String(value) : typeof value === "string" ? value.trim() : ""
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
  const base = joinUniqueModelSegments(parts.map(cleanVehicleModelText))
  const generationText = cleanVehicleModelText(generation)
  if (!base) return ""
  if (!generationText || base.toLowerCase().includes(generationText.toLowerCase())) return base
  return `${base} (${generationText})`
}

function bestDetectedVehicleCandidate(candidates: string[]) {
  const unique = Array.from(new Set(candidates.map(normalizeDetectedVehicleModel).filter(Boolean)))
  unique.sort((left, right) => detectedVehicleModelScore(right) - detectedVehicleModelScore(left))
  return unique[0] || ""
}

function detectedVehicleModelScore(value: string) {
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

function groupHistoryByDate(history: GenerationJob[]) {
  const formatter = new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
  const groups = new Map<string, { dateKey: string; label: string; items: GenerationJob[] }>()
  history.forEach((item) => {
    const label = formatter.format(new Date(item.createdAt))
    const dateKey = new Date(item.createdAt).toISOString().slice(0, 10)
    const group = groups.get(dateKey) ?? { dateKey, label, items: [] }
    group.items.push(item)
    groups.set(dateKey, group)
  })
  return Array.from(groups.values())
}

function leadWithColon(value: string, language: Language) {
  const trimmed = value.trim().replace(/[。.：:]+$/, "")
  return `${trimmed}${language === "en" ? ":" : "："}`
}

function AssetImage({ asset }: { asset: PartAsset }) {
  if (asset.imageUrl.endsWith("bbs-lmr-options.png")) {
    const [x = "50%", y = "50%"] = (asset.imageCrop || "50% 50%").split(" ")
    const cropX = Number.parseFloat(x)
    const cropY = Number.parseFloat(y)
    return (
      <span className="wheel-crop">
        <img
          src={asset.imageUrl}
          alt={`${asset.brand} ${asset.model} ${asset.variant}`}
          style={
            {
              "--wheel-x": `${Number.isFinite(cropX) ? -cropX / 2 : -25}%`,
              "--wheel-y": `${Number.isFinite(cropY) ? -cropY / 2 : -25}%`,
            } as CSSProperties
          }
        />
      </span>
    )
  }

  return <img className="asset-img" src={asset.imageUrl} alt={`${asset.brand} ${asset.model} ${asset.variant}`} />
}

function GeneratedPreview({
  src,
  paintBackground,
  stance,
  selectedAssets,
}: {
  src: string
  paintBackground: string
  stance: number
  selectedAssets: PartAsset[]
}) {
  const offset = previewOffsetForStance(stance)

  return (
    <div className="generated-preview">
      <img className="main-image" src={src} alt="Generated vehicle mock" style={{ transform: `translateY(${offset}px)` }} />
      <span className="paint-layer" style={{ background: paintBackground }} />
      <div className="mod-tags">
        {selectedAssets.slice(0, 5).map((asset) => (
          <span key={asset.id}>
            {asset.brand} {asset.variant}
          </span>
        ))}
      </div>
      <div className="mock-badge">
        <Camera size={15} />
        Mock render
      </div>
    </div>
  )
}

function previewOffsetForStance(stance: number) {
  if (stance <= 0) return 0
  if (stance <= 30) return -5
  if (stance <= 55) return 8
  if (stance <= 80) return 15
  return 21
}
