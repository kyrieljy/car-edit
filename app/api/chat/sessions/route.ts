import { NextResponse } from "next/server"
import { createChatSession, listChatSessions } from "@/lib/server/db"
import { authErrorResponse, requireUser } from "@/lib/server/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const user = requireUser()
    return NextResponse.json({ sessions: listChatSessions(user.id) })
  } catch (error) {
    return authErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = requireUser()
    const body = await request.json().catch(() => ({}))
    const session = createChatSession(String(body.title || "New Chat"), user.id)
    return NextResponse.json(session, { status: 201 })
  } catch (error) {
    return authErrorResponse(error)
  }
}
