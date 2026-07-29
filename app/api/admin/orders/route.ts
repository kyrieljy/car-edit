import { NextResponse } from "next/server"
import { authErrorResponse, requireAdminUser } from "@/lib/server/auth"
import { getAllPaymentOrders } from "@/lib/server/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    requireAdminUser()
    const url = new URL(request.url)
    const startDate = url.searchParams.get("startDate") || undefined
    const endDate = url.searchParams.get("endDate") || undefined
    const userQuery = url.searchParams.get("userQuery") || undefined
    const planId = url.searchParams.get("planId") || undefined

    const orders = getAllPaymentOrders({
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      userQuery: userQuery || undefined,
      planId: planId || undefined,
    })
    return NextResponse.json({ orders })
  } catch (error) {
    return authErrorResponse(error)
  }
}
