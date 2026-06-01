import { NextResponse } from "next/server"
import { authErrorResponse, requireAdminUser } from "@/lib/server/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    requireAdminUser()
    await request.json().catch(() => ({}))
    return NextResponse.json({ error: "Prompt presets are managed from Git seed and are read-only at runtime." }, { status: 405 })
  } catch (error) {
    return (error as { status?: number }).status ? authErrorResponse(error) : NextResponse.json({ error: error instanceof Error ? error.message : "Prompt create failed" }, { status: 400 })
  }
}
