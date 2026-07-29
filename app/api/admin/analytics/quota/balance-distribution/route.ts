import { NextResponse } from "next/server"
import { authErrorResponse, requireAdminUser } from "@/lib/server/auth"
import { getBalanceDistribution } from "@/lib/server/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    requireAdminUser()
    const result = getBalanceDistribution()
    return NextResponse.json(result)
  } catch (error) {
    return authErrorResponse(error)
  }
}
