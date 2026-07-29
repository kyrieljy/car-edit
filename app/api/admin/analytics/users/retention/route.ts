import { NextResponse } from "next/server"
import { authErrorResponse, requireAdminUser } from "@/lib/server/auth"
import { getRetentionCohorts } from "@/lib/server/analytics-queries"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    requireAdminUser()
    const url = new URL(request.url)
    const days = Number(url.searchParams.get("days") || "30")
    const periodsParam = url.searchParams.get("periods") || "1,7,30"
    const periods = periodsParam.split(",").map((p) => Number(p.trim())).filter((n) => !isNaN(n) && n > 0)

    const endMs = Date.now()
    const startMs = endMs - days * 24 * 60 * 60 * 1000

    const result = getRetentionCohorts(startMs, endMs, periods)
    return NextResponse.json(result)
  } catch (error) {
    return authErrorResponse(error)
  }
}
