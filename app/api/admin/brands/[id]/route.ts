import { NextResponse } from "next/server"
import { deleteBrand, updateBrand } from "@/lib/server/db"
import { authErrorResponse, requireAdminUser } from "@/lib/server/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function PATCH(request: Request, context: { params: { id: string } }) {
  try {
    requireAdminUser()
    const body = await request.json()
    const brand = updateBrand(context.params.id, {
      categoryId: typeof body.categoryId === "string" ? body.categoryId : undefined,
      label: typeof body.label === "string" ? body.label : undefined,
      sortOrder: body.sortOrder === undefined ? undefined : Number(body.sortOrder),
      active: body.active === undefined ? undefined : Boolean(body.active),
    })
    return NextResponse.json(brand)
  } catch (error) {
    return (error as { status?: number }).status
      ? authErrorResponse(error)
      : NextResponse.json({ error: error instanceof Error ? error.message : "Brand update failed" }, { status: 400 })
  }
}

export async function DELETE(_request: Request, context: { params: { id: string } }) {
  try {
    requireAdminUser()
    return NextResponse.json(deleteBrand(context.params.id))
  } catch (error) {
    return (error as { status?: number }).status
      ? authErrorResponse(error)
      : NextResponse.json({ error: error instanceof Error ? error.message : "Brand delete failed" }, { status: 400 })
  }
}
