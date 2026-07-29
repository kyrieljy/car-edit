import { NextResponse } from "next/server"
import { authErrorResponse, requireAdminUser } from "@/lib/server/auth"
import { getFailureRateSeries } from "@/lib/server/analytics-queries"
import type { AnalyticsGranularity } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    requireAdminUser()
    const url = new URL(request.url)
    const granularity = (url.searchParams.get("granularity") || "day") as AnalyticsGranularity
    const days = Number(url.searchParams.get("days") || "30")
    const groupBy = url.searchParams.get("groupBy") || undefined // "mode" | "provider" | undefined

    const endMs = Date.now()
    const startMs = endMs - days * 24 * 60 * 60 * 1000

    const result = getFailureRateSeries({
      startMs,
      endMs,
      granularity,
      groupColumn: groupBy === "mode" ? "mode" : groupBy === "provider" ? "provider" : undefined,
    })
    return NextResponse.json(result)
  } catch (error) {
    return authErrorResponse(error)
  }
}
