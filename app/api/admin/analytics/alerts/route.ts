import { NextResponse } from "next/server"
import { authErrorResponse, requireAdminUser } from "@/lib/server/auth"
import { listAlerts } from "@/lib/server/db"
import { scanAnomalies } from "@/lib/server/alert-scanner"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    requireAdminUser()
    const url = new URL(request.url)
    const limit = Number(url.searchParams.get("limit") || "50")

    // Trigger anomaly scan on each page visit (cached for 5 minutes)
    const scannedAt = scanAnomalies()

    const alerts = listAlerts(limit)
    return NextResponse.json({ alerts, total: alerts.length, scannedAt })
  } catch (error) {
    return authErrorResponse(error)
  }
}
