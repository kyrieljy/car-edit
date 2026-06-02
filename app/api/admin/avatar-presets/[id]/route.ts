import { NextResponse } from "next/server"
import { authErrorResponse, requireAdminUser } from "@/lib/server/auth"
import { deleteAvatarPreset, updateAvatarPreset } from "@/lib/server/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function PATCH(request: Request, context: { params: { id: string } }) {
  try {
    requireAdminUser()
    const body = await request.json()
    const avatar = updateAvatarPreset(context.params.id, {
      label: typeof body.label === "string" ? body.label : undefined,
      imageUrl: typeof body.imageUrl === "string" ? body.imageUrl : undefined,
      active: typeof body.active === "boolean" ? body.active : undefined,
      sortOrder: body.sortOrder,
    })
    return NextResponse.json(avatar)
  } catch (error) {
    return (error as { status?: number }).status ? authErrorResponse(error) : NextResponse.json({ error: error instanceof Error ? error.message : "Avatar preset update failed." }, { status: 400 })
  }
}

export async function DELETE(_request: Request, context: { params: { id: string } }) {
  try {
    requireAdminUser()
    return NextResponse.json(deleteAvatarPreset(context.params.id))
  } catch (error) {
    return (error as { status?: number }).status ? authErrorResponse(error) : NextResponse.json({ error: error instanceof Error ? error.message : "Avatar preset delete failed." }, { status: 400 })
  }
}
