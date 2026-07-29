import { NextResponse } from "next/server"
import { authErrorResponse, requireAdminUser } from "@/lib/server/auth"
import { getActivitySeries } from "@/lib/server/analytics-queries"
import type { AnalyticsGranularity } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    requireAdminUser()
    const url = new URL(request.url)
    const granularity = (url.searchParams.get("granularity") || "day") as AnalyticsGranularity
    const days = Number(url.searchParams.get("days") || "30")

    const endMs = Date.now()
    const startMs = endMs - days * 24 * 60 * 60 * 1000

    const result = getActivitySeries(startMs, endMs, granularity)
    return NextResponse.json(result)
  } catch (error) {
    return authErrorResponse(error)
  }
}
