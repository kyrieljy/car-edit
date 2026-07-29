import { NextResponse } from "next/server"
import { authErrorResponse, requireAdminUser } from "@/lib/server/auth"
import { getCostByUser } from "@/lib/server/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    requireAdminUser()
    const url = new URL(request.url)
    const limit = Number(url.searchParams.get("limit") || "10")

    const items = getCostByUser(limit)
    return NextResponse.json({ items })
  } catch (error) {
    return authErrorResponse(error)
  }
}
