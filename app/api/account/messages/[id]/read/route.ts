import { NextResponse } from "next/server"
import { authErrorResponse, requireUser } from "@/lib/server/auth"
import { markAccountMessageRead, unreadAccountMessageCount } from "@/lib/server/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(_request: Request, context: { params: { id: string } }) {
  try {
    const user = requireUser()
    const messages = markAccountMessageRead(user.id, context.params.id)
    return NextResponse.json({
      messages,
      unreadCount: unreadAccountMessageCount(user.id),
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}
