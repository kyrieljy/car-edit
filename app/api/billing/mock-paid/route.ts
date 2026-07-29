import { NextResponse } from "next/server"
import { authErrorResponse, requireUser } from "@/lib/server/auth"
import { completeMockPayment } from "@/lib/server/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const user = requireUser()
    const body = (await request.json().catch(() => ({}))) as { orderId?: string }
    const orderId = String(body.orderId || "")
    if (!orderId) {
      return NextResponse.json({ error: "orderId is required." }, { status: 400 })
    }
    // completeMockPayment returns EntitlementStatus (billing object) after updating subscription
    const billing = completeMockPayment({ userId: user.id, orderId })
    return NextResponse.json({ ok: true, billing })
  } catch (error) {
    if (error instanceof Error && !(error as { status?: number }).status) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return authErrorResponse(error)
  }
}
