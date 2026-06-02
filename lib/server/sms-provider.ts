import { createHmac, randomUUID } from "node:crypto"
import { hasAliyunPnvsSmsConfig, sendAliyunPnvsSms } from "./aliyun-pnvs"

export type SmsDeliveryResult = {
  provider: "aliyun" | "aliyun_pnvs" | "mock"
  requestId: string
  devCode?: string
}

type SmsPurpose = "login" | "register" | "change_phone" | "admin" | "wechat" | "reset_password"

export async function sendVerificationSms(input: { phone: string; code: string; purpose: SmsPurpose }): Promise<SmsDeliveryResult> {
  const provider = smsProvider()
  if (shouldUseMockSms(provider)) {
    return {
      provider: "mock",
      requestId: `mock_${randomUUID().slice(0, 8)}`,
      devCode: process.env.NODE_ENV === "production" && process.env.SMS_DEV_RETURN_CODE !== "1" ? undefined : input.code,
    }
  }

  try {
    if (provider === "aliyun_pnvs" || (provider === "" && hasAliyunPnvsSmsConfig())) {
      const delivery = await sendAliyunPnvsSms(input)
      return { provider: "aliyun_pnvs", ...delivery }
    }
    return sendAliyunSms(input)
  } catch (error) {
    throw smsDeliveryError(error, provider === "aliyun_pnvs" ? "aliyun_pnvs" : "aliyun")
  }
}

export function smsFailureProvider(error: unknown): "aliyun" | "aliyun_pnvs" {
  const configured = smsProvider()
  if (configured === "aliyun_pnvs") return "aliyun_pnvs"
  return "aliyun"
}

function smsProvider() {
  return (process.env.SMS_PROVIDER || process.env.AUTH_SMS_PROVIDER || "").trim().toLowerCase()
}

function shouldUseMockSms(provider: string) {
  if (provider === "mock") return true
  if (provider === "aliyun_pnvs") return false
  if (provider === "aliyun") return false
  return process.env.NODE_ENV !== "production" && !hasAliyunConfig() && !hasAliyunPnvsSmsConfig()
}

function hasAliyunConfig() {
  return Boolean(
    aliyunAccessKeyId() &&
      aliyunAccessKeySecret() &&
      process.env.ALIYUN_SMS_SIGN_NAME &&
      process.env.ALIYUN_SMS_TEMPLATE_CODE,
  )
}

async function sendAliyunSms(input: { phone: string; code: string; purpose: SmsPurpose }): Promise<SmsDeliveryResult> {
  const accessKeyId = aliyunAccessKeyId()
  const accessKeySecret = aliyunAccessKeySecret()
  const signName = process.env.ALIYUN_SMS_SIGN_NAME || ""
  const templateCode = process.env.ALIYUN_SMS_TEMPLATE_CODE || ""
  if (!accessKeyId || !accessKeySecret || !signName || !templateCode) {
    throw new Error("Aliyun SMS is not configured.")
  }

  const endpoint = process.env.ALIYUN_SMS_ENDPOINT || "https://dysmsapi.aliyuncs.com/"
  const paramName = process.env.ALIYUN_SMS_TEMPLATE_CODE_PARAM || "code"
  const params: Record<string, string> = {
    AccessKeyId: accessKeyId,
    Action: "SendSms",
    Format: "JSON",
    PhoneNumbers: aliyunMainlandPhone(input.phone),
    RegionId: process.env.ALIYUN_SMS_REGION || "cn-hangzhou",
    SignName: signName,
    SignatureMethod: "HMAC-SHA1",
    SignatureNonce: randomUUID(),
    SignatureVersion: "1.0",
    TemplateCode: templateCode,
    TemplateParam: JSON.stringify({ [paramName]: input.code }),
    Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    Version: "2017-05-25",
  }
  const canonical = Object.keys(params)
    .sort()
    .map((key) => `${percentEncode(key)}=${percentEncode(params[key])}`)
    .join("&")
  const stringToSign = `GET&%2F&${percentEncode(canonical)}`
  const signature = createHmac("sha1", `${accessKeySecret}&`).update(stringToSign).digest("base64")
  const url = new URL(endpoint)
  url.search = `${canonical}&Signature=${percentEncode(signature)}`

  const response = await fetch(url, { method: "GET" })
  const body = (await response.json().catch(() => ({}))) as { Code?: string; Message?: string; RequestId?: string; BizId?: string }
  if (!response.ok || body.Code !== "OK") {
    throw new Error(body.Message || body.Code || `Aliyun SMS failed with HTTP ${response.status}.`)
  }
  return { provider: "aliyun", requestId: body.BizId || body.RequestId || "" }
}

function aliyunAccessKeyId() {
  return process.env.ALIYUN_SMS_ACCESS_KEY_ID || process.env.ALIYUN_ACCESS_KEY_ID || process.env.ALIBABA_CLOUD_ACCESS_KEY_ID || ""
}

function aliyunAccessKeySecret() {
  return process.env.ALIYUN_SMS_ACCESS_KEY_SECRET || process.env.ALIYUN_ACCESS_KEY_SECRET || process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET || ""
}

function smsDeliveryError(error: unknown, provider: "aliyun" | "aliyun_pnvs") {
  const next = error instanceof Error ? error : new Error("SMS delivery failed.")
  ;(next as Error & { provider?: string }).provider = String((error as { provider?: unknown })?.provider || provider)
  return next
}

function aliyunMainlandPhone(phone: string) {
  const normalized = phone.trim()
  const match = normalized.match(/^\+86(1\d{10})$/)
  if (match) return match[1]
  if (/^1\d{10}$/.test(normalized)) return normalized
  throw new Error("Aliyun domestic SMS only supports mainland China mobile numbers in this configuration.")
}

function percentEncode(value: string) {
  return encodeURIComponent(value)
    .replace(/\+/g, "%20")
    .replace(/\*/g, "%2A")
    .replace(/%7E/g, "~")
    .replace(/!/g, "%21")
    .replace(/\(/g, "%28")
    .replace(/\)/g, "%29")
    .replace(/'/g, "%27")
}
