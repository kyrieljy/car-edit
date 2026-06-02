import { NextResponse } from "next/server"
import { getPhoneOneTapAuthToken } from "@/lib/server/phone-one-tap-provider"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST() {
  try {
    const token = await getPhoneOneTapAuthToken()
    return NextResponse.json(token)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Phone one-tap token failed." }, { status: 400 })
  }
}
