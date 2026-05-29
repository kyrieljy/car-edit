import { NextResponse } from "next/server"
import { authErrorResponse, currentUser, requireUser } from "@/lib/server/auth"
import { getBillingStatus, updateUserProfile } from "@/lib/server/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const user = currentUser()
  return NextResponse.json({ user, billing: user ? getBillingStatus(user.id) : null })
}

export async function PATCH(request: Request) {
  try {
    const user = requireUser()
    const body = await request.json()
    const nextUser = updateUserProfile(user.id, {
      name: String(body.name || ""),
      email: String(body.email || ""),
    })
    return NextResponse.json({ user: nextUser, billing: getBillingStatus(nextUser.id) })
  } catch (error) {
    return error instanceof Error && !(error as { status?: number }).status
      ? NextResponse.json({ error: error.message }, { status: 400 })
      : authErrorResponse(error)
  }
}
