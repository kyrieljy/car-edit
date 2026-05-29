import { NextResponse } from "next/server"
import { getMembershipPlans } from "@/lib/server/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json({ plans: getMembershipPlans().filter((plan) => plan.active) })
}
