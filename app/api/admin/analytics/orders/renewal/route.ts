import { NextResponse } from "next/server"
import { authErrorResponse, requireAdminUser } from "@/lib/server/auth"
import { getRenewalRate } from "@/lib/server/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    requireAdminUser()
    const url = new URL(request.url)
    const days = Number(url.searchParams.get("days") || "90")

    const endMs = Date.now()
    const startMs = endMs - days * 24 * 60 * 60 * 1000

    const result = getRenewalRate(startMs, endMs)
    return NextResponse.json(result)
  } catch (error) {
    return authErrorResponse(error)
  }
}
