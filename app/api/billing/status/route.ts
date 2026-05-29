import { NextResponse } from "next/server"
import { authErrorResponse, requireUser } from "@/lib/server/auth"
import { getBillingStatus } from "@/lib/server/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const user = requireUser()
    return NextResponse.json({ billing: getBillingStatus(user.id) })
  } catch (error) {
    return authErrorResponse(error)
  }
}
