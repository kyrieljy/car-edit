import { NextResponse } from "next/server"
import { authErrorResponse, requireUser } from "@/lib/server/auth"
import { getPaymentOrders } from "@/lib/server/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const user = requireUser()
    const orders = getPaymentOrders(user.id)
    return NextResponse.json({ orders })
  } catch (error) {
    return authErrorResponse(error)
  }
}
