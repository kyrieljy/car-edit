import { NextResponse } from "next/server"
import { createVerificationCode, getUserByPhone, markVerificationCodeFailed, markVerificationCodeSent, verifyPasswordUser } from "@/lib/server/db"
import { requireUser } from "@/lib/server/auth"
import { sendVerificationSms, smsFailureProvider } from "@/lib/server/sms-provider"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const purpose = normalizePurpose(String(body.purpose || "login"))
    const targetPhone =
      purpose === "admin"
        ? adminPhoneForCode(body)
        : purpose === "change_phone"
          ? phoneForChange(body)
          : String(body.phone || "")
    if (purpose !== "admin" && !isValidMainlandPhone(targetPhone)) {
      return NextResponse.json({ error: "请输入合法的中国大陆手机号。", code: "INVALID_PHONE" }, { status: 400 })
    }
    const existingUser = getUserByPhone(targetPhone)
    if (purpose === "register" && existingUser) {
      return NextResponse.json(
        {
          error: `该手机号已注册并绑定 ${existingUser.username} 用户。`,
          code: "PHONE_ALREADY_REGISTERED",
          username: existingUser.username,
        },
        { status: 409 },
      )
    }
    if (purpose === "reset_password" && !existingUser) {
      return NextResponse.json({ error: "该手机号尚未注册。", code: "PHONE_NOT_REGISTERED" }, { status: 404 })
    }
    if (purpose === "reset_password" && existingUser?.role === "admin") {
      return NextResponse.json({ error: "管理员账号不能通过普通忘记密码流程重置。", code: "ADMIN_RESET_BLOCKED" }, { status: 400 })
    }
    if (purpose === "login" && existingUser?.role === "admin") {
      throw new Error("管理员账号请使用账号密码和管理员验证码登录。")
    }
    const result = createVerificationCode({
      phone: targetPhone,
      purpose,
      ip: clientIp(request),
      userAgent: request.headers.get("user-agent") || "",
    })
    try {
      const delivery = await sendVerificationSms({ phone: result.phone, code: result.code, purpose })
      markVerificationCodeSent({ id: result.id, provider: delivery.provider, requestId: delivery.requestId })
      return NextResponse.json({ ok: true, expiresAt: result.expiresAt, devCode: delivery.devCode })
    } catch (error) {
      markVerificationCodeFailed({
        id: result.id,
        provider: smsFailureProvider(error),
        error: error instanceof Error ? error.message : "SMS delivery failed.",
      })
      throw error
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "验证码发送失败。"
    const code = message.includes("合法的中国大陆手机号") ? "INVALID_PHONE" : undefined
    return NextResponse.json({ error: message, code }, { status: 400 })
  }
}

function normalizePurpose(value: string): "login" | "register" | "change_phone" | "admin" | "wechat" | "reset_password" {
  if (value === "register" || value === "change_phone" || value === "admin" || value === "wechat" || value === "reset_password") return value
  return "login"
}

function adminPhoneForCode(body: Record<string, unknown>) {
  const admin = verifyPasswordUser({
    identifier: String(body.identifier || body.username || body.phone || ""),
    password: String(body.password || ""),
  })
  if (admin.role !== "admin") throw new Error("需要管理员账号。")
  if (!admin.phone) throw new Error("管理员账号未绑定手机号。")
  return admin.phone
}

function phoneForChange(body: Record<string, unknown>) {
  requireUser()
  return String(body.phone || "")
}

function isValidMainlandPhone(value: string) {
  const raw = value.trim().replace(/[\s-]/g, "")
  const digits = raw.replace(/\D/g, "")
  const local = raw.startsWith("+86")
    ? digits.slice(2)
    : digits.startsWith("86") && digits.length === 13
      ? digits.slice(2)
      : digits
  return /^1[3-9]\d{9}$/.test(local)
}

function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for") || ""
  return forwarded.split(",")[0]?.trim() || request.headers.get("x-real-ip") || ""
}
