import { NextResponse } from "next/server"
import { authErrorResponse, requireUser } from "@/lib/server/auth"
import { accountMessages, unreadAccountMessageCount } from "@/lib/server/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const user = requireUser()
    return NextResponse.json({
      messages: accountMessages(user.id),
      unreadCount: unreadAccountMessageCount(user.id),
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}
