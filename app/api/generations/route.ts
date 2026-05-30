import { NextResponse } from "next/server"
import { authErrorResponse, requireUser } from "@/lib/server/auth"
import { buildConfigStandardJson } from "@/lib/generation-core"
import { checkAndConsumeEntitlement, createVehicleUpload, getCatalog, refundEntitlementUsage } from "@/lib/server/db"
import { runGenerationWorkflow } from "@/lib/server/generation-engine"
import { runMockGuardrail } from "@/lib/server/guardrail"
import { writeVehicleUploadImage } from "@/lib/server/local-images"
import { ndjsonProgressResponse, noopProgress, type ProgressEmitter, type ProgressLanguage } from "@/lib/server/progress-stream"
import { paintFromId } from "@/lib/prompts"
import type { PaintFinishEffect, PaintGradient, PaintOption, PartColorPolicy, PartSelectionOptions, SelectionMap } from "@/lib/types"
import { validateImageUpload } from "@/lib/upload-limits"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  const formData = await request.formData()
  const responseLanguage: ProgressLanguage = String(formData.get("responseLanguage") || "en") === "zh" ? "zh" : "en"
  const streamProgress = String(formData.get("streamProgress") || "") === "1"
  if (streamProgress) {
    return ndjsonProgressResponse((emit) => handleGenerationPost(formData, emit), responseLanguage)
  }
  return handleGenerationPost(formData, noopProgress)
}

async function handleGenerationPost(formData: FormData, emitProgress: ProgressEmitter) {
  let consumedEntitlement = false
  let consumedUserId = ""
  try {
    const user = requireUser()
    const file = formData.get("vehicleImage")
    emitProgress({ step: "upload_validation" })
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "vehicleImage is required" }, { status: 400 })
    }
    const uploadValidation = validateImageUpload(file, "vehicleImage")
    if (!uploadValidation.ok) {
      return NextResponse.json({ error: uploadValidation.error }, { status: uploadValidation.status })
    }

    const paintId = String(formData.get("paintId") || "factory")
    const stance = clamp(Number(formData.get("stance") || 0), 0, 100)
    const vehicleNote = String(formData.get("vehicleNote") || "")
    const detectedVehicleModel = normalizeVehicleModel(String(formData.get("detectedVehicleModel") || ""))
    emitProgress({ step: "canvas_resolve" })
    const selections = parseSelections(String(formData.get("selections") || "{}"))
    const selectionOptions = parseSelectionOptions(String(formData.get("selectionOptions") || "{}"))
    const catalog = getCatalog()
    const requestedPaintFinishEffect = parsePaintFinishEffect(formData.get("paintFinishEffect"))
    const paintFinishEffect = requestedPaintFinishEffect === "gradient" || paintId === "custom" ? requestedPaintFinishEffect : "gloss"
    const gradientPaint = paintFinishEffect === "gradient" ? parseGradientPaint(formData.get("gradientPaintJson")) : null
    if (gradientPaint && !gradientPaint.ok) {
      return NextResponse.json({ error: gradientPaint.error }, { status: 400 })
    }
    const customPaint = paintId === "custom" && paintFinishEffect !== "gradient" ? parseCustomPaintOption(formData.get("customPaintJson")) : null
    if (customPaint && !customPaint.ok) {
      return NextResponse.json({ error: customPaint.error }, { status: 400 })
    }
    const selectedPaint = customPaint?.paint ?? paintFromId(paintId, catalog.paints)
    const selectedIds = new Set(Object.values(selections))
    const hasSelectedAssets = catalog.assets.some((asset) => selectedIds.has(asset.id))
    const hasPaintChange = paintFinishEffect === "gradient" || paintFinishEffect !== "gloss" || selectedPaint.id !== "factory"
    if (!hasSelectedAssets && !hasPaintChange && stance === 0) {
      return NextResponse.json({ error: "Select at least one part, body color, or stance change." }, { status: 400 })
    }
    const guardrail = runMockGuardrail({
      hasVehicleImage: true,
      text: `car modification render ${vehicleNote}`.trim(),
      fileTypes: [file.type],
    })
    emitProgress({ step: "guardrail" })
    if (!guardrail.allowed) {
      return NextResponse.json({ error: guardrail.reason }, { status: 400 })
    }

    const conflict = findConflict(selections, catalog.assets)
    if (conflict) {
      return NextResponse.json({ error: `Category ${conflict} has conflicting selected assets.` }, { status: 409 })
    }
    emitProgress({ step: "entitlement" })
    const entitlement = checkAndConsumeEntitlement(user.id, "config")
    if (!entitlement.allowed) {
      return NextResponse.json({ error: entitlement.reason, billing: entitlement.status, code: "subscription_required" }, { status: 402 })
    }
    consumedEntitlement = true
    consumedUserId = user.id

    emitProgress({ step: "save_source" })
    const upload = await saveUpload(file)
    const storedUpload = createVehicleUpload({
      userId: user.id,
      fileName: file.name,
      url: upload.url,
      mime: file.type,
      size: file.size,
    })
    emitProgress({ step: "standard_json" })
    const standardJson = buildConfigStandardJson({
      sourceImageUrl: upload.url,
      selections,
      assets: catalog.assets,
      categories: catalog.categories,
      selectionOptions,
      paint: selectedPaint,
      paintFinishEffect,
      paintGradient: gradientPaint?.ok ? gradientPaint.gradient : undefined,
      stance,
      vehicleNote,
      vehicleModel: detectedVehicleModel || normalizeVehicleModel(vehicleNote),
    })
    const job = await runGenerationWorkflow({
      userId: user.id,
      mode: "config",
      vehicleUploadId: storedUpload.id,
      sourceImageUrl: upload.url,
      standardJson,
      paintId: paintFinishEffect === "gradient" ? "gradient" : selectedPaint.id,
      stance,
      selections,
      selectionOptions,
      onProgress: emitProgress,
    })
    if (job.status === "failed") {
      refundConfigEntitlement(consumedUserId)
      consumedEntitlement = false
      return NextResponse.json({ error: job.failureReason || "生图失败。", job }, { status: 502 })
    }

    return NextResponse.json(job, { status: 201 })
  } catch (error) {
    if (consumedEntitlement) refundConfigEntitlement(consumedUserId)
    if ((error as { status?: number }).status) return authErrorResponse(error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Generation failed" }, { status: 500 })
  }
}

function refundConfigEntitlement(userId: string) {
  if (!userId) return
  try {
    refundEntitlementUsage(userId, "config")
  } catch {
    // Keep the original generation error response if usage rollback fails.
  }
}

function parseSelections(value: string): SelectionMap {
  const parsed = JSON.parse(value) as unknown
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
  return Object.fromEntries(
    Object.entries(parsed as Record<string, unknown>)
      .filter(([, assetId]) => typeof assetId === "string" && assetId)
      .map(([categoryId, assetId]) => [categoryId, String(assetId)]),
  )
}

function parseSelectionOptions(value: string): PartSelectionOptions {
  const parsed = JSON.parse(value) as unknown
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
  return Object.fromEntries(
    Object.entries(parsed as Record<string, unknown>)
      .map(([categoryId, options]) => {
        if (!options || typeof options !== "object" || Array.isArray(options)) return undefined
        const colorPolicy = (options as { colorPolicy?: unknown }).colorPolicy
        if (!isPartColorPolicy(colorPolicy)) return undefined
        return [categoryId, { colorPolicy }] as const
      })
      .filter((entry): entry is readonly [string, { colorPolicy: PartColorPolicy }] => Boolean(entry)),
  )
}

function isPartColorPolicy(value: unknown): value is PartColorPolicy {
  return value === "body_color" || value === "exposed_carbon" || value === "part_reference_color"
}

function parsePaintFinishEffect(value: FormDataEntryValue | null): PaintFinishEffect {
  const effect = String(value || "gloss").trim()
  return isPaintFinishEffect(effect) ? effect : "gloss"
}

function isPaintFinishEffect(value: string): value is PaintFinishEffect {
  return value === "gloss" || value === "metallic" || value === "matte" || value === "satin" || value === "pearl" || value === "chrome" || value === "gradient"
}

function parseGradientPaint(value: FormDataEntryValue | null): { ok: true; gradient: PaintGradient } | { ok: false; error: string } {
  if (typeof value !== "string" || !value.trim()) {
    return { ok: false, error: "gradientPaintJson is required when paintFinishEffect=gradient." }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    return { ok: false, error: "gradientPaintJson must be valid JSON." }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "gradientPaintJson must be an object." }
  }
  const raw = parsed as Record<string, unknown>
  const fromHex = normalizeHexColor(raw.fromHex)
  const toHex = normalizeHexColor(raw.toHex)
  if (!fromHex || !toHex) {
    return { ok: false, error: "gradientPaintJson.fromHex and gradientPaintJson.toHex must be valid #RRGGBB colors." }
  }
  if (String(raw.direction || "front_to_rear") !== "front_to_rear") {
    return { ok: false, error: "gradientPaintJson.direction must be front_to_rear." }
  }
  return { ok: true, gradient: { fromHex, toHex, direction: "front_to_rear" } }
}

function parseCustomPaintOption(value: FormDataEntryValue | null): { ok: true; paint: PaintOption } | { ok: false; error: string } {
  if (typeof value !== "string" || !value.trim()) {
    return { ok: false, error: "customPaintJson is required when paintId=custom." }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(value)
  } catch {
    return { ok: false, error: "customPaintJson must be valid JSON." }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, error: "customPaintJson must be an object." }
  }
  const raw = parsed as Record<string, unknown>
  const hex = normalizeHexColor(raw.hex)
  if (!hex) return { ok: false, error: "customPaintJson.hex must be a valid #RRGGBB color." }
  const rgbFromHex = rgbFromHexColor(hex)
  const rgb = normalizeRgbValue(raw.rgb, rgbFromHex)
  if (!rgb) return { ok: false, error: "customPaintJson.rgb must be RGB values between 0 and 255." }
  if (rgb.r !== rgbFromHex.r || rgb.g !== rgbFromHex.g || rgb.b !== rgbFromHex.b) {
    return { ok: false, error: "customPaintJson.rgb must match customPaintJson.hex." }
  }
  const rgbText = `${rgb.r},${rgb.g},${rgb.b}`
  const label = `Custom ${hex}`
  return {
    ok: true,
    paint: {
      id: "custom",
      label,
      hex,
      prompt: [
        `Change only the vehicle body paint to ${label} / RGB(${rgbText}).`,
        "Preserve the source vehicle identity, body shape, panel gaps, headlights, glass, wheels, tires, license plate shape, black plastic trim, carbon fiber parts, grille, rear wing or spoiler, camera angle, lighting, and background.",
        "Do not tint glass, lights, wheels, tires, license plate, black plastic trim, carbon fiber parts, grille, rear wing or spoiler, ground, nearby cars, or the background with the requested body color.",
      ].join(" "),
    },
  }
}

function normalizeHexColor(value: unknown) {
  const raw = String(value || "").trim()
  const match = raw.match(/^#?([0-9a-f]{6})$/i)
  return match ? `#${match[1].toUpperCase()}` : ""
}

function rgbFromHexColor(hex: string) {
  const value = hex.replace("#", "")
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  }
}

function normalizeRgbValue(value: unknown, fallback: { r: number; g: number; b: number }) {
  if (value === undefined || value === null || value === "") return fallback
  const parts = Array.isArray(value) ? value : String(value).split(",")
  if (parts.length !== 3) return null
  const [r, g, b] = parts.map((part) => Number(part))
  if (![r, g, b].every((part) => Number.isInteger(part) && part >= 0 && part <= 255)) return null
  return { r, g, b }
}

function findConflict(selections: SelectionMap, assets: Array<{ id: string; categoryId: string }>) {
  const selectedIds = new Set(Object.values(selections))
  const counts = new Map<string, number>()
  assets.forEach((asset) => {
    if (!selectedIds.has(asset.id)) return
    counts.set(asset.categoryId, (counts.get(asset.categoryId) || 0) + 1)
  })
  return Array.from(counts.entries()).find(([, count]) => count > 1)?.[0]
}

function normalizeVehicleModel(value: string) {
  const model = value.replace(/\s+/g, " ").trim()
  if (!model) return ""
  const normalized = model.toLowerCase()
  const placeholders = new Set([
    "unknown",
    "n/a",
    "na",
    "none",
    "null",
    "vehicle model pending",
    "user uploaded vehicle, preserve exact identity",
    "车型待识别",
    "待识别",
    "未知",
    "未识别",
  ])
  return placeholders.has(normalized) || placeholders.has(model) ? "" : model
}

async function saveUpload(file: File) {
  const ext = file.type === "image/png" ? ".png" : file.type === "image/webp" ? ".webp" : ".jpg"
  const fileName = `vehicle-${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`
  const relativeUrl = `/uploads/${fileName}`
  await writeVehicleUploadImage(fileName, Buffer.from(await file.arrayBuffer()))
  return { url: relativeUrl }
}

function clamp(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, value))
}
