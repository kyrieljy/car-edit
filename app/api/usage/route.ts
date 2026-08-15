import { NextResponse } from "next/server"
import { authErrorResponse, requireUser } from "@/lib/server/auth"
import { getUsageSeries } from "@/lib/server/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    const user = requireUser()
    const url = new URL(request.url)
    const days = Math.min(30, Math.max(1, Number(url.searchParams.get("days")) || 7))
    const series = getUsageSeries(user.id, days)
    return NextResponse.json({ series })
  } catch (error) {
    return authErrorResponse(error)
  }
}
