import { NextResponse } from "next/server"
import { attachSession } from "@/lib/server/auth"
import { loginOrCreateWithVerifiedPhone } from "@/lib/server/db"
import { verifyPhoneOneTapToken } from "@/lib/server/phone-one-tap-provider"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const verified = await verifyPhoneOneTapToken({
      token: String(body.spToken || body.token || ""),
      phone: String(body.phone || ""),
      platform: String(body.platform || "web_h5"),
    })
    const user = loginOrCreateWithVerifiedPhone({
      phone: verified.phone,
      source: `phone_one_tap:${verified.provider}`,
    })
    return attachSession(NextResponse.json({ user, provider: verified.provider, requestId: verified.requestId }), user.id)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Phone one-tap login failed." }, { status: 400 })
  }
}
