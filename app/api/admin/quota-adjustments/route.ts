import { NextResponse } from "next/server"
import { authErrorResponse, requireAdminUser } from "@/lib/server/auth"
import { adjustUserQuota } from "@/lib/server/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const admin = requireAdminUser()
    const body = await request.json()
    const result = adjustUserQuota(admin.id, {
      userId: String(body.userId || ""),
      mode: body.mode === "chat" ? "chat" : "config",
      delta: Number(body.delta),
      reason: String(body.reason || ""),
      dateKey: typeof body.dateKey === "string" ? body.dateKey : undefined,
    })
    return NextResponse.json(result)
  } catch (error) {
    return (error as { status?: number }).status
      ? authErrorResponse(error)
      : NextResponse.json({ error: error instanceof Error ? error.message : "Quota adjustment failed" }, { status: 400 })
  }
}
