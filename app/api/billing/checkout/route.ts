import { NextResponse } from "next/server"
import { authErrorResponse, requireUser } from "@/lib/server/auth"
import { createPaymentOrder } from "@/lib/server/db"
import type { MembershipPlanId } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const user = requireUser()
    const body = (await request.json().catch(() => ({}))) as {
      planId?: string
      method?: "wechat" | "alipay"
      cycle?: "monthly" | "yearly"
    }
    const planId = (body.planId || "") as MembershipPlanId
    const method = body.method === "alipay" ? "alipay" : "wechat"
    // cycle is reserved for future real payment integration; current version always uses monthly
    const order = createPaymentOrder({ userId: user.id, planId, method })
    return NextResponse.json({ order })
  } catch (error) {
    if (error instanceof Error && !(error as { status?: number }).status) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return authErrorResponse(error)
  }
}
