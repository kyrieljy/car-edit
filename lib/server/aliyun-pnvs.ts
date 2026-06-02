import { randomUUID } from "node:crypto"
import DypnsClient, {
  GetAuthTokenRequest,
  GetPhoneWithTokenRequest,
  SendSmsVerifyCodeRequest,
} from "@alicloud/dypnsapi20170525"
import { $OpenApiUtil } from "@alicloud/openapi-core"

type AliyunPnvsProvider = "aliyun_pnvs" | "aliyun_h5"

export type AliyunPnvsSmsDelivery = {
  requestId: string
  devCode?: string
}

export type AliyunH5AuthToken = {
  provider: "aliyun_h5" | "mock"
  accessToken: string
  jwtToken: string
  requestId: string
}

export type AliyunH5Phone = {
  provider: "aliyun_h5" | "mock"
  phone: string
  requestId: string
}

let cachedClient: DypnsClient | null = null
let cachedClientKey = ""

export function hasAliyunPnvsSmsConfig() {
  return Boolean(aliyunAccessKeyId() && aliyunAccessKeySecret() && process.env.ALIYUN_PNVS_SMS_SIGN_NAME && hasAliyunPnvsSmsTemplateCode())
}

export function hasAliyunPnvsH5Config() {
  return Boolean(aliyunAccessKeyId() && aliyunAccessKeySecret() && process.env.ALIYUN_PNVS_H5_SCENE_CODE)
}

export async function sendAliyunPnvsSms(input: { phone: string; code: string; purpose: string }): Promise<AliyunPnvsSmsDelivery> {
  if (mockPnvsEnabled()) {
    if (mockPnvsSmsShouldFail(input.phone)) {
      throw aliyunError("aliyun_pnvs", "MOCK_FAILED", "Mock Aliyun PNVS SMS failed.", "")
    }
    return {
      requestId: `mock_pnvs_sms_${randomUUID().slice(0, 8)}`,
      devCode: shouldReturnMockDevCode() ? input.code : undefined,
    }
  }

  const signName = requiredEnv("ALIYUN_PNVS_SMS_SIGN_NAME", "Aliyun PNVS SMS sign name is not configured.")
  const templateCode = aliyunSmsTemplateCode(input.purpose)
  const validSeconds = positiveNumberEnv("ALIYUN_PNVS_SMS_VALID_SECONDS", 600)
  const templateParam = aliyunSmsTemplateParam(input.code, validSeconds)
  const response = await aliyunPnvsClient().sendSmsVerifyCode(
    new SendSmsVerifyCodeRequest({
      autoRetry: numberEnv("ALIYUN_PNVS_SMS_AUTO_RETRY", 1),
      codeLength: input.code.length,
      codeType: 1,
      countryCode: process.env.ALIYUN_PNVS_SMS_COUNTRY_CODE || "86",
      duplicatePolicy: numberEnv("ALIYUN_PNVS_SMS_DUPLICATE_POLICY", 1),
      interval: numberEnv("ALIYUN_PNVS_SMS_INTERVAL_SECONDS", 60),
      outId: `auth_${input.purpose}_${Date.now()}`,
      phoneNumber: mainlandPhone(input.phone),
      returnVerifyCode: false,
      schemeName: process.env.ALIYUN_PNVS_SMS_SCHEME_NAME || undefined,
      signName,
      templateCode,
      templateParam: JSON.stringify(templateParam),
      validTime: validSeconds,
    }),
  )

  const body = response.body
  if (body?.code !== "OK" || body.success === false) {
    throw aliyunError("aliyun_pnvs", body?.code, body?.message, body?.requestId)
  }
  const requestId = body.model?.bizId || body.model?.requestId || body.requestId || ""
  return { requestId }
}

export async function getAliyunH5AuthToken(): Promise<AliyunH5AuthToken> {
  if (mockPnvsEnabled()) {
    return {
      provider: "mock",
      accessToken: `mock_access_${randomUUID().slice(0, 8)}`,
      jwtToken: `mock_jwt_${randomUUID().slice(0, 8)}`,
      requestId: `mock_pnvs_h5_auth_${randomUUID().slice(0, 8)}`,
    }
  }

  const response = await aliyunPnvsClient().getAuthToken(
    new GetAuthTokenRequest({
      bizType: 1,
      origin: requiredEnv("ALIYUN_PNVS_H5_ORIGIN", "Aliyun PNVS H5 origin is not configured."),
      sceneCode: requiredEnv("ALIYUN_PNVS_H5_SCENE_CODE", "Aliyun PNVS H5 scene code is not configured."),
      url: requiredEnv("ALIYUN_PNVS_H5_URL", "Aliyun PNVS H5 URL is not configured."),
    }),
  )
  const body = response.body
  const accessToken = body?.tokenInfo?.accessToken || ""
  const jwtToken = body?.tokenInfo?.jwtToken || ""
  if (body?.code !== "OK" || !accessToken || !jwtToken) {
    throw aliyunError("aliyun_h5", body?.code, body?.message, body?.requestId)
  }
  return {
    provider: "aliyun_h5",
    accessToken,
    jwtToken,
    requestId: body.requestId || "",
  }
}

export async function getAliyunPhoneWithH5Token(spToken: string): Promise<AliyunH5Phone> {
  const token = spToken.trim()
  if (!token) throw new Error("Aliyun H5 phone token is required.")
  if (mockPnvsEnabled()) {
    if (token === "mock-fail" || token === "mock_aliyun_h5_fail") {
      throw aliyunError("aliyun_h5", "MOCK_FAILED", "Mock Aliyun H5 token failed.", "")
    }
    return {
      provider: "mock",
      phone: process.env.PHONE_ONE_TAP_MOCK_PHONE || "+8613912345698",
      requestId: `mock_pnvs_h5_phone_${randomUUID().slice(0, 8)}`,
    }
  }

  const response = await aliyunPnvsClient().getPhoneWithToken(new GetPhoneWithTokenRequest({ spToken: token }))
  const body = response.body
  const phone = body?.data?.mobile ? `+86${mainlandPhone(body.data.mobile)}` : ""
  if (body?.code !== "OK" || !phone) {
    throw aliyunError("aliyun_h5", body?.code, body?.message, body?.requestId)
  }
  return {
    provider: "aliyun_h5",
    phone,
    requestId: body.requestId || "",
  }
}

export function aliyunErrorProvider(error: unknown, fallback: AliyunPnvsProvider) {
  if (error && typeof error === "object" && "provider" in error) {
    const provider = String((error as { provider?: unknown }).provider || "")
    if (provider === "aliyun_pnvs" || provider === "aliyun_h5") return provider
  }
  return fallback
}

function aliyunPnvsClient() {
  const accessKeyId = requiredEnv("ALIYUN_ACCESS_KEY_ID", "Aliyun access key ID is not configured.", [
    "ALIYUN_PNVS_ACCESS_KEY_ID",
    "ALIYUN_SMS_ACCESS_KEY_ID",
    "ALIBABA_CLOUD_ACCESS_KEY_ID",
  ])
  const accessKeySecret = requiredEnv("ALIYUN_ACCESS_KEY_SECRET", "Aliyun access key secret is not configured.", [
    "ALIYUN_PNVS_ACCESS_KEY_SECRET",
    "ALIYUN_SMS_ACCESS_KEY_SECRET",
    "ALIBABA_CLOUD_ACCESS_KEY_SECRET",
  ])
  const endpoint = process.env.ALIYUN_PNVS_ENDPOINT || "dypnsapi.aliyuncs.com"
  const regionId = process.env.ALIYUN_PNVS_REGION || "cn-hangzhou"
  const clientKey = `${accessKeyId}:${endpoint}:${regionId}`
  if (cachedClient && cachedClientKey === clientKey) return cachedClient
  cachedClient = new DypnsClient(new $OpenApiUtil.Config({
    accessKeyId,
    accessKeySecret,
    endpoint,
    regionId,
    readTimeout: positiveNumberEnv("ALIYUN_PNVS_READ_TIMEOUT_MS", 10000),
    connectTimeout: positiveNumberEnv("ALIYUN_PNVS_CONNECT_TIMEOUT_MS", 5000),
  }))
  cachedClientKey = clientKey
  return cachedClient
}

function aliyunSmsTemplateParam(code: string, validSeconds: number) {
  const codeName = process.env.ALIYUN_PNVS_SMS_TEMPLATE_PARAM_CODE || "code"
  const minName = process.env.ALIYUN_PNVS_SMS_TEMPLATE_PARAM_MIN ?? "min"
  const params: Record<string, string> = { [codeName]: code }
  if (minName.trim()) params[minName] = String(Math.max(1, Math.ceil(validSeconds / 60)))
  return params
}

function hasAliyunPnvsSmsTemplateCode() {
  return Boolean(
    process.env.ALIYUN_PNVS_SMS_TEMPLATE_CODE ||
      process.env.ALIYUN_PNVS_SMS_TEMPLATE_CODE_LOGIN ||
      process.env.ALIYUN_PNVS_SMS_TEMPLATE_CODE_REGISTER ||
      process.env.ALIYUN_PNVS_SMS_TEMPLATE_CODE_CHANGE_PHONE ||
      process.env.ALIYUN_PNVS_SMS_TEMPLATE_CODE_ADMIN ||
      process.env.ALIYUN_PNVS_SMS_TEMPLATE_CODE_WECHAT ||
      process.env.ALIYUN_PNVS_SMS_TEMPLATE_CODE_RESET_PASSWORD,
  )
}

function aliyunSmsTemplateCode(purpose: string) {
  const candidates = aliyunSmsTemplateCodeEnvNames(purpose)
  const value = candidates.map((name) => process.env[name]?.trim()).find(Boolean)
  if (value) return value
  throw new Error(`Aliyun PNVS SMS template code is not configured for ${purpose || "login"}.`)
}

function aliyunSmsTemplateCodeEnvNames(purpose: string) {
  switch (purpose) {
    case "register":
      return ["ALIYUN_PNVS_SMS_TEMPLATE_CODE_REGISTER", "ALIYUN_PNVS_SMS_TEMPLATE_CODE_LOGIN", "ALIYUN_PNVS_SMS_TEMPLATE_CODE"]
    case "change_phone":
      return ["ALIYUN_PNVS_SMS_TEMPLATE_CODE_CHANGE_PHONE", "ALIYUN_PNVS_SMS_TEMPLATE_CODE"]
    case "admin":
      return ["ALIYUN_PNVS_SMS_TEMPLATE_CODE_ADMIN", "ALIYUN_PNVS_SMS_TEMPLATE_CODE"]
    case "wechat":
      return ["ALIYUN_PNVS_SMS_TEMPLATE_CODE_WECHAT", "ALIYUN_PNVS_SMS_TEMPLATE_CODE"]
    case "reset_password":
      return ["ALIYUN_PNVS_SMS_TEMPLATE_CODE_RESET_PASSWORD", "ALIYUN_PNVS_SMS_TEMPLATE_CODE"]
    case "login":
    default:
      return ["ALIYUN_PNVS_SMS_TEMPLATE_CODE_LOGIN", "ALIYUN_PNVS_SMS_TEMPLATE_CODE"]
  }
}

function aliyunAccessKeyId() {
  return (
    process.env.ALIYUN_ACCESS_KEY_ID ||
    process.env.ALIYUN_PNVS_ACCESS_KEY_ID ||
    process.env.ALIYUN_SMS_ACCESS_KEY_ID ||
    process.env.ALIBABA_CLOUD_ACCESS_KEY_ID ||
    ""
  )
}

function aliyunAccessKeySecret() {
  return (
    process.env.ALIYUN_ACCESS_KEY_SECRET ||
    process.env.ALIYUN_PNVS_ACCESS_KEY_SECRET ||
    process.env.ALIYUN_SMS_ACCESS_KEY_SECRET ||
    process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET ||
    ""
  )
}

function requiredEnv(primary: string, message: string, fallbacks: string[] = []) {
  const value = [primary, ...fallbacks].map((key) => process.env[key]?.trim()).find((item) => Boolean(item))
  if (!value) throw new Error(message)
  return value
}

function mainlandPhone(phone: string) {
  const normalized = phone.trim()
  const match = normalized.match(/^\+86(1\d{10})$/)
  if (match) return match[1]
  if (/^1\d{10}$/.test(normalized)) return normalized
  if (/^861\d{10}$/.test(normalized)) return normalized.slice(2)
  throw new Error("请输入合法的中国大陆手机号。")
}

function numberEnv(name: string, fallback: number) {
  const value = Number(process.env[name] || "")
  return Number.isFinite(value) ? value : fallback
}

function positiveNumberEnv(name: string, fallback: number) {
  const value = numberEnv(name, fallback)
  return value > 0 ? value : fallback
}

function mockPnvsEnabled() {
  return process.env.ALIYUN_PNVS_MOCK === "1"
}

function mockPnvsSmsShouldFail(phone: string) {
  const failPhone = process.env.ALIYUN_PNVS_MOCK_SMS_FAIL_PHONE || ""
  if (!failPhone) return false
  try {
    return mainlandPhone(phone) === mainlandPhone(failPhone)
  } catch {
    return phone.trim() === failPhone.trim()
  }
}

function shouldReturnMockDevCode() {
  return process.env.NODE_ENV !== "production" || process.env.SMS_DEV_RETURN_CODE === "1"
}

function aliyunError(provider: AliyunPnvsProvider, code = "", message = "", requestId = "") {
  const error = new Error(message || code || "Aliyun PNVS request failed.") as Error & {
    provider: AliyunPnvsProvider
    code?: string
    requestId?: string
  }
  error.provider = provider
  error.code = code
  error.requestId = requestId
  return error
}
