import { NextResponse } from "next/server"
import { authErrorResponse, requireAdminUser } from "@/lib/server/auth"
import { getSuccessRateSeries } from "@/lib/server/analytics-queries"
import type { AnalyticsGranularity } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    requireAdminUser()
    const url = new URL(request.url)
    const granularity = (url.searchParams.get("granularity") || "hour") as AnalyticsGranularity
    const hours = Number(url.searchParams.get("hours") || "24")
    const provider = url.searchParams.get("provider") || undefined

    const endMs = Date.now()
    const startMs = endMs - hours * 60 * 60 * 1000

    const result = getSuccessRateSeries({ startMs, endMs, granularity, provider })
    return NextResponse.json(result)
  } catch (error) {
    return authErrorResponse(error)
  }
}
