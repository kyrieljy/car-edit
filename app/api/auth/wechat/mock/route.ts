import { NextResponse } from "next/server"
import { loginOrBindMockWechat, registerAndBindMockWechat } from "@/lib/server/db"
import { attachSession } from "@/lib/server/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const result = body.register
      ? registerAndBindMockWechat({
          openId: String(body.openId || "mock-wechat"),
          username: String(body.username || ""),
          phone: String(body.phone || ""),
          password: String(body.password || ""),
          code: String(body.code || ""),
        })
      : loginOrBindMockWechat({
          openId: String(body.openId || "mock-wechat"),
          phone: body.phone ? String(body.phone) : undefined,
          code: body.code ? String(body.code) : undefined,
        })
    if (result.requiresBinding || !result.user) {
      return NextResponse.json({ requiresBinding: true, openId: result.openId })
    }
    return attachSession(NextResponse.json({ requiresBinding: false, user: result.user }), result.user.id)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "微信登录失败。" }, { status: 400 })
  }
}
