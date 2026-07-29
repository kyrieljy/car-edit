import { NextResponse } from "next/server"
import { authErrorResponse, requireAdminUser } from "@/lib/server/auth"
import { getActiveUserList } from "@/lib/server/analytics-queries"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    requireAdminUser()
    const url = new URL(request.url)
    const dateParam = url.searchParams.get("date")
    const dateMs = dateParam ? new Date(dateParam).getTime() : undefined

    const result = getActiveUserList(dateMs)
    return NextResponse.json({ items: result })
  } catch (error) {
    return authErrorResponse(error)
  }
}
