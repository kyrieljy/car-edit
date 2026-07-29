import { NextResponse } from "next/server"
import { authErrorResponse, requireAdminUser } from "@/lib/server/auth"
import { getTimeSeriesSum } from "@/lib/server/analytics-queries"
import { getRevenueStats } from "@/lib/server/db"
import type { AnalyticsGranularity } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    requireAdminUser()
    const url = new URL(request.url)
    const granularity = (url.searchParams.get("granularity") || "day") as AnalyticsGranularity
    const days = Number(url.searchParams.get("days") || "30")
    const groupByPlan = url.searchParams.get("groupByPlan") === "true"

    const endMs = Date.now()
    const startMs = endMs - days * 24 * 60 * 60 * 1000

    const points = getTimeSeriesSum({
      table: "payment_orders",
      timeColumn: "created_at",
      startMs,
      endMs,
      granularity,
      aggregateColumn: "amount_cents",
      whereClause: "status = 'paid'",
      groupColumn: groupByPlan ? "plan_id" : undefined,
    })

    const stats = getRevenueStats(startMs, endMs)

    return NextResponse.json({
      points,
      dailyRevenue: stats.dailyRevenue,
      monthlyRevenue: stats.monthlyRevenue,
      arpu: stats.arpu,
    })
  } catch (error) {
    return authErrorResponse(error)
  }
}
