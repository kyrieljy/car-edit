import { NextResponse } from "next/server"
import { authErrorResponse, requireAdminUser } from "@/lib/server/auth"
import { getReportMetrics } from "@/lib/server/analytics-queries"
import { createCsvResponse } from "@/lib/server/export-service"
import type { AnalyticsGranularity, ReportMetrics } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    requireAdminUser()
    const url = new URL(request.url)
    const reportType = (url.searchParams.get("type") || "daily") as "daily" | "weekly" | "monthly"

    const endMs = Date.now()
    let startMs: number
    let granularity: AnalyticsGranularity
    let filename: string

    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, "0")
    const day = String(now.getDate()).padStart(2, "0")

    switch (reportType) {
      case "weekly":
        startMs = endMs - 7 * 24 * 60 * 60 * 1000
        granularity = "day"
        filename = `report-weekly-${year}${month}${day}.csv`
        break
      case "monthly":
        startMs = endMs - 30 * 24 * 60 * 60 * 1000
        granularity = "day"
        filename = `report-monthly-${year}${month}${day}.csv`
        break
      case "daily":
      default:
        startMs = endMs - 24 * 60 * 60 * 1000
        granularity = "hour"
        filename = `report-daily-${year}${month}${day}.csv`
        break
    }

    const metrics = getReportMetrics({ startMs, endMs, granularity })

    return createCsvResponse<ReportMetrics>(
      metrics,
      [
        { key: "date", label: "Date" },
        { key: "newUsers", label: "New Users" },
        { key: "totalGenerations", label: "Total Generations" },
        { key: "successRate", label: "Success Rate (%)" },
        {
          key: "totalRevenueCents",
          label: "Revenue (USD)",
          format: (row) => (row.totalRevenueCents / 100).toFixed(2),
        },
      ],
      filename,
    )
  } catch (error) {
    return authErrorResponse(error)
  }
}
