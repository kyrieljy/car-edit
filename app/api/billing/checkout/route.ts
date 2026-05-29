import { NextResponse } from "next/server"
import { authErrorResponse, requireUser } from "@/lib/server/auth"
import { createPaymentOrder } from "@/lib/server/db"
import type { MembershipPlanId } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const user = requireUser()
    const body = await request.json()
    const order = createPaymentOrder({
      userId: user.id,
      planId: String(body.planId || "pro") as MembershipPlanId,
      method: String(body.method || "wechat") === "alipay" ? "alipay" : "wechat",
    })
    return NextResponse.json({ order, mockPayment: true })
  } catch (error) {
    return error instanceof Error && !(error as { status?: number }).status
      ? NextResponse.json({ error: error.message }, { status: 400 })
      : authErrorResponse(error)
  }
}
