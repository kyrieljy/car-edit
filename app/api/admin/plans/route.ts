import { NextResponse } from "next/server"
import { authErrorResponse, requireAdminUser } from "@/lib/server/auth"
import { updateMembershipPlan } from "@/lib/server/db"
import type { MembershipPlanId } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    requireAdminUser()
    const body = await request.json()
    const plan = updateMembershipPlan({
      id: String(body.id) as MembershipPlanId,
      label: typeof body.label === "string" ? body.label : undefined,
      priceCents: Number.isFinite(Number(body.priceCents)) ? Number(body.priceCents) : undefined,
      configLimit: Number.isFinite(Number(body.configLimit)) ? Number(body.configLimit) : undefined,
      chatDailyLimit: Number.isFinite(Number(body.chatDailyLimit)) ? Number(body.chatDailyLimit) : undefined,
      configUnlimited: typeof body.configUnlimited === "boolean" ? body.configUnlimited : undefined,
      chatUnlimited: typeof body.chatUnlimited === "boolean" ? body.chatUnlimited : undefined,
      chatEnabled: typeof body.chatEnabled === "boolean" ? body.chatEnabled : undefined,
      active: typeof body.active === "boolean" ? body.active : undefined,
    })
    return NextResponse.json(plan)
  } catch (error) {
    return (error as { status?: number }).status ? authErrorResponse(error) : NextResponse.json({ error: error instanceof Error ? error.message : "Plan update failed" }, { status: 400 })
  }
}
