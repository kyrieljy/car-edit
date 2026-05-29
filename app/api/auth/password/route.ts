import { NextResponse } from "next/server"
import { authErrorResponse, requireUser } from "@/lib/server/auth"
import { changeUserPassword, getBillingStatus } from "@/lib/server/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const user = requireUser()
    const body = await request.json()
    const nextUser = changeUserPassword(user.id, {
      currentPassword: String(body.currentPassword || ""),
      nextPassword: String(body.nextPassword || ""),
    })
    return NextResponse.json({ user: nextUser, billing: getBillingStatus(nextUser.id) })
  } catch (error) {
    return error instanceof Error && !(error as { status?: number }).status
      ? NextResponse.json({ error: error.message }, { status: 400 })
      : authErrorResponse(error)
  }
}
