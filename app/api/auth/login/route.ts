import { NextResponse } from "next/server"
import { loginWithPassword, loginWithPhoneCode } from "@/lib/server/db"
import { attachSession } from "@/lib/server/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const mode = String(body.mode || "password")
    const user =
      mode === "code"
        ? loginWithPhoneCode({ phone: String(body.phone || ""), code: String(body.code || "") })
        : loginWithPassword({ identifier: String(body.identifier || body.username || body.phone || ""), password: String(body.password || "") })
    if (user.role === "admin" && mode !== "code") {
      if (!body.adminCode) {
        return NextResponse.json({ error: "管理员需要手机号验证码。", requireAdminCode: true, phone: user.phone }, { status: 428 })
      }
      loginWithPhoneCode({ phone: user.phone, code: String(body.adminCode), purpose: "admin" })
    }
    return attachSession(NextResponse.json({ user }), user.id)
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "登录失败。" }, { status: 401 })
  }
}
