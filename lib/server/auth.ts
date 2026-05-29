import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { createSessionToken, deleteSessionToken, getUserBySessionToken } from "./db"
import type { AuthUser } from "../types"

export const SESSION_COOKIE = "car_mod_session"

export function currentUser(): AuthUser | null {
  const token = cookies().get(SESSION_COOKIE)?.value || ""
  return getUserBySessionToken(token)
}

export function requireUser(): AuthUser {
  const user = currentUser()
  if (!user) throw new AuthError("请先登录。", 401)
  return user
}

export function requireAdminUser(): AuthUser {
  const user = requireUser()
  if (user.role !== "admin") throw new AuthError("需要管理员权限。", 403)
  return user
}

export function attachSession(response: NextResponse, userId: string) {
  response.cookies.set(SESSION_COOKIE, createSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    secure: sessionCookieSecure(),
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  })
  return response
}

export function clearSession(response: NextResponse) {
  const token = cookies().get(SESSION_COOKIE)?.value || ""
  deleteSessionToken(token)
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: sessionCookieSecure(),
    path: "/",
    maxAge: 0,
  })
  return response
}

function sessionCookieSecure() {
  if (process.env.AUTH_COOKIE_SECURE === "1") return true
  if (process.env.AUTH_COOKIE_SECURE === "0") return false
  const publicUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || process.env.SITE_URL || ""
  if (publicUrl.startsWith("https://")) return true
  return process.env.VERCEL === "1"
}

export class AuthError extends Error {
  status: number

  constructor(message: string, status = 401) {
    super(message)
    this.status = status
  }
}

export function authErrorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }
  return NextResponse.json({ error: error instanceof Error ? error.message : "Auth failed" }, { status: 500 })
}
