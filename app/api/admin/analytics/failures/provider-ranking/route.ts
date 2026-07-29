import { NextResponse } from "next/server"
import { authErrorResponse, requireAdminUser } from "@/lib/server/auth"
import { getProviderFailureRanking } from "@/lib/server/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    requireAdminUser()
    const rankings = getProviderFailureRanking()
    return NextResponse.json({ rankings })
  } catch (error) {
    return authErrorResponse(error)
  }
}
