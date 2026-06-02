import { randomUUID } from "node:crypto"
import { getAliyunH5AuthToken, getAliyunPhoneWithH5Token, hasAliyunPnvsH5Config } from "./aliyun-pnvs"

export type PhoneOneTapResult = {
  provider: "mock" | "http" | "aliyun_h5"
  phone: string
  requestId: string
}

export type PhoneOneTapAuthTokenResult = {
  provider: "mock" | "aliyun_h5"
  accessToken: string
  jwtToken: string
  requestId: string
}

export async function verifyPhoneOneTapToken(input: { token: string; phone?: string; platform?: string }): Promise<PhoneOneTapResult> {
  const provider = phoneOneTapProvider()
  if (provider === "aliyun_h5" || (provider === "" && hasAliyunPnvsH5Config())) {
    const verified = await getAliyunPhoneWithH5Token(input.token)
    return {
      provider: verified.provider === "mock" ? "mock" : "aliyun_h5",
      phone: verified.phone,
      requestId: verified.requestId,
    }
  }
  if (provider === "http") return verifyWithHttpProvider(input)
  if (provider === "mock" || shouldUseMockOneTap(provider)) return mockOneTapResult(input.phone)
  throw new Error("Phone one-tap provider is not configured.")
}

export async function getPhoneOneTapAuthToken(): Promise<PhoneOneTapAuthTokenResult> {
  const provider = phoneOneTapProvider()
  if (provider === "aliyun_h5" || (provider === "" && hasAliyunPnvsH5Config())) {
    const result = await getAliyunH5AuthToken()
    return {
      provider: result.provider === "mock" ? "mock" : "aliyun_h5",
      accessToken: result.accessToken,
      jwtToken: result.jwtToken,
      requestId: result.requestId,
    }
  }
  if (provider === "mock" || shouldUseMockOneTap(provider)) {
    return {
      provider: "mock",
      accessToken: `mock_access_${randomUUID().slice(0, 8)}`,
      jwtToken: `mock_jwt_${randomUUID().slice(0, 8)}`,
      requestId: `mock_one_tap_token_${randomUUID().slice(0, 8)}`,
    }
  }
  throw new Error("Phone one-tap provider is not configured.")
}

function phoneOneTapProvider() {
  return (process.env.PHONE_ONE_TAP_PROVIDER || "").trim().toLowerCase()
}

function shouldUseMockOneTap(provider: string) {
  return process.env.NODE_ENV !== "production" && provider !== "aliyun_h5" && !hasAliyunPnvsH5Config()
}

function mockOneTapResult(phone?: string): PhoneOneTapResult {
  return {
    provider: "mock",
    phone: phone || process.env.PHONE_ONE_TAP_MOCK_PHONE || "+8613912345698",
    requestId: `mock_one_tap_${randomUUID().slice(0, 8)}`,
  }
}

async function verifyWithHttpProvider(input: { token: string; phone?: string; platform?: string }): Promise<PhoneOneTapResult> {
  const endpoint = process.env.PHONE_ONE_TAP_VERIFY_URL || ""
  if (!endpoint) throw new Error("Phone one-tap verify URL is not configured.")
  if (!input.token.trim()) throw new Error("Phone one-tap token is required.")

  const headers: Record<string, string> = { "Content-Type": "application/json" }
  const secret = process.env.PHONE_ONE_TAP_VERIFY_SECRET || ""
  if (secret) headers.Authorization = `Bearer ${secret}`

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      token: input.token,
      platform: input.platform || "web_h5",
    }),
  })
  const body = (await response.json().catch(() => ({}))) as { phone?: string; requestId?: string; error?: string }
  if (!response.ok || !body.phone) {
    throw new Error(body.error || `Phone one-tap verification failed with HTTP ${response.status}.`)
  }
  return {
    provider: "http",
    phone: body.phone,
    requestId: body.requestId || "",
  }
}
