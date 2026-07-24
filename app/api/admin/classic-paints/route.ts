import { NextResponse } from "next/server"
import { classicPaints, upsertClassicPaint } from "@/lib/server/db"
import { authErrorResponse, requireAdminUser } from "@/lib/server/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    requireAdminUser()
    return NextResponse.json({ classicPaints: classicPaints() })
  } catch (error) {
    return authErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    requireAdminUser()
    const body = await request.json()
    const paint = upsertClassicPaint({
      id: typeof body.id === "string" ? body.id : undefined,
      brand: String(body.brand || ""),
      label: String(body.label || ""),
      labelZh: String(body.labelZh || ""),
      labelEn: String(body.labelEn || ""),
      brandAliases: Array.isArray(body.brandAliases) ? body.brandAliases : typeof body.brandAliases === "string" ? body.brandAliases.split(/[\n,，、;；]+/) : undefined,
      colorCode: String(body.colorCode || ""),
      hex: String(body.hex || ""),
      material: body.material,
      prompt: String(body.prompt || ""),
      active: body.active === undefined ? undefined : Boolean(body.active),
      isDefault: body.isDefault === undefined ? undefined : Boolean(body.isDefault),
      sortOrder: body.sortOrder === undefined ? undefined : Number(body.sortOrder),
    })
    return NextResponse.json(paint, { status: 201 })
  } catch (error) {
    return (error as { status?: number }).status
      ? authErrorResponse(error)
      : NextResponse.json({ error: error instanceof Error ? error.message : "Classic paint save failed" }, { status: 400 })
  }
}
