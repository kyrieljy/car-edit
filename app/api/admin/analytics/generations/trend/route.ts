import { NextResponse } from "next/server"
import { authErrorResponse, requireAdminUser } from "@/lib/server/auth"
import { getTimeSeries } from "@/lib/server/analytics-queries"
import type { AnalyticsGranularity } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    requireAdminUser()
    const url = new URL(request.url)
    const granularity = (url.searchParams.get("granularity") || "day") as AnalyticsGranularity
    const days = Number(url.searchParams.get("days") || "30")
    const mode = url.searchParams.get("mode") || undefined

    const endMs = Date.now()
    const startMs = endMs - days * 24 * 60 * 60 * 1000

    const whereClause = mode && mode !== "all" ? "mode = ?" : undefined
    const params = mode && mode !== "all" ? [mode] : []

    // If mode filter is set, get grouped series; otherwise get single series
    if (whereClause) {
      const points = getTimeSeries({
        table: "generation_jobs",
        timeColumn: "created_at",
        startMs,
        endMs,
        granularity,
        whereClause,
        params,
        groupColumn: "mode",
      })
      return NextResponse.json({ points })
    }

    const points = getTimeSeries({
      table: "generation_jobs",
      timeColumn: "created_at",
      startMs,
      endMs,
      granularity,
      groupColumn: "mode",
    })
    return NextResponse.json({ points })
  } catch (error) {
    return authErrorResponse(error)
  }
}
