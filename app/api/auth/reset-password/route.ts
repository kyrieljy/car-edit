import { NextResponse } from "next/server"
import { resetUserPasswordWithCode } from "@/lib/server/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const user = resetUserPasswordWithCode({
      phone: String(body.phone || ""),
      code: String(body.code || ""),
      nextPassword: String(body.nextPassword || body.password || ""),
    })
    return NextResponse.json({ ok: true, user })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Password reset failed." }, { status: 400 })
  }
}
