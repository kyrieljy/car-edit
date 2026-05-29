import { NextResponse } from "next/server"
import { createBrand, reorderBrands } from "@/lib/server/db"
import { authErrorResponse, requireAdminUser } from "@/lib/server/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    requireAdminUser()
    const body = await request.json()
    const brand = createBrand({
      id: typeof body.id === "string" ? body.id : undefined,
      categoryId: String(body.categoryId || ""),
      label: String(body.label || ""),
      sortOrder: body.sortOrder === undefined ? undefined : Number(body.sortOrder),
      active: body.active === undefined ? undefined : Boolean(body.active),
    })
    return NextResponse.json(brand, { status: 201 })
  } catch (error) {
    return (error as { status?: number }).status
      ? authErrorResponse(error)
      : NextResponse.json({ error: error instanceof Error ? error.message : "Brand create failed" }, { status: 400 })
  }
}

export async function PATCH(request: Request) {
  try {
    requireAdminUser()
    const body = await request.json()
    const orderedIds = Array.isArray(body.orderedIds) ? body.orderedIds.map((id: unknown) => String(id)) : []
    return NextResponse.json({ brands: reorderBrands(String(body.categoryId || ""), orderedIds) })
  } catch (error) {
    return (error as { status?: number }).status
      ? authErrorResponse(error)
      : NextResponse.json({ error: error instanceof Error ? error.message : "Brand reorder failed" }, { status: 400 })
  }
}
