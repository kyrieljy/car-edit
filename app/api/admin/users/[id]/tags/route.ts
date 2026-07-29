import { NextResponse } from "next/server"
import { authErrorResponse, requireAdminUser } from "@/lib/server/auth"
import { updateUserTags } from "@/lib/server/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const admin = requireAdminUser()
    const body = await request.json()
    const tags = Array.isArray(body.tags) ? body.tags.map((t: unknown) => String(t)) : []
    updateUserTags(admin.id, params.id, tags)
    return NextResponse.json({ ok: true, tags })
  } catch (error) {
    return (error as { status?: number }).status
      ? authErrorResponse(error)
      : NextResponse.json({ error: error instanceof Error ? error.message : "Tag update failed" }, { status: 400 })
  }
}
