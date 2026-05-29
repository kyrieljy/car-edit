import { NextResponse } from "next/server"
import { deleteChatSession, getChatMessages, updateChatSession } from "@/lib/server/db"
import { authErrorResponse, requireUser } from "@/lib/server/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_request: Request, context: { params: { id: string } }) {
  try {
    const user = requireUser()
    return NextResponse.json({ messages: getChatMessages(context.params.id, user.id) })
  } catch (error) {
    return (error as { status?: number }).status ? authErrorResponse(error) : NextResponse.json({ error: error instanceof Error ? error.message : "Chat session failed" }, { status: 404 })
  }
}

export async function PATCH(request: Request, context: { params: { id: string } }) {
  try {
    const user = requireUser()
    const body = await request.json()
    const session = updateChatSession({
      id: context.params.id,
      userId: user.id,
      pinned: typeof body.pinned === "boolean" ? body.pinned : undefined,
      title: typeof body.title === "string" ? body.title : undefined,
    })
    return NextResponse.json(session)
  } catch (error) {
    return (error as { status?: number }).status ? authErrorResponse(error) : NextResponse.json({ error: error instanceof Error ? error.message : "Chat session update failed" }, { status: 404 })
  }
}

export async function DELETE(_request: Request, context: { params: { id: string } }) {
  try {
    const user = requireUser()
    return NextResponse.json(deleteChatSession(context.params.id, user.id))
  } catch (error) {
    return (error as { status?: number }).status ? authErrorResponse(error) : NextResponse.json({ error: error instanceof Error ? error.message : "Chat session delete failed" }, { status: 404 })
  }
}
