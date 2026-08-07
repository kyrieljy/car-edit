import { NextResponse } from "next/server"
import { authErrorResponse, requireAdminUser } from "@/lib/server/auth"
import { getAdminTestConfig, saveAdminTestConfig } from "@/lib/server/db"
import type { PartSelectionOptions, SaveAdminTestConfigInput, SelectionMap } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** GET /api/admin/test-config — return the global admin test fixture (or null if never saved). */
export async function GET() {
  try {
    requireAdminUser()
    const config = getAdminTestConfig()
    return NextResponse.json({ config })
  } catch (error) {
    return (error as { status?: number }).status ? authErrorResponse(error) : NextResponse.json({ error: error instanceof Error ? error.message : "Failed to read test config" }, { status: 400 })
  }
}

/**
 * PUT /api/admin/test-config — persist the global admin test fixture.
 * The original vehicle image is uploaded separately via /api/admin/uploads and referenced
 * here by URL + upload id, mirroring the config-mode generation input shape.
 */
export async function PUT(request: Request) {
  try {
    requireAdminUser()
    const body = await request.json()
    const sourceImageUrl = String(body.sourceImageUrl || "")
    const selections = (body.selections ?? {}) as SelectionMap
    const selectionOptions = (body.selectionOptions ?? {}) as PartSelectionOptions

    if (!sourceImageUrl) {
      return NextResponse.json({ error: "请先在测试配件设置中上传原车图。" }, { status: 400 })
    }
    if (!selections || Object.keys(selections).length === 0) {
      return NextResponse.json({ error: "请至少选择一个配件后再保存测试配件设置。" }, { status: 400 })
    }

    const input: SaveAdminTestConfigInput = {
      vehicleUploadId: String(body.vehicleUploadId || ""),
      sourceImageUrl,
      displayVehicleModel: body.displayVehicleModel ? String(body.displayVehicleModel) : undefined,
      paintId: String(body.paintId || "factory"),
      paintFinishEffect: String(body.paintFinishEffect || "gloss"),
      gradientPaint: body.gradientPaint ?? null,
      customPaint: body.customPaint ?? null,
      stance: Number(body.stance || 0),
      selections,
      selectionOptions,
    }
    const config = saveAdminTestConfig(input)
    return NextResponse.json({ config })
  } catch (error) {
    return (error as { status?: number }).status ? authErrorResponse(error) : NextResponse.json({ error: error instanceof Error ? error.message : "Failed to save test config" }, { status: 400 })
  }
}
