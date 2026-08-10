import { randomUUID } from "node:crypto"

export type EmailDeliveryResult = {
  provider: "smtp" | "resend" | "mock"
  requestId: string
  devCode?: string
}

type EmailPurpose = "login" | "register"

const EMAIL_PURPOSE_SUBJECT: Record<EmailPurpose, { zh: string; en: string }> = {
  login: { zh: "OnCar AI 登录验证码", en: "OnCar AI login code" },
  register: { zh: "OnCar AI 注册验证码", en: "OnCar AI register code" },
}

export async function sendVerificationEmail(input: { email: string; code: string; purpose: EmailPurpose }): Promise<EmailDeliveryResult> {
  const provider = emailProvider()
  if (shouldUseMockEmail(provider)) {
    return {
      provider: "mock",
      requestId: `mock_${randomUUID().slice(0, 8)}`,
      devCode: process.env.NODE_ENV === "production" && process.env.EMAIL_DEV_RETURN_CODE !== "1" ? undefined : input.code,
    }
  }

  try {
    if (provider === "resend" || (provider === "" && hasResendConfig())) {
      return await sendResendEmail(input)
    }
    return await sendSmtpEmail(input)
  } catch (error) {
    throw emailDeliveryError(error, provider === "resend" ? "resend" : "smtp")
  }
}

export function emailFailureProvider(error: unknown): "smtp" | "resend" {
  const configured = emailProvider()
  if (configured === "resend") return "resend"
  return "smtp"
}

function emailProvider() {
  return (process.env.EMAIL_PROVIDER || "").trim().toLowerCase()
}

function shouldUseMockEmail(provider: string) {
  if (provider === "mock") return true
  if (provider === "smtp" || provider === "resend") return false
  return process.env.NODE_ENV !== "production" && !hasResendConfig() && !hasSmtpConfig()
}

function hasResendConfig() {
  return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM)
}

function hasSmtpConfig() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
}

function buildEmailHtml(email: string, code: string, purpose: EmailPurpose) {
  const subject = EMAIL_PURPOSE_SUBJECT[purpose].zh
  return `<!doctype html>
<html lang="zh">
  <body style="margin:0;padding:24px;background:#f5f5f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1d1d1f;">
    <div style="max-width:420px;margin:0 auto;background:#fff;border-radius:12px;padding:28px 26px;box-shadow:0 6px 24px rgba(0,0,0,.06);">
      <h2 style="margin:0 0 12px;font-size:18px;">${subject}</h2>
      <p style="margin:0 0 16px;font-size:14px;color:#515154;">您好，您正在使用邮箱验证码${purpose === "register" ? "注册" : "登录"} OnCar AI。验证码 10 分钟内有效，请勿泄露给他人。</p>
      <div style="font-size:30px;font-weight:700;letter-spacing:6px;color:#0a84ff;margin:8px 0 18px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;">${code}</div>
      <p style="margin:0;font-size:12px;color:#86868b;">若非本人操作，请忽略此邮件。邮箱：${email}</p>
    </div>
  </body>
</html>`
}

async function sendResendEmail(input: { email: string; code: string; purpose: EmailPurpose }): Promise<EmailDeliveryResult> {
  const apiKey = process.env.RESEND_API_KEY || ""
  const from = process.env.RESEND_FROM || ""
  if (!apiKey || !from) throw new Error("Resend email is not configured.")
  const subject = EMAIL_PURPOSE_SUBJECT[input.purpose].en
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      from,
      to: [input.email],
      subject,
      html: buildEmailHtml(input.email, input.code, input.purpose),
    }),
  })
  const body = (await response.json().catch(() => ({}))) as { id?: string; message?: string }
  if (!response.ok) throw new Error(body.message || `Resend failed with HTTP ${response.status}.`)
  return { provider: "resend", requestId: body.id || `resend_${randomUUID().slice(0, 8)}` }
}

async function sendSmtpEmail(input: { email: string; code: string; purpose: EmailPurpose }): Promise<EmailDeliveryResult> {
  const host = process.env.SMTP_HOST || ""
  const port = Number(process.env.SMTP_PORT || "465")
  const user = process.env.SMTP_USER || ""
  const pass = process.env.SMTP_PASS || ""
  const from = process.env.EMAIL_FROM || user
  const secure = (process.env.SMTP_SECURE ?? "true") !== "false"
  if (!host || !user || !pass) throw new Error("SMTP email is not configured.")
  let nodemailer: typeof import("nodemailer")
  try {
    nodemailer = await import("nodemailer")
  } catch {
    throw new Error("SMTP provider requires the 'nodemailer' package. Install it to enable SMTP delivery.")
  }
  const transporter = nodemailer.createTransport({ host, port, secure, auth: { user, pass } })
  const subject = EMAIL_PURPOSE_SUBJECT[input.purpose].zh
  const info = await transporter.sendMail({
    from,
    to: input.email,
    subject,
    html: buildEmailHtml(input.email, input.code, input.purpose),
  })
  return { provider: "smtp", requestId: String(info.messageId || `smtp_${randomUUID().slice(0, 8)}`) }
}

function emailDeliveryError(error: unknown, provider: "smtp" | "resend") {
  const next = error instanceof Error ? error : new Error("Email delivery failed.")
  ;(next as Error & { provider?: string }).provider = provider
  return next
}
