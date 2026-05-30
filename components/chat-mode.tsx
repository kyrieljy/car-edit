"use client"

import type React from "react"
import { startTransition, useEffect, useMemo, useRef, useState } from "react"
import { AnimatePresence, motion } from "framer-motion"
import { 
  ArrowDownToLine,
  ArrowUp,
  Bot,
  Car,
  ChevronDown,
  Clock,
  ImageIcon,
  ImageOff,
  Menu,
  Mic,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Sparkles,
  Star,
  X,
} from "lucide-react"
import { readProgressResponse } from "@/lib/progress-client"
import { canvasSafeImageUrl, downloadImageAsset, imageExtensionFromUrl } from "@/lib/client/image-download"
import { IMAGE_UPLOAD_MAX_BYTES, IMAGE_UPLOAD_MAX_MB, MAX_CHAT_PART_IMAGES, isAllowedImageMimeType } from "@/lib/upload-limits"
import type { AuthUser, ChatMessage, ChatSession, EntitlementStatus, GenerationProgressEvent, PartColorPolicy } from "@/lib/types"

type Language = "en" | "zh"
type MobileAccessKind = "login" | "config_quota" | "chat_quota" | null

type ChatModeProps = {
  language: Language
  authUser?: AuthUser | null
  onAuthRequired?: () => void
  onSubscribeRequired?: (billing?: EntitlementStatus) => void
  onBillingChanged?: (billing: EntitlementStatus) => void
  mobileAccessKind?: MobileAccessKind
  onMobileAccessBlocked?: () => void
  mobileVariant?: boolean
  mobileSidebarOpen?: boolean
  setMobileSidebarOpen?: (open: boolean) => void
  hideMobileMenu?: boolean
}

const fallbackPrompts = [
  "Gloss black BMW M3 with BBS LM-R wheels",
  "Lower the stance to flush fitment",
  "Add carbon front lip and rear wing",
  "Install red brake calipers while preserving the original garage background",
]

const MOBILE_HISTORY_DRAWER_EXIT_MS = 230

const chatCopy = {
  en: {
    headline: "Upload your vehicle and describe the modification you want.",
    placeholder: "Describe the car modification you want...",
    vehicle: "Vehicle photo",
    parts: "Part references",
    attachVehicle: "Upload vehicle",
    attachParts: "Add parts",
    send: "Send",
    generating: "Checking request and generating...",
    newChat: "Start New Chat",
    search: "Search...",
    pinned: "PINNED CHATS",
    recent: "RECENT",
    invalidFile: "Use jpg, png or webp.",
    fileTooLarge: `Each image must be ${IMAGE_UPLOAD_MAX_MB}MB or smaller.`,
    missingVehicle: "Upload a vehicle photo first.",
    missingText: "Describe the modification you want.",
    partLimit: `Up to ${MAX_CHAT_PART_IMAGES} part reference images are supported.`,
    dryRun: "Dry run",
    dryRunHint: "No external AI call; returns JSON / prompt preview.",
    cancel: "Cancel",
    canceled: "Generation canceled.",
    waiting: "Waiting",
    seconds: "sec",
    partsOnlyRequest: "Uploaded part references",
    regenerate: "Regenerate",
    download: "Download",
    assistant: "AI Assistant",
    workspace: "Prototype workspace",
    promptLabel: "Prompt examples",
    promptEmpty: "No prompt examples configured.",
    emptyHistory: "No chats yet.",
    context: "Context",
    latest: "Continue",
    originalContext: "Regenerate",
    imageUnavailable: "History image is unavailable",
    bodyColor: "Body color",
    exposedCarbon: "Exposed carbon",
    preview: "Preview",
    deleteChat: "Delete chat",
  },
  zh: {
    headline: "\u8bf7\u4e0a\u4f20\u4f60\u7684\u8f66\u8f86\u7167\u7247\uff0c\u5e76\u63cf\u8ff0\u60f3\u8981\u7684\u6539\u88c5\u6548\u679c\u3002",
    placeholder: "\u63cf\u8ff0\u4f60\u60f3\u8981\u7684\u8f66\u8f86\u6539\u88c5\u6548\u679c...",
    vehicle: "\u8f66\u8f86\u7167\u7247",
    parts: "\u914d\u4ef6\u53c2\u8003\u56fe",
    attachVehicle: "\u4e0a\u4f20\u8f66\u8f86",
    attachParts: "\u6dfb\u52a0\u914d\u4ef6",
    send: "\u53d1\u9001",
    generating: "\u6b63\u5728\u68c0\u6d4b\u9700\u6c42\u5e76\u751f\u6210...",
    newChat: "\u65b0\u5efa\u5bf9\u8bdd",
    search: "\u641c\u7d22...",
    pinned: "\u7f6e\u9876\u5bf9\u8bdd",
    recent: "\u6700\u8fd1\u5bf9\u8bdd",
    invalidFile: "\u8bf7\u4f7f\u7528 jpg\u3001png \u6216 webp\u3002",
    fileTooLarge: `\u6bcf\u5f20\u56fe\u7247\u4e0d\u80fd\u8d85\u8fc7 ${IMAGE_UPLOAD_MAX_MB}MB\u3002`,
    missingVehicle: "\u8bf7\u5148\u4e0a\u4f20\u8f66\u8f86\u7167\u7247\u3002",
    missingText: "\u8bf7\u63cf\u8ff0\u4f60\u60f3\u8981\u7684\u6539\u88c5\u6548\u679c\u3002",
    partLimit: `\u6700\u591a\u652f\u6301 ${MAX_CHAT_PART_IMAGES} \u5f20\u914d\u4ef6\u53c2\u8003\u56fe\u3002`,
    dryRun: "Dry run",
    dryRunHint: "\u4e0d\u8c03\u7528\u5916\u90e8 AI\uff0c\u53ea\u8fd4\u56de JSON / Prompt \u9884\u89c8\u3002",
    cancel: "\u53d6\u6d88",
    canceled: "\u5df2\u53d6\u6d88\u672c\u6b21\u751f\u6210\u3002",
    waiting: "\u5df2\u7b49\u5f85",
    seconds: "\u79d2",
    partsOnlyRequest: "\u5df2\u4e0a\u4f20\u914d\u4ef6\u53c2\u8003\u56fe",
    regenerate: "\u91cd\u65b0\u751f\u6210",
    download: "\u4e0b\u8f7d",
    assistant: "AI \u52a9\u624b",
    workspace: "\u539f\u578b\u5de5\u4f5c\u533a",
    promptLabel: "\u63a8\u8350\u63d0\u793a\u8bcd",
    promptEmpty: "\u540e\u53f0\u5c1a\u672a\u914d\u7f6e\u63d0\u793a\u8bcd\u3002",
    emptyHistory: "\u6682\u65e0\u5bf9\u8bdd\u3002",
    context: "\u4e0a\u4e0b\u6587",
    latest: "\u7ee7\u7eed\u751f\u6210",
    originalContext: "\u91cd\u65b0\u751f\u6210",
    imageUnavailable: "\u5386\u53f2\u56fe\u7247\u5df2\u5931\u6548",
    bodyColor: "\u8f66\u8eab\u540c\u8272",
    exposedCarbon: "\u88f8\u78b3",
    preview: "\u9884\u89c8",
    deleteChat: "\u5220\u9664\u5bf9\u8bdd",
  },
}

type ChatCopy = (typeof chatCopy)["en"]
type PendingContextChoice = {
  text: string
  vehicleFile: File | null
  partFiles: File[]
  dryRun: boolean
  messageId: string
  partColorPolicyConfirmed?: boolean
  partColorPolicyCategory?: "hood" | "mirrors"
  partColorPolicy?: PartColorPolicy
  partColorPolicyChoicesJson?: string
}

type PartColorPolicyChoiceCategory = "hood" | "mirrors"
type PartColorPolicyChoiceRow = {
  categoryId: PartColorPolicyChoiceCategory
  categoryLabel: string
  options: Array<{ categoryId: PartColorPolicyChoiceCategory; colorPolicy: PartColorPolicy; label: string }>
}

type PendingPartColorPolicyChoice = PendingContextChoice & {
  choices: PartColorPolicyChoiceRow[]
  selections: Partial<Record<PartColorPolicyChoiceCategory, PartColorPolicy>>
}

type ChatModeCacheSnapshot = {
  sessions: ChatSession[]
  activeSessionId: string
  messages: ChatMessage[]
  query: string
  text: string
  contextMode: "latest" | "original"
  dryRun: boolean
  pendingContextChoice: PendingContextChoice | null
  pendingPartColorPolicyChoice: PendingPartColorPolicyChoice | null
}

const chatModeCache = new Map<string, ChatModeCacheSnapshot>()

type TetraPoint = { x: number; y: number; z: number }
type TetraRenderPoint = TetraPoint & { char: string }

function MobileChatEmptyVisual() {
  return (
    <div className="mobile-chat-empty-visual" aria-hidden="true">
      <MobileChatTetrahedron />
      <MobileChatLightOrb />
    </div>
  )
}

function MobileChatTetrahedron() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const frameRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext("2d")
    if (!canvas || !ctx) return undefined

    const chars = "░▒▓█▀▄▌▐│─┤├┴┬╭╮╰╯"
    let time = 0
    const vertices: TetraPoint[] = [
      { x: 0, y: 1, z: 0 },
      { x: -0.943, y: -0.333, z: -0.5 },
      { x: 0.943, y: -0.333, z: -0.5 },
      { x: 0, y: -0.333, z: 1 },
    ]
    const edges = [[0, 1], [0, 2], [0, 3], [1, 2], [2, 3], [3, 1]]
    const faces = [[0, 1, 2], [0, 2, 3], [0, 3, 1], [1, 3, 2]]

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const rotate = (point: TetraPoint) => {
      let x = point.x * Math.cos(time * 0.4) - point.z * Math.sin(time * 0.4)
      let z = point.x * Math.sin(time * 0.4) + point.z * Math.cos(time * 0.4)
      let y = point.y * Math.cos(time * 0.3) - z * Math.sin(time * 0.3)
      z = point.y * Math.sin(time * 0.3) + z * Math.cos(time * 0.3)
      const finalX = x * Math.cos(time * 0.2) - y * Math.sin(time * 0.2)
      const finalY = x * Math.sin(time * 0.2) + y * Math.cos(time * 0.2)
      return { x: finalX, y: finalY, z }
    }

    const pushPoint = (points: TetraRenderPoint[], point: TetraPoint, centerX: number, centerY: number, scale: number) => {
      const rotated = rotate(point)
      const depth = (rotated.z + 1.5) / 3
      const charIndex = Math.floor(depth * (chars.length - 1))
      points.push({
        x: centerX + rotated.x * scale,
        y: centerY - rotated.y * scale,
        z: rotated.z,
        char: chars[Math.min(charIndex, chars.length - 1)],
      })
    }

    const render = () => {
      const rect = canvas.getBoundingClientRect()
      ctx.clearRect(0, 0, rect.width, rect.height)
      const centerX = rect.width / 2
      const centerY = rect.height / 2
      const scale = Math.min(rect.width, rect.height) * 0.38
      const points: TetraRenderPoint[] = []

      ctx.font = `${Math.max(12, Math.min(rect.width, rect.height) * 0.08)}px "JetBrains Mono", Consolas, monospace`
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"

      edges.forEach(([start, end]) => {
        const first = vertices[start]
        const second = vertices[end]
        for (let step = 0; step <= 1; step += 0.05) {
          pushPoint(points, {
            x: first.x + (second.x - first.x) * step,
            y: first.y + (second.y - first.y) * step,
            z: first.z + (second.z - first.z) * step,
          }, centerX, centerY, scale)
        }
      })

      faces.forEach(([a, b, c]) => {
        for (let u = 0; u <= 1; u += 0.12) {
          for (let v = 0; v <= 1 - u; v += 0.12) {
            const w = 1 - u - v
            pushPoint(points, {
              x: vertices[a].x * u + vertices[b].x * v + vertices[c].x * w,
              y: vertices[a].y * u + vertices[b].y * v + vertices[c].y * w,
              z: vertices[a].z * u + vertices[b].z * v + vertices[c].z * w,
            }, centerX, centerY, scale)
          }
        }
      })

      points.sort((left, right) => left.z - right.z)
      points.forEach((point) => {
        const alpha = Math.min(0.18 + (point.z + 1.5) * 0.24, 0.94)
        ctx.fillStyle = `rgba(213, 239, 233, ${alpha})`
        ctx.fillText(point.char, point.x, point.y)
      })

      time += 0.015
      frameRef.current = window.requestAnimationFrame(render)
    }

    resize()
    window.addEventListener("resize", resize)
    render()

    return () => {
      window.removeEventListener("resize", resize)
      window.cancelAnimationFrame(frameRef.current)
    }
  }, [])

  return (
    <div className="mobile-chat-tetrahedron-wrap">
      <canvas ref={canvasRef} className="mobile-chat-tetrahedron" />
    </div>
  )
}

function MobileChatLightOrb() {
  return (
    <div className="mobile-chat-light-orb-shell">
      <div className="mobile-chat-light-orb">
        <div className="mobile-chat-light-orb-blur">
          <span className="mobile-chat-orb-circle-1" />
          <span className="mobile-chat-orb-circle-2" />
          <span className="mobile-chat-orb-circle-3" />
          <span className="mobile-chat-orb-circle-4" />
          <span className="mobile-chat-orb-circle-5" />
        </div>
        <span className="mobile-chat-light-orb-gloss" />
      </div>
    </div>
  )
}

export function ChatMode({
  language,
  authUser,
  onAuthRequired,
  onSubscribeRequired,
  onBillingChanged,
  mobileAccessKind = null,
  onMobileAccessBlocked,
  mobileVariant = false,
  mobileSidebarOpen: controlledMobileSidebarOpen,
  setMobileSidebarOpen: setControlledMobileSidebarOpen,
  hideMobileMenu = false,
}: ChatModeProps) {
  const t = chatCopy[language]
  const vehicleInputRef = useRef<HTMLInputElement | null>(null)
  const partInputRef = useRef<HTMLInputElement | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const requestAbortRef = useRef<AbortController | null>(null)
  const sessionLoadSeqRef = useRef(0)
  const chatCacheKey = `${mobileVariant ? "mobile" : "desktop"}:${authUser?.id ?? "guest"}`
  const cachedChatState = chatModeCache.get(chatCacheKey)
  const [hydratedChatCacheKey, setHydratedChatCacheKey] = useState(chatCacheKey)
  const [sessions, setSessions] = useState<ChatSession[]>(() => cachedChatState?.sessions ?? [])
  const [activeSessionId, setActiveSessionId] = useState(() => cachedChatState?.activeSessionId ?? "")
  const [messages, setMessages] = useState<ChatMessage[]>(() => cachedChatState?.messages ?? [])
  const [query, setQuery] = useState(() => cachedChatState?.query ?? "")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [internalMobileSidebarOpen, setInternalMobileSidebarOpen] = useState(false)
  const mobileSidebarOpen = controlledMobileSidebarOpen ?? internalMobileSidebarOpen
  const setMobileSidebarOpen = setControlledMobileSidebarOpen ?? setInternalMobileSidebarOpen
  const [text, setText] = useState(() => cachedChatState?.text ?? "")
  const [vehicleFile, setVehicleFile] = useState<File | null>(null)
  const [partFiles, setPartFiles] = useState<File[]>([])
  const [vehiclePreview, setVehiclePreview] = useState("")
  const [partPreviews, setPartPreviews] = useState<Array<{ key: string; name: string; url: string; index: number }>>([])
  const [notice, setNotice] = useState("")
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationElapsedSeconds, setGenerationElapsedSeconds] = useState(0)
  const [generationProgress, setGenerationProgress] = useState<GenerationProgressEvent | null>(null)
  const [optimisticMessage, setOptimisticMessage] = useState<ChatMessage | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>(fallbackPrompts)
  const [suggestionsOpen, setSuggestionsOpen] = useState(false)
  const [contextMode, setContextMode] = useState<"latest" | "original">(() => cachedChatState?.contextMode ?? "latest")
  const [previewUrl, setPreviewUrl] = useState("")
  const [dryRun, setDryRun] = useState(() => cachedChatState?.dryRun ?? true)
  const [pendingContextChoice, setPendingContextChoice] = useState<PendingContextChoice | null>(() => cachedChatState?.pendingContextChoice ?? null)
  const [pendingPartColorPolicyChoice, setPendingPartColorPolicyChoice] = useState<PendingPartColorPolicyChoice | null>(() => cachedChatState?.pendingPartColorPolicyChoice ?? null)
  const mobileLoginBlocked = mobileVariant && mobileAccessKind === "login"
  const mobileChatQuotaBlocked = mobileVariant && mobileAccessKind === "chat_quota"
  const mobileSendBlocked = mobileLoginBlocked || mobileChatQuotaBlocked
  const blockMobileAccess = () => {
    onMobileAccessBlocked?.()
  }

  useEffect(() => {
    void loadSessions()
    void loadSuggestions()
  }, [authUser?.id])

  useEffect(() => {
    const cached = chatModeCache.get(chatCacheKey)
    setSessions(cached?.sessions ?? [])
    setActiveSessionId(cached?.activeSessionId ?? "")
    setMessages(cached?.messages ?? [])
    setQuery(cached?.query ?? "")
    setText(cached?.text ?? "")
    setContextMode(cached?.contextMode ?? "latest")
    setDryRun(cached?.dryRun ?? true)
    setPendingContextChoice(cached?.pendingContextChoice ?? null)
    setPendingPartColorPolicyChoice(cached?.pendingPartColorPolicyChoice ?? null)
    setOptimisticMessage(null)
    setNotice("")
    setHydratedChatCacheKey(chatCacheKey)
  }, [chatCacheKey])

  useEffect(() => {
    if (hydratedChatCacheKey !== chatCacheKey) return
    chatModeCache.set(chatCacheKey, {
      sessions,
      activeSessionId,
      messages,
      query,
      text,
      contextMode,
      dryRun,
      pendingContextChoice,
      pendingPartColorPolicyChoice,
    })
  }, [activeSessionId, chatCacheKey, contextMode, dryRun, hydratedChatCacheKey, messages, pendingContextChoice, pendingPartColorPolicyChoice, query, sessions, text])

  useEffect(() => {
    if (!vehicleFile) {
      setVehiclePreview("")
      return
    }
    const url = URL.createObjectURL(vehicleFile)
    setVehiclePreview(url)
    return () => URL.revokeObjectURL(url)
  }, [vehicleFile])

  useEffect(() => {
    const previews = partFiles.map((file, index) => ({
      key: `${fileKey(file)}-${index}`,
      name: file.name,
      url: URL.createObjectURL(file),
      index,
    }))
    setPartPreviews(previews)
    return () => previews.forEach((preview) => URL.revokeObjectURL(preview.url))
  }, [partFiles])

  useEffect(() => {
    if (messages.length || isGenerating) bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" })
  }, [messages, isGenerating])

  useEffect(() => {
    if (!isGenerating) {
      setGenerationElapsedSeconds(0)
      return
    }
    const startedAt = Date.now()
    setGenerationElapsedSeconds(0)
    const interval = window.setInterval(() => {
      setGenerationElapsedSeconds(Math.max(1, Math.floor((Date.now() - startedAt) / 1000)))
    }, 1000)
    return () => window.clearInterval(interval)
  }, [isGenerating])

  const filteredSessions = useMemo(() => {
    const term = query.trim().toLowerCase()
    if (!term) return sessions
    return sessions.filter((session) => session.title.toLowerCase().includes(term) || session.preview.toLowerCase().includes(term))
  }, [sessions, query])

  const pinned = filteredSessions.filter((session) => session.pinned)
  const recent = filteredSessions.filter((session) => !session.pinned)
  const hasSessionCanvas = useMemo(
    () =>
      Boolean(
        activeSessionId &&
          messages.some(
            (message) =>
              message.resultImageUrl ||
              message.attachments.some((attachment) => attachment.type === "vehicle" || attachment.type === "result"),
          ),
      ),
    [activeSessionId, messages],
  )

  const loadSessions = async () => {
    const response = await fetch("/api/chat/sessions")
    if (response.status === 401) return
    if (!response.ok) return
    const body = (await response.json()) as { sessions: ChatSession[] }
    setSessions(body.sessions)
  }

  const loadSuggestions = async () => {
    const response = await fetch("/api/chat/suggestions")
    if (!response.ok) return
    const body = (await response.json()) as { prompts: string[] }
    setSuggestions(body.prompts.length ? body.prompts : fallbackPrompts)
  }

  const createSession = () => {
    if (mobileLoginBlocked) {
      blockMobileAccess()
      return
    }
    if (!authUser) {
      onAuthRequired?.()
      return
    }
    sessionLoadSeqRef.current += 1
    setActiveSessionId("")
    setMessages([])
    setText("")
    setVehicleFile(null)
    setPartFiles([])
    setPendingContextChoice(null)
    setPendingPartColorPolicyChoice(null)
    setOptimisticMessage(null)
    setNotice("")
    setMobileSidebarOpen(false)
  }

  const selectSession = (id: string) => {
    if (mobileLoginBlocked) {
      blockMobileAccess()
      return
    }
    const loadSeq = ++sessionLoadSeqRef.current
    const shouldDeferRender = mobileVariant && mobileSidebarOpen
    setActiveSessionId(id)
    setPendingContextChoice(null)
    setPendingPartColorPolicyChoice(null)
    if (mobileSidebarOpen) setMobileSidebarOpen(false)

    const loadSelectedSession = async () => {
      const responsePromise = fetch(`/api/chat/sessions/${id}`)
      if (shouldDeferRender) {
        await new Promise((resolve) => window.setTimeout(resolve, MOBILE_HISTORY_DRAWER_EXIT_MS))
      }
      const response = await responsePromise
      if (loadSeq !== sessionLoadSeqRef.current) return
      if (response.status === 401) {
        onAuthRequired?.()
        return
      }
      if (!response.ok) return
      const body = (await response.json()) as { messages: ChatMessage[] }
      if (loadSeq !== sessionLoadSeqRef.current) return
      startTransition(() => {
        setMessages(body.messages)
      })
    }

    void loadSelectedSession()
  }

  const togglePinSession = async (session: ChatSession) => {
    if (mobileLoginBlocked) {
      blockMobileAccess()
      return
    }
    if (!authUser) {
      onAuthRequired?.()
      return
    }
    const response = await fetch(`/api/chat/sessions/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pinned: !session.pinned }),
    })
    if (!response.ok) return
    const updated = (await response.json()) as ChatSession
    setSessions((items) => items.map((item) => (item.id === updated.id ? updated : item)).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt - a.updatedAt))
  }

  const deleteSession = async (session: ChatSession) => {
    if (mobileLoginBlocked) {
      blockMobileAccess()
      return
    }
    const response = await fetch(`/api/chat/sessions/${session.id}`, { method: "DELETE" })
    if (response.status === 401) {
      onAuthRequired?.()
      return
    }
    if (!response.ok) return
    setSessions((items) => items.filter((item) => item.id !== session.id))
    if (activeSessionId === session.id) {
      setActiveSessionId("")
      setMessages([])
      setPendingContextChoice(null)
      setPendingPartColorPolicyChoice(null)
    }
  }

  const onVehicleFile = (file: File | undefined) => {
    if (!file) return
    if (mobileLoginBlocked) {
      blockMobileAccess()
      if (vehicleInputRef.current) vehicleInputRef.current.value = ""
      return
    }
    const validationError = imageValidationError(file)
    if (validationError) {
      setNotice(t[validationError])
      if (vehicleInputRef.current) vehicleInputRef.current.value = ""
      return
    }
    setVehicleFile(file)
    setNotice("")
    if (vehicleInputRef.current) vehicleInputRef.current.value = ""
  }

  const onPartFiles = (files: FileList | null) => {
    if (mobileLoginBlocked) {
      blockMobileAccess()
      if (partInputRef.current) partInputRef.current.value = ""
      return
    }
    const incoming = Array.from(files || [])
    const invalidType = incoming.some((file) => !isAllowedImageMimeType(file.type))
    const oversized = incoming.some((file) => file.size > IMAGE_UPLOAD_MAX_BYTES)
    const next = incoming.filter((file) => !imageValidationError(file))
    if (invalidType) setNotice(t.invalidFile)
    else if (oversized) setNotice(t.fileTooLarge)
    setPartFiles((items) => {
      const available = Math.max(0, MAX_CHAT_PART_IMAGES - items.length)
      const accepted = next.slice(0, available)
      if (next.length > available) setNotice(t.partLimit)
      return [...items, ...accepted]
    })
    if (partInputRef.current) partInputRef.current.value = ""
  }

  const send = async (
    textOverride?: string,
    options: {
      contextMode?: "latest" | "original"
      contextConfirmed?: boolean
      partColorPolicyConfirmed?: boolean
      partColorPolicyCategory?: "hood" | "mirrors"
      partColorPolicy?: PartColorPolicy
      partColorPolicyChoicesJson?: string
      pending?: PendingContextChoice
    } = {},
  ) => {
    if (mobileSendBlocked) {
      blockMobileAccess()
      return
    }
    if (!authUser) {
      onAuthRequired?.()
      return
    }
    const vehicleToSend = options.pending ? options.pending.vehicleFile : vehicleFile
    const partFilesToSend = options.pending ? options.pending.partFiles : partFiles
    const dryRunToSend = options.pending ? options.pending.dryRun : dryRun
    const policyConfirmed = options.partColorPolicyConfirmed ?? options.pending?.partColorPolicyConfirmed
    const policyCategory = options.partColorPolicyCategory ?? options.pending?.partColorPolicyCategory
    const policy = options.partColorPolicy ?? options.pending?.partColorPolicy
    const policyChoicesJson = options.partColorPolicyChoicesJson ?? options.pending?.partColorPolicyChoicesJson
    if (!vehicleToSend && !hasSessionCanvas) {
      setNotice(t.missingVehicle)
      return
    }
    const rawText = options.pending ? options.pending.text : typeof textOverride === "string" ? textOverride : text
    const promptText = rawText.trim()
    const allowEmptyPrompt = Boolean(partFilesToSend.length > 0 && (vehicleToSend || hasSessionCanvas))
    if (!promptText && !allowEmptyPrompt) {
      setNotice(t.missingText)
      return
    }

    setIsGenerating(true)
    setGenerationProgress(null)
    setOptimisticMessage(options.contextConfirmed || policyConfirmed ? null : optimisticUserMessage(promptText || t.partsOnlyRequest, options.contextMode || contextMode, vehiclePreview, partPreviews))
    if (!options.pending) setText("")
    setNotice("")
    setSuggestionsOpen(false)
    if (!options.contextConfirmed) setPendingContextChoice(null)
    if (!policyConfirmed) setPendingPartColorPolicyChoice(null)
    const controller = new AbortController()
    requestAbortRef.current = controller
    try {
      const formData = new FormData()
      if (activeSessionId) formData.append("sessionId", activeSessionId)
      formData.append("text", promptText)
      formData.append("contextMode", options.contextMode || contextMode)
      if (options.contextConfirmed) formData.append("contextConfirmed", "1")
      if (policyConfirmed && policyCategory && policy) {
        formData.append("partColorPolicyConfirmed", "1")
        formData.append("partColorPolicyCategory", policyCategory)
        formData.append("partColorPolicy", policy)
      }
      if (policyChoicesJson) {
        formData.append("partColorPolicyConfirmed", "1")
        formData.append("partColorPolicyChoicesJson", policyChoicesJson)
      }
      formData.append("responseLanguage", language)
      formData.append("dryRun", dryRunToSend ? "1" : "0")
      formData.append("streamProgress", "1")
      if (vehicleToSend) formData.append("vehicleImage", vehicleToSend)
      partFilesToSend.forEach((file) => formData.append("partImages", file))
      const response = await fetch("/api/chat/messages", { method: "POST", body: formData, signal: controller.signal })
      const result = await readProgressResponse(response, setGenerationProgress)
      const body = result.body
      if (!result.ok) {
        if (result.status === 401) {
          onAuthRequired?.()
          return
        }
        if (result.status === 402) {
          onSubscribeRequired?.(body.billing)
          return
        }
        throw new Error(body.error || "Chat generation failed")
      }
      setMessages(body.messages)
      setOptimisticMessage(null)
      if (body.session?.id) setActiveSessionId(body.session.id)
      if (body.billing) onBillingChanged?.(body.billing)
      if (body.contextChoiceRequired) {
        const assistantMessage = [...(body.messages || [])].reverse().find((message: ChatMessage) => message.role === "assistant")
        setPendingContextChoice({
          text: promptText,
          vehicleFile: vehicleToSend,
          partFiles: partFilesToSend,
          dryRun: dryRunToSend,
          messageId: body.contextChoiceMessageId || assistantMessage?.id || "",
          partColorPolicyConfirmed: policyConfirmed,
          partColorPolicyCategory: policyCategory,
          partColorPolicy: policy,
          partColorPolicyChoicesJson: policyChoicesJson,
        })
        await loadSessions()
        return
      }
      if (body.partColorPolicyChoiceRequired) {
        const assistantMessage = [...(body.messages || [])].reverse().find((message: ChatMessage) => message.role === "assistant")
        const choices = normalizePartColorPolicyChoices(body)
        setPendingPartColorPolicyChoice({
          text: promptText,
          vehicleFile: vehicleToSend,
          partFiles: partFilesToSend,
          dryRun: dryRunToSend,
          messageId: body.partColorPolicyChoiceMessageId || assistantMessage?.id || "",
          choices,
          selections: {},
        })
        await loadSessions()
        return
      }
      setPendingContextChoice(null)
      setPendingPartColorPolicyChoice(null)
      setVehicleFile(null)
      setPartFiles([])
      await loadSessions()
    } catch (error) {
      setNotice((error as { name?: string }).name === "AbortError" ? t.canceled : error instanceof Error ? error.message : "Chat generation failed")
    } finally {
      if (requestAbortRef.current === controller) requestAbortRef.current = null
      setOptimisticMessage(null)
      setIsGenerating(false)
      setGenerationProgress(null)
    }
  }

  const cancelGeneration = () => {
    requestAbortRef.current?.abort()
    requestAbortRef.current = null
    setOptimisticMessage(null)
    setIsGenerating(false)
    setGenerationProgress(null)
    setNotice(t.canceled)
  }

  const regenerate = () => {
    if (mobileSendBlocked) {
      blockMobileAccess()
      return
    }
    const lastUser = [...messages].reverse().find((message) => message.role === "user")
    if (!lastUser) return
    setText(lastUser.content)
    void send(lastUser.content)
  }

  const chooseContext = (mode: "latest" | "original") => {
    if (mobileSendBlocked) {
      blockMobileAccess()
      return
    }
    if (!pendingContextChoice || isGenerating) return
    setContextMode(mode)
    void send(undefined, { contextMode: mode, contextConfirmed: true, pending: pendingContextChoice })
  }

  const choosePartColorPolicy = (categoryId: PartColorPolicyChoiceCategory, colorPolicy: PartColorPolicy) => {
    if (mobileSendBlocked) {
      blockMobileAccess()
      return
    }
    if (!pendingPartColorPolicyChoice || isGenerating) return
    const pending = pendingPartColorPolicyChoice
    const selections = { ...pending.selections, [categoryId]: colorPolicy }
    const complete = pending.choices.every((choice) => selections[choice.categoryId])
    if (!complete) {
      setPendingPartColorPolicyChoice({ ...pending, selections })
      return
    }
    const partColorPolicyChoicesJson = JSON.stringify(selections)
    const firstCategoryId = pending.choices[0]?.categoryId
    const firstPolicy = firstCategoryId ? selections[firstCategoryId] : undefined
    setPendingPartColorPolicyChoice(null)
    void send(undefined, {
      partColorPolicyConfirmed: true,
      partColorPolicyCategory: firstCategoryId,
      partColorPolicy: firstPolicy,
      partColorPolicyChoicesJson,
      pending: {
        ...pending,
        partColorPolicyConfirmed: true,
        partColorPolicyCategory: firstCategoryId,
        partColorPolicy: firstPolicy,
        partColorPolicyChoicesJson,
      },
    })
  }

  const applySuggestion = (prompt: string) => {
    if (mobileLoginBlocked) {
      blockMobileAccess()
      return
    }
    setText(prompt)
    setSuggestionsOpen(false)
  }

  const visibleMessages = optimisticMessage && !messages.some((message) => message.id === optimisticMessage.id) ? [...messages, optimisticMessage] : messages
  const generationStageText = generationProgress?.message || t.generating
  const generationRetryText = generationProgress?.retryAttempt ? (language === "zh" ? ` · 第 ${generationProgress.retryAttempt} 次重试` : ` · retry ${generationProgress.retryAttempt}`) : ""
  const generationStatusText = `${generationStageText} ${t.waiting} ${generationElapsedSeconds} ${t.seconds}${generationRetryText}`

  return (
    <section className="chat-mode-shell">
      <ChatHistorySidebar
        t={t}
        collapsed={sidebarCollapsed}
        setCollapsed={setSidebarCollapsed}
        mobileOpen={mobileSidebarOpen}
        setMobileOpen={setMobileSidebarOpen}
        query={query}
        setQuery={setQuery}
        pinned={pinned}
        recent={recent}
        activeSessionId={activeSessionId}
        onNewChat={createSession}
        onSelect={selectSession}
        onPin={togglePinSession}
        onDelete={deleteSession}
      />

      <main className="chat-workspace">
        <div className="chat-bg" />
        {!hideMobileMenu && (
          <button className="chat-mobile-menu" onClick={() => setMobileSidebarOpen(true)} aria-label="Open chat history">
            <Menu size={18} />
            {mobileVariant && <span>AI Mod Studio</span>}
          </button>
        )}

        <div className="chat-thread">
          {!visibleMessages.length && !isGenerating ? (
            <motion.div className={mobileVariant ? "chat-empty mobile-chat-empty" : "chat-empty"} initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}>
              {mobileVariant ? (
                <MobileChatEmptyVisual />
              ) : (
                <>
                  <div className="particle-orb" />
                  <h2>{t.headline}</h2>
                </>
              )}
            </motion.div>
          ) : (
            <div className="message-list">
              {visibleMessages.map((message) => (
                <MessageBubble
                  key={message.id}
                  message={message}
                  t={t}
                  onRegenerate={regenerate}
                  onPreview={setPreviewUrl}
                  contextChoice={pendingContextChoice?.messageId === message.id}
                  onChooseContext={chooseContext}
                  choosingContext={isGenerating}
                  partColorPolicyChoice={pendingPartColorPolicyChoice?.messageId === message.id}
                  partColorPolicyChoices={pendingPartColorPolicyChoice?.messageId === message.id ? pendingPartColorPolicyChoice.choices : []}
                  partColorPolicySelections={pendingPartColorPolicyChoice?.messageId === message.id ? pendingPartColorPolicyChoice.selections : {}}
                  onChoosePartColorPolicy={choosePartColorPolicy}
                />
              ))}
              {isGenerating && <LoadingBubble text={generationStatusText} />}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        <div className="chat-composer-wrap">
          <input ref={vehicleInputRef} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(event) => onVehicleFile(event.target.files?.[0])} />
          <input ref={partInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(event) => onPartFiles(event.target.files)} />

          <div className="chat-composer">
            <textarea
              value={text}
              onChange={(event) => {
                if (mobileLoginBlocked) return
                setText(event.target.value)
              }}
              onFocus={() => {
                if (mobileLoginBlocked) blockMobileAccess()
              }}
              readOnly={mobileLoginBlocked}
              placeholder={t.placeholder}
            />
            <div className="chat-composer-footer">
              <div className="chat-uploads-row">
                {vehiclePreview ? (
                  <span className="chat-upload-chip selected preview-only with-remove">
                    <button className="chat-preview-thumb-button" type="button" onClick={() => (mobileLoginBlocked ? blockMobileAccess() : setPreviewUrl(vehiclePreview))} aria-label={t.preview}>
                      <img className="chat-vehicle-thumb" src={canvasSafeImageUrl(vehiclePreview)} alt={t.vehicle} />
                    </button>
                    <button className="chat-chip-remove" type="button" onClick={() => (mobileLoginBlocked ? blockMobileAccess() : setVehicleFile(null))} aria-label="Remove vehicle photo">
                      <X size={12} />
                    </button>
                  </span>
                ) : (
                  <button className="chat-upload-chip vehicle-upload-chip" type="button" onClick={() => (mobileLoginBlocked ? blockMobileAccess() : vehicleInputRef.current?.click())} aria-label={t.attachVehicle}>
                    <Car size={15} />
                    <span className="vehicle-upload-label">{t.attachVehicle}</span>
                  </button>
                )}
                <button className="chat-upload-chip part-upload-chip" type="button" onClick={() => (mobileLoginBlocked ? blockMobileAccess() : partInputRef.current?.click())} aria-label={partFiles.length ? `${t.attachParts} ${partFiles.length}/${MAX_CHAT_PART_IMAGES}` : t.attachParts}>
                  <ImageIcon size={15} />
                  <span className="part-upload-label">
                    {t.attachParts} {partFiles.length ? `${partFiles.length}/${MAX_CHAT_PART_IMAGES}` : ""}
                  </span>
                </button>
                {partPreviews.map((preview) => (
                  <span className="chat-part-chip has-preview" key={preview.key}>
                    <button className="chat-part-preview-button" type="button" onClick={() => (mobileLoginBlocked ? blockMobileAccess() : setPreviewUrl(preview.url))} aria-label={`${t.preview} ${preview.name}`}>
                      <img src={preview.url} alt={preview.name} />
                    </button>
                    <button type="button" onClick={() => (mobileLoginBlocked ? blockMobileAccess() : setPartFiles((items) => items.filter((_, index) => index !== preview.index)))}>
                      <X size={12} />
                    </button>
                  </span>
                ))}
              </div>
              {!mobileVariant && (
                <button className="round" aria-label="Voice">
                  <Mic size={17} />
                </button>
              )}
              {isGenerating ? (
                <button className="round cancel" onClick={cancelGeneration} aria-label={t.cancel}>
                  <X size={17} />
                </button>
              ) : (
                <button className="round primary" onClick={() => void send()} aria-label={t.send}>
                  <ArrowUp size={18} />
                </button>
              )}
            </div>
          </div>

          <div className="chat-composer-tools-row">
            <div className="prompt-dropdown-wrap">
              <button className={suggestionsOpen ? "prompt-dropdown-trigger open" : "prompt-dropdown-trigger"} onClick={() => (mobileLoginBlocked ? blockMobileAccess() : setSuggestionsOpen((value) => !value))}>
                <Sparkles size={15} />
                {t.promptLabel}
                <ChevronDown size={15} />
              </button>
              <AnimatePresence initial={false}>
                {suggestionsOpen && (
                  <motion.div
                    className="prompt-dropdown-list"
                    initial={{ opacity: 0, y: -8, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: "auto" }}
                    exit={{ opacity: 0, y: -8, height: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    {suggestions.length ? (
                      suggestions.map((prompt) => (
                        <button key={prompt} onClick={() => applySuggestion(prompt)}>
                          {prompt}
                        </button>
                      ))
                    ) : (
                      <span>{t.promptEmpty}</span>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            <label className="chat-dry-run-toggle" title={t.dryRunHint}>
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(event) => {
                  if (mobileLoginBlocked) {
                    blockMobileAccess()
                    return
                  }
                  setDryRun(event.target.checked)
                }}
              />
              {t.dryRun}
            </label>
          </div>

          {(notice || (!mobileVariant && isGenerating)) && (
            <div className="chat-composer-status-stack">
              {notice && <div className="chat-notice">{notice}</div>}
              {!mobileVariant && isGenerating && <div className="chat-generating">{generationStatusText}</div>}
            </div>
          )}
        </div>
      </main>
      <AnimatePresence>
        {previewUrl && (
          <motion.div className="preview-lightbox" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPreviewUrl("")}>
            <button onClick={() => setPreviewUrl("")}>
              <X size={18} />
            </button>
            <img src={canvasSafeImageUrl(previewUrl)} alt={t.preview} />
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  )
}

function optimisticUserMessage(
  content: string,
  contextMode: "latest" | "original",
  vehiclePreview: string,
  partPreviews: Array<{ key: string; name: string; url: string; index: number }>,
): ChatMessage {
  const id = `optimistic_${Date.now()}`
  const now = Date.now()
  return {
    id,
    sessionId: "pending",
    role: "user",
    content,
    resultImageUrl: "",
    guardrailStatus: "pending",
    guardrailReason: "",
    contextMode,
    createdAt: now,
    attachments: [
      ...(vehiclePreview
        ? [
            {
              id: `${id}_vehicle`,
              messageId: id,
              type: "vehicle" as const,
              url: vehiclePreview,
              fileName: "vehicle",
              mime: "image/jpeg",
              size: 0,
              createdAt: now,
            },
          ]
        : []),
      ...partPreviews.map((preview) => ({
        id: `${id}_part_${preview.index}`,
        messageId: id,
        type: "part" as const,
        url: preview.url,
        fileName: preview.name,
        mime: "image/jpeg",
        size: 0,
        createdAt: now,
      })),
    ],
  }
}

function normalizePartColorPolicyChoices(body: Record<string, unknown>): PartColorPolicyChoiceRow[] {
  const rawChoices = Array.isArray(body.partColorPolicyChoices) ? body.partColorPolicyChoices : []
  const choices = rawChoices
    .map((item) => {
      if (!item || typeof item !== "object") return null
      const raw = item as Record<string, unknown>
      const categoryId = raw.categoryId === "mirrors" ? "mirrors" : raw.categoryId === "hood" ? "hood" : ""
      if (!categoryId) return null
      const options = Array.isArray(raw.options)
        ? raw.options
            .map((option) => {
              if (!option || typeof option !== "object") return null
              const optionRaw = option as Record<string, unknown>
              const colorPolicy = optionRaw.colorPolicy === "body_color" || optionRaw.colorPolicy === "exposed_carbon" ? optionRaw.colorPolicy : ""
              if (!colorPolicy) return null
              return {
                categoryId,
                colorPolicy,
                label: String(optionRaw.label || (colorPolicy === "body_color" ? "Body color" : "Exposed carbon")),
              }
            })
            .filter((option): option is PartColorPolicyChoiceRow["options"][number] => Boolean(option))
        : []
      return {
        categoryId,
        categoryLabel: String(raw.categoryLabel || (categoryId === "mirrors" ? "Mirrors" : "Hood")),
        options: options.length
          ? options
          : [
              { categoryId, colorPolicy: "body_color" as const, label: "Body color" },
              { categoryId, colorPolicy: "exposed_carbon" as const, label: "Exposed carbon" },
            ],
      }
    })
    .filter((choice): choice is PartColorPolicyChoiceRow => Boolean(choice))
  if (choices.length) return choices
  const categoryId = body.partColorPolicyCategory === "mirrors" ? "mirrors" : "hood"
  return [
    {
      categoryId,
      categoryLabel: categoryId === "mirrors" ? "Mirrors" : "Hood",
      options: [
        { categoryId, colorPolicy: "body_color", label: "Body color" },
        { categoryId, colorPolicy: "exposed_carbon", label: "Exposed carbon" },
      ],
    },
  ]
}

function MessageBubble({
  message,
  t,
  onRegenerate,
  onPreview,
  contextChoice = false,
  onChooseContext,
  choosingContext = false,
  partColorPolicyChoice = false,
  partColorPolicyChoices = [],
  partColorPolicySelections = {},
  onChoosePartColorPolicy,
}: {
  message: ChatMessage
  t: ChatCopy
  onRegenerate: () => void
  onPreview: (url: string) => void
  contextChoice?: boolean
  onChooseContext?: (mode: "latest" | "original") => void
  choosingContext?: boolean
  partColorPolicyChoice?: boolean
  partColorPolicyChoices?: PartColorPolicyChoiceRow[]
  partColorPolicySelections?: Partial<Record<PartColorPolicyChoiceCategory, PartColorPolicy>>
  onChoosePartColorPolicy?: (categoryId: PartColorPolicyChoiceCategory, colorPolicy: PartColorPolicy) => void
}) {
  const result = message.resultImageUrl || message.attachments.find((attachment) => attachment.type === "result")?.url
  return (
    <article className={message.role === "user" ? "message-bubble user" : "message-bubble assistant"}>
      <div className="message-avatar">{message.role === "user" ? <Car size={17} /> : <Bot size={17} />}</div>
      <div className="message-body">
        {message.content && <p>{message.content}</p>}
        {message.guardrailStatus === "blocked" && <small>{message.guardrailReason}</small>}
        {message.attachments.some((attachment) => attachment.type !== "result") && (
          <div className="message-attachments">
            {message.attachments
              .filter((attachment) => attachment.type !== "result")
              .map((attachment) => (
                <button key={attachment.id} className="message-attachment-thumb" type="button" onClick={() => onPreview(attachment.url)}>
                  <ChatImageWithFallback src={attachment.url} alt={attachment.fileName} label={t.imageUnavailable} compact />
                </button>
              ))}
          </div>
        )}
        {result && (
          <div className="chat-result-card">
            <button className="chat-result-image-button" type="button" onClick={() => onPreview(result)}>
              <ChatImageWithFallback src={result} alt="Generated car render" label={t.imageUnavailable} />
            </button>
            <div>
              <button onClick={onRegenerate}>
                <Sparkles size={15} />
                {t.regenerate}
              </button>
              <button type="button" onClick={() => void downloadImageAsset(result, `ai-mod-chat-result-${message.id}${imageExtensionFromUrl(result)}`)}>
                <ArrowDownToLine size={15} />
                {t.download}
              </button>
            </div>
          </div>
        )}
        {contextChoice && (
          <div className="context-choice-actions">
            <button type="button" disabled={choosingContext} onClick={() => onChooseContext?.("original")}>
              {t.originalContext}
            </button>
            <button type="button" disabled={choosingContext} onClick={() => onChooseContext?.("latest")}>
              {t.latest}
            </button>
          </div>
        )}
        {partColorPolicyChoice && partColorPolicyChoices.length > 0 && (
          <div className="part-color-policy-chat-choices">
            {partColorPolicyChoices.map((choice) => (
              <div className="part-color-policy-chat-row" key={choice.categoryId}>
                <span>{choice.categoryLabel}</span>
                <div className="context-choice-actions">
                  {choice.options.map((option) => (
                    <button
                      type="button"
                      key={`${choice.categoryId}-${option.colorPolicy}`}
                      className={partColorPolicySelections[choice.categoryId] === option.colorPolicy ? "selected" : ""}
                      disabled={choosingContext}
                      onClick={() => onChoosePartColorPolicy?.(choice.categoryId, option.colorPolicy)}
                    >
                      {option.label || (option.colorPolicy === "body_color" ? t.bodyColor : t.exposedCarbon)}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </article>
  )
}

function ChatImageWithFallback({ src, alt, label, compact = false }: { src: string; alt: string; label: string; compact?: boolean }) {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [src])

  if (failed) {
    return (
      <span className={compact ? "chat-image-fallback compact" : "chat-image-fallback"} role="img" aria-label={alt}>
        <ImageOff size={compact ? 14 : 20} />
        <span>{label}</span>
      </span>
    )
  }

  return <img src={canvasSafeImageUrl(src)} alt={alt} onError={() => setFailed(true)} />
}

function LoadingBubble({ text }: { text: string }) {
  return (
    <article className="message-bubble assistant loading">
      <div className="message-avatar">
        <Bot size={17} />
      </div>
      <div className="message-body">
        <p>{text}</p>
        <span className="loading-dots" aria-hidden="true">
          <i />
          <i />
          <i />
        </span>
      </div>
    </article>
  )
}

function ChatHistorySidebar({
  t,
  collapsed,
  setCollapsed,
  mobileOpen,
  setMobileOpen,
  query,
  setQuery,
  pinned,
  recent,
  activeSessionId,
  onNewChat,
  onSelect,
  onPin,
  onDelete,
}: {
  t: ChatCopy
  collapsed: boolean
  setCollapsed: (value: boolean) => void
  mobileOpen: boolean
  setMobileOpen: (value: boolean) => void
  query: string
  setQuery: (value: string) => void
  pinned: ChatSession[]
  recent: ChatSession[]
  activeSessionId: string
  onNewChat: () => void
  onSelect: (id: string) => void
  onPin: (session: ChatSession) => void
  onDelete: (session: ChatSession) => void
}) {
  const isMobileDrawer = mobileOpen
  const effectiveCollapsed = isMobileDrawer ? false : collapsed

  const handleSidebarToggle = () => {
    if (isMobileDrawer) {
      setMobileOpen(false)
      return
    }
    setCollapsed(!collapsed)
  }

  const handleNewChat = () => {
    onNewChat()
    if (isMobileDrawer) setMobileOpen(false)
  }

  const handleSelect = (id: string) => {
    onSelect(id)
    if (isMobileDrawer) setMobileOpen(false)
  }

  const sidebar = (
    <motion.aside
      className={effectiveCollapsed ? "chat-history-sidebar collapsed" : "chat-history-sidebar"}
      initial={false}
      animate={isMobileDrawer ? false : { width: effectiveCollapsed ? 88 : 320 }}
      transition={{ type: "spring", stiffness: 260, damping: 32, mass: 0.86 }}
    >
      <div className={effectiveCollapsed ? "chat-history-head collapsed" : "chat-history-head"}>
        <div className="assistant-mark">*</div>
        {!effectiveCollapsed && <strong>{t.assistant}</strong>}
        <button onClick={handleSidebarToggle} aria-label={isMobileDrawer ? "Close chat history" : "Toggle chat history"}>
          {isMobileDrawer ? <X size={19} /> : effectiveCollapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
        </button>
      </div>

      <AnimatePresence initial={false} mode="wait">
        {!effectiveCollapsed ? (
          <motion.div
            key="expanded"
            className="chat-sidebar-expanded"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.18 }}
          >
            <label className="chat-search">
              <Search size={18} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t.search} />
            </label>
            <button className="new-chat-button" onClick={handleNewChat}>
              <Plus size={18} />
              {t.newChat}
            </button>
            <div className="chat-history-scroll">
              <ChatSection title={t.pinned} icon={<Star size={16} />} sessions={pinned} activeSessionId={activeSessionId} onSelect={handleSelect} onPin={onPin} onDelete={onDelete} emptyText={t.emptyHistory} deleteLabel={t.deleteChat} />
              <ChatSection title={t.recent} icon={<Clock size={16} />} sessions={recent} activeSessionId={activeSessionId} onSelect={handleSelect} onPin={onPin} onDelete={onDelete} emptyText={t.emptyHistory} deleteLabel={t.deleteChat} />
            </div>
            <div className="chat-user-card">
              <div>AM</div>
              <span>
                <strong>AI Mod Studio</strong>
                <small>{t.workspace}</small>
              </span>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="collapsed"
            className="collapsed-actions"
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }}
            transition={{ duration: 0.16 }}
          >
            <button onClick={handleNewChat} aria-label={t.newChat}>
              <Plus size={20} />
            </button>
            <button aria-label={t.search} onClick={() => setCollapsed(false)}>
              <Search size={20} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  )

  return (
    <>
      <div className="desktop-chat-sidebar">{sidebar}</div>
      <AnimatePresence>
        {mobileOpen && (
          <>
            <div className="chat-mobile-overlay" onClick={() => setMobileOpen(false)} />
            <motion.div
              className="chat-mobile-drawer"
              initial={{ x: "-105%" }}
              animate={{ x: 0 }}
              exit={{ x: "-105%" }}
              transition={{ duration: 0.23, ease: [0.22, 1, 0.36, 1] }}
              style={{ willChange: "transform" }}
            >
              {sidebar}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

function ChatSection({
  title,
  icon,
  sessions,
  activeSessionId,
  onSelect,
  onPin,
  onDelete,
  emptyText,
  deleteLabel,
}: {
  title: string
  icon: React.ReactNode
  sessions: ChatSession[]
  activeSessionId: string
  onSelect: (id: string) => void
  onPin: (session: ChatSession) => void
  onDelete: (session: ChatSession) => void
  emptyText: string
  deleteLabel: string
}) {
  const [open, setOpen] = useState(true)
  const sectionHeight = sessions.length ? sessions.length * 76 + 8 : 46
  return (
    <section className={open ? "history-section open" : "history-section"}>
      <button className="history-section-title" onClick={() => setOpen((value) => !value)}>
        <ChevronDown className={open ? "" : "closed"} size={14} />
        {icon}
        {title}
      </button>
      <div
        className="history-section-body"
        aria-hidden={!open}
        style={{ "--history-section-height": `${sectionHeight}px` } as React.CSSProperties}
      >
        <div className="history-section-body-inner">
          {sessions.length ? (
            sessions.map((session) => (
              <div key={session.id} className={session.id === activeSessionId ? "chat-row active" : "chat-row"}>
                <button className="chat-row-main" type="button" onClick={() => onSelect(session.id)}>
                  <strong>{session.title}</strong>
                  <span>{session.messageCount} messages</span>
                </button>
                <button className={session.pinned ? "chat-pin active" : "chat-pin"} type="button" onClick={() => onPin(session)} aria-label={session.pinned ? "Unpin chat" : "Pin chat"}>
                  <Star size={14} />
                </button>
                <button className="chat-delete" type="button" onClick={() => onDelete(session)} aria-label={deleteLabel}>
                  <X size={14} />
                </button>
              </div>
            ))
          ) : (
            <div className="empty-history">{emptyText}</div>
          )}
        </div>
      </div>
    </section>
  )
}

function imageValidationError(file: File): "invalidFile" | "fileTooLarge" | "" {
  if (!isAllowedImageMimeType(file.type)) return "invalidFile"
  if (file.size > IMAGE_UPLOAD_MAX_BYTES) return "fileTooLarge"
  return ""
}

function fileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`
}
