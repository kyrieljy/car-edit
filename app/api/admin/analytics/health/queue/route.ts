import { NextResponse } from "next/server"
import { authErrorResponse, requireAdminUser } from "@/lib/server/auth"
import { getQueueStatus } from "@/lib/server/analytics-queries"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    requireAdminUser()
    const result = getQueueStatus()
    return NextResponse.json(result)
  } catch (error) {
    return authErrorResponse(error)
  }
}
