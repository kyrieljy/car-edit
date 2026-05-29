import { NextResponse } from "next/server"
import { registerUser } from "@/lib/server/db"
import { attachSession } from "@/lib/server/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const user = registerUser({
      username: String(body.username || ""),
      phone: String(body.phone || ""),
      password: String(body.password || ""),
      code: String(body.code || ""),
    })
    return attachSession(NextResponse.json({ user }, { status: 201 }), user.id)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "注册失败。" }, { status: 400 })
  }
}
