import { NextResponse } from "next/server"
import { authErrorResponse, requireAdminUser } from "@/lib/server/auth"
import { getFailureAttribution } from "@/lib/server/analytics-queries"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    requireAdminUser()
    const url = new URL(request.url)
    const days = Number(url.searchParams.get("days") || "30")
    const provider = url.searchParams.get("provider") || undefined
    const mode = url.searchParams.get("mode") || undefined

    const endMs = Date.now()
    const startMs = endMs - days * 24 * 60 * 60 * 1000

    const result = getFailureAttribution({ startMs, endMs, provider, mode })
    return NextResponse.json(result)
  } catch (error) {
    return authErrorResponse(error)
  }
}
