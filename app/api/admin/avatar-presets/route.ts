import { NextResponse } from "next/server"
import { authErrorResponse, requireAdminUser } from "@/lib/server/auth"
import { createAvatarPreset, listAvatarPresets } from "@/lib/server/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    requireAdminUser()
    return NextResponse.json({ avatars: listAvatarPresets() })
  } catch (error) {
    return authErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    requireAdminUser()
    const body = await request.json()
    const avatar = createAvatarPreset({
      id: String(body.id || ""),
      label: String(body.label || ""),
      imageUrl: String(body.imageUrl || ""),
      active: body.active !== false,
      sortOrder: Number(body.sortOrder || 0),
    })
    return NextResponse.json(avatar, { status: 201 })
  } catch (error) {
    return (error as { status?: number }).status ? authErrorResponse(error) : NextResponse.json({ error: error instanceof Error ? error.message : "Avatar preset create failed." }, { status: 400 })
  }
}
