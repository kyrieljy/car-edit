import { NextResponse } from "next/server"
import { authErrorResponse, requireAdminUser } from "@/lib/server/auth"
import { getTimeSeriesSum } from "@/lib/server/analytics-queries"
import type { AnalyticsGranularity } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    requireAdminUser()
    const url = new URL(request.url)
    const granularity = (url.searchParams.get("granularity") || "day") as AnalyticsGranularity
    const days = Number(url.searchParams.get("days") || "30")
    const groupByProvider = url.searchParams.get("groupByProvider") === "true"

    const endMs = Date.now()
    const startMs = endMs - days * 24 * 60 * 60 * 1000

    const points = getTimeSeriesSum({
      table: "usage_ledger",
      timeColumn: "created_at",
      startMs,
      endMs,
      granularity,
      aggregateColumn: "cost_cents",
      groupColumn: groupByProvider ? "provider" : undefined,
    })
    return NextResponse.json({ points })
  } catch (error) {
    return authErrorResponse(error)
  }
}
