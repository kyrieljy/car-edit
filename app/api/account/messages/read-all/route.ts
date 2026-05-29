import { NextResponse } from "next/server"
import { authErrorResponse, requireUser } from "@/lib/server/auth"
import { markAllAccountMessagesRead, unreadAccountMessageCount } from "@/lib/server/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST() {
  try {
    const user = requireUser()
    const messages = markAllAccountMessagesRead(user.id)
    return NextResponse.json({
      messages,
      unreadCount: unreadAccountMessageCount(user.id),
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}
