import type { AccountMessage, AuthUser, EntitlementStatus } from "@/lib/types"

export type AccountPayload = {
  user: AuthUser
  billing: EntitlementStatus | null
}

async function readJsonResponse<T>(response: Response, fallback: string): Promise<T> {
  const body = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(typeof body.error === "string" ? body.error : fallback)
  }
  return body as T
}

export async function updateAccountProfile(input: { name: string; email: string }) {
  const response = await fetch("/api/auth/me", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  return readJsonResponse<AccountPayload>(response, "Profile update failed.")
}

export async function changeAccountPassword(input: { currentPassword: string; nextPassword: string }) {
  const response = await fetch("/api/auth/password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  return readJsonResponse<AccountPayload>(response, "Password update failed.")
}

export async function sendPhoneChangeCode(phone: string) {
  const response = await fetch("/api/auth/send-code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, purpose: "change_phone" }),
  })
  return readJsonResponse<{ ok: boolean; mockCode?: string; expiresAt?: number }>(response, "Code sending failed.")
}

export async function changeAccountPhone(input: { phone: string; code: string }) {
  const response = await fetch("/api/auth/phone", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  return readJsonResponse<AccountPayload>(response, "Phone update failed.")
}

export async function refreshAccountBilling() {
  const response = await fetch("/api/billing/status")
  return readJsonResponse<{ billing: EntitlementStatus }>(response, "Billing refresh failed.")
}

export async function listAccountMessages() {
  const response = await fetch("/api/account/messages")
  return readJsonResponse<{ messages: AccountMessage[]; unreadCount: number }>(response, "Messages loading failed.")
}

export async function markAccountMessageRead(messageId: string) {
  const response = await fetch(`/api/account/messages/${encodeURIComponent(messageId)}/read`, { method: "POST" })
  return readJsonResponse<{ messages: AccountMessage[]; unreadCount: number }>(response, "Message update failed.")
}

export async function markAllAccountMessagesRead() {
  const response = await fetch("/api/account/messages/read-all", { method: "POST" })
  return readJsonResponse<{ messages: AccountMessage[]; unreadCount: number }>(response, "Messages update failed.")
}

export function formatAccountQuota(value: number | "unlimited" | undefined, unlimitedText: string) {
  if (value === undefined) return "--"
  return value === "unlimited" ? unlimitedText : String(value)
}

export function accountInitials(user: AuthUser | null | undefined, fallback = "AM") {
  const source = user?.name || user?.username || fallback
  return (source.trim().slice(0, 2) || fallback).toUpperCase()
}
