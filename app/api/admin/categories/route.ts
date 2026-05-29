import { NextResponse } from "next/server"
import { createCategory, reorderCategories } from "@/lib/server/db"
import { authErrorResponse, requireAdminUser } from "@/lib/server/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    requireAdminUser()
    const body = await request.json()
    const category = createCategory({
      id: typeof body.id === "string" ? body.id : undefined,
      labelEn: String(body.labelEn || body.label || ""),
      labelZh: String(body.labelZh || ""),
      description: String(body.description || ""),
      sortOrder: body.sortOrder === undefined ? undefined : Number(body.sortOrder),
      aliases: Array.isArray(body.aliases) ? body.aliases.map((item: unknown) => String(item)) : undefined,
      chatEnabled: body.chatEnabled === undefined ? undefined : Boolean(body.chatEnabled),
      referenceHighRisk: body.referenceHighRisk === undefined ? undefined : Boolean(body.referenceHighRisk),
    })
    return NextResponse.json(category, { status: 201 })
  } catch (error) {
    return (error as { status?: number }).status
      ? authErrorResponse(error)
      : NextResponse.json({ error: error instanceof Error ? error.message : "Category create failed" }, { status: 400 })
  }
}

export async function PATCH(request: Request) {
  try {
    requireAdminUser()
    const body = await request.json()
    const orderedIds = Array.isArray(body.orderedIds) ? body.orderedIds.map((id: unknown) => String(id)) : []
    return NextResponse.json({ categories: reorderCategories(orderedIds) })
  } catch (error) {
    return (error as { status?: number }).status
      ? authErrorResponse(error)
      : NextResponse.json({ error: error instanceof Error ? error.message : "Category reorder failed" }, { status: 400 })
  }
}
