import { NextResponse } from "next/server"
import { deleteCategory, updateCategory } from "@/lib/server/db"
import { authErrorResponse, requireAdminUser } from "@/lib/server/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function PATCH(request: Request, context: { params: { id: string } }) {
  try {
    requireAdminUser()
    const body = await request.json()
    const category = updateCategory(context.params.id, {
      labelEn: typeof body.labelEn === "string" ? body.labelEn : typeof body.label === "string" ? body.label : undefined,
      labelZh: typeof body.labelZh === "string" ? body.labelZh : undefined,
      description: typeof body.description === "string" ? body.description : undefined,
      sortOrder: body.sortOrder === undefined ? undefined : Number(body.sortOrder),
      aliases: Array.isArray(body.aliases) ? body.aliases.map((item: unknown) => String(item)) : undefined,
      chatEnabled: body.chatEnabled === undefined ? undefined : Boolean(body.chatEnabled),
      referenceHighRisk: body.referenceHighRisk === undefined ? undefined : Boolean(body.referenceHighRisk),
    })
    return NextResponse.json(category)
  } catch (error) {
    return (error as { status?: number }).status
      ? authErrorResponse(error)
      : NextResponse.json({ error: error instanceof Error ? error.message : "Category update failed" }, { status: 400 })
  }
}

export async function DELETE(_request: Request, context: { params: { id: string } }) {
  try {
    requireAdminUser()
    return NextResponse.json(deleteCategory(context.params.id))
  } catch (error) {
    return (error as { status?: number }).status
      ? authErrorResponse(error)
      : NextResponse.json({ error: error instanceof Error ? error.message : "Category delete failed" }, { status: 400 })
  }
}
