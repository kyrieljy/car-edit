import { NextResponse } from "next/server"
import { getUserByEmail, getUserByPhone, getUserByUsername, registerUser } from "@/lib/server/db"
import { attachSession } from "@/lib/server/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const phone = String(body.phone || "").trim()
    const email = String(body.email || "").trim().toLowerCase()
    const username = String(body.username || "").trim()
    if (phone) {
      if (!isValidMainlandPhone(phone)) {
        return NextResponse.json({ error: "请输入合法的中国大陆手机号。", code: "INVALID_PHONE" }, { status: 400 })
      }
      const existingUser = getUserByPhone(phone)
      if (existingUser) {
        return NextResponse.json(
          {
            error: `该手机号已注册并绑定 ${existingUser.username} 用户。`,
            code: "PHONE_ALREADY_REGISTERED",
            username: existingUser.username,
          },
          { status: 409 },
        )
      }
    } else if (email) {
      if (!isValidEmail(email)) {
        return NextResponse.json({ error: "请输入合法的邮箱地址。", code: "INVALID_EMAIL" }, { status: 400 })
      }
      const existingUser = getUserByEmail(email)
      if (existingUser) {
        return NextResponse.json(
          {
            error: `该邮箱已注册并绑定 ${existingUser.username} 用户。`,
            code: "EMAIL_ALREADY_REGISTERED",
            username: existingUser.username,
          },
          { status: 409 },
        )
      }
    } else {
      return NextResponse.json({ error: "请填写手机号或邮箱。", code: "CONTACT_REQUIRED" }, { status: 400 })
    }
    const existingUsername = getUserByUsername(username)
    if (existingUsername) {
      return NextResponse.json(
        {
          error: "用户名已存在，请重新输入。",
          code: "USERNAME_ALREADY_REGISTERED",
          username,
        },
        { status: 409 },
      )
    }
    const user = registerUser({
      username,
      phone: phone || undefined,
      email: email || undefined,
      password: String(body.password || ""),
      code: String(body.code || ""),
      purpose: String(body.purpose || "register"),
    })
    return attachSession(NextResponse.json({ user }, { status: 201 }), user.id)
  } catch (error) {
    const message = error instanceof Error ? error.message : "注册失败。"
    if (message.includes("用户名已存在")) {
      return NextResponse.json({ error: "用户名已存在，请重新输入。", code: "USERNAME_ALREADY_REGISTERED" }, { status: 409 })
    }
    const code = message.includes("合法的中国大陆手机号")
      ? "INVALID_PHONE"
      : message.includes("合法的邮箱地址")
        ? "INVALID_EMAIL"
        : undefined
    return NextResponse.json({ error: message, code }, { status: 400 })
  }
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

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
}
