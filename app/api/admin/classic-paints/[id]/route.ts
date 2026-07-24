import { NextResponse } from "next/server"
import { deleteClassicPaint, updateClassicPaint } from "@/lib/server/db"
import { authErrorResponse, requireAdminUser } from "@/lib/server/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    requireAdminUser()
    const body = await request.json()
    const paint = updateClassicPaint(params.id, {
      brand: typeof body.brand === "string" ? body.brand : undefined,
      label: typeof body.label === "string" ? body.label : undefined,
      labelZh: typeof body.labelZh === "string" ? body.labelZh : undefined,
      labelEn: typeof body.labelEn === "string" ? body.labelEn : undefined,
      brandAliases: Array.isArray(body.brandAliases) ? body.brandAliases : typeof body.brandAliases === "string" ? body.brandAliases.split(/[\n,，、;；]+/) : undefined,
      colorCode: typeof body.colorCode === "string" ? body.colorCode : undefined,
      hex: typeof body.hex === "string" ? body.hex : undefined,
      material: body.material,
      prompt: typeof body.prompt === "string" ? body.prompt : undefined,
      active: body.active === undefined ? undefined : Boolean(body.active),
      isDefault: body.isDefault === undefined ? undefined : Boolean(body.isDefault),
      sortOrder: body.sortOrder === undefined ? undefined : Number(body.sortOrder),
    })
    return NextResponse.json(paint)
  } catch (error) {
    return (error as { status?: number }).status
      ? authErrorResponse(error)
      : NextResponse.json({ error: error instanceof Error ? error.message : "Classic paint update failed" }, { status: 400 })
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    requireAdminUser()
    deleteClassicPaint(params.id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    return (error as { status?: number }).status
      ? authErrorResponse(error)
      : NextResponse.json({ error: error instanceof Error ? error.message : "Classic paint delete failed" }, { status: 400 })
  }
}
