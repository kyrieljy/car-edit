import { NextResponse } from "next/server"
import { createVerificationCode } from "@/lib/server/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const result = createVerificationCode({
      phone: String(body.phone || ""),
      purpose: String(body.purpose || "login"),
    })
    return NextResponse.json({ ok: true, mockCode: result.code, expiresAt: result.expiresAt })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "验证码发送失败。" }, { status: 400 })
  }
}
