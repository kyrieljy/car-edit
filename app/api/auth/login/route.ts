import { NextResponse } from "next/server"
import { loginWithPassword, loginWithPhoneCode, resolvePhoneCodeLogin, resolveEmailCodeLogin, verifyPasswordUser } from "@/lib/server/db"
import { attachSession } from "@/lib/server/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const mode = String(body.mode || "password")
    if (mode === "code") {
      if (body.email) {
        const result = resolveEmailCodeLogin({
          email: String(body.email || ""),
          code: String(body.code || ""),
          bindRequired: Boolean(body.bindRequired),
        })
        if (result.requiresBinding || !result.user) {
          return NextResponse.json({ requiresBinding: true, email: result.email })
        }
        return attachSession(NextResponse.json({ user: result.user }), result.user.id)
      }
      const result = resolvePhoneCodeLogin({
        phone: String(body.phone || ""),
        code: String(body.code || ""),
        bindRequired: Boolean(body.bindRequired),
      })
      if (result.requiresBinding || !result.user) {
        return NextResponse.json({ requiresBinding: true, phone: result.phone })
      }
      return attachSession(NextResponse.json({ user: result.user }), result.user.id)
    }

    const credentials = { identifier: String(body.identifier || body.username || body.phone || ""), password: String(body.password || "") }
    const user = verifyPasswordUser(credentials)
    if (user.role === "admin") {
      if (!body.adminCode) {
        return NextResponse.json({ error: "管理员需要手机号验证码。", requireAdminCode: true, phone: maskPhone(user.phone) }, { status: 428 })
      }
      loginWithPhoneCode({ phone: user.phone, code: String(body.adminCode), purpose: "admin" })
      return attachSession(NextResponse.json({ user }), user.id)
    }
    const loggedInUser = loginWithPassword(credentials)
    return attachSession(NextResponse.json({ user: loggedInUser }), loggedInUser.id)
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? String((error as { code?: unknown }).code || "") : ""
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "登录失败。", code: code || undefined },
      { status: 401 },
    )
  }
}

function maskPhone(phone: string) {
  return phone.replace(/^(\+?\d{2,4})(\d{3})\d+(\d{4})$/, "$1 $2****$3")
}
