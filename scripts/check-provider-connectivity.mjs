import { createDecipheriv, createHash } from "node:crypto"
import { DatabaseSync } from "node:sqlite"

const live = process.argv.includes("--live")
const db = new DatabaseSync("data/car_mod_effect.sqlite")
const rows = db
  .prepare(
    "SELECT id, label, base_url, model_name, capabilities_json, enabled, active, api_key_cipher, api_key_masked FROM provider_configs ORDER BY id",
  )
  .all()

const providers = rows.map((row) => ({
  id: String(row.id),
  label: normalizedProviderLabel(String(row.id), String(row.label || "")),
  baseUrl: normalize302BaseUrl(String(row.base_url || "")),
  modelName: String(row.model_name || ""),
  capabilities: safeJson(String(row.capabilities_json || "[]"), []),
  enabled: Boolean(row.enabled),
  active: Boolean(row.active),
  apiKey: live ? decryptSecret(String(row.api_key_cipher || "")) : "",
  hasStoredKey: Boolean(row.api_key_cipher || row.api_key_masked),
  maskedKey: String(row.api_key_masked || ""),
}))

const REQUEST_TIMEOUT_MS = 60_000

for (const provider of providers) {
  const local = provider.baseUrl.startsWith("local://")
  if (local) {
    print({
      id: provider.id,
      label: provider.label,
      model: provider.modelName,
      baseUrl: provider.baseUrl,
      status: "skipped",
      reason: "local mock provider",
    })
    continue
  }
  if (!provider.enabled) {
    print({
      id: provider.id,
      label: provider.label,
      model: provider.modelName,
      baseUrl: provider.baseUrl,
      status: "skipped",
      reason: "provider disabled",
      hasStoredKey: provider.hasStoredKey,
      maskedKey: provider.maskedKey,
    })
    continue
  }
  if (!live) {
    print({
      id: provider.id,
      label: provider.label,
      model: provider.modelName,
      baseUrl: provider.baseUrl,
      active: provider.active,
      capabilities: provider.capabilities,
      status: "dry_run",
      hasStoredKey: provider.hasStoredKey,
      maskedKey: provider.maskedKey,
      reason: "No provider request sent. Re-run with --live only after user approval because live checks can spend credits.",
    })
    continue
  }
  if (!provider.apiKey) {
    print({
      id: provider.id,
      label: provider.label,
      model: provider.modelName,
      baseUrl: provider.baseUrl,
      status: "failed",
      reason: "missing api key",
      maskedKey: provider.maskedKey,
    })
    continue
  }

  const started = Date.now()
  try {
    const result = provider.capabilities.includes("image_generation")
      ? await testImageGeneration(provider)
      : await testChatCompletions(provider)
    print({
      id: provider.id,
      label: provider.label,
      model: provider.modelName,
      baseUrl: provider.baseUrl,
      active: provider.active,
      capabilities: provider.capabilities,
      latencyMs: Date.now() - started,
      ...result,
    })
  } catch (error) {
    print({
      id: provider.id,
      label: provider.label,
      model: provider.modelName,
      baseUrl: provider.baseUrl,
      active: provider.active,
      capabilities: provider.capabilities,
      latencyMs: Date.now() - started,
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

async function testChatCompletions(provider) {
  const endpoint = chatEndpoint(provider.baseUrl)
  const response = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({
      model: provider.modelName,
      temperature: 0,
      max_tokens: 4,
      messages: [{ role: "user", content: "Reply OK only." }],
    }),
  }, REQUEST_TIMEOUT_MS)
  const payload = await readResponse(response)
  return classifyResponse(response, payload, endpoint, (raw) => {
    const choice = Array.isArray(raw.choices) ? raw.choices[0] : undefined
    const content = choice?.message?.content
    return typeof content === "string" ? content.slice(0, 80) : ""
  })
}

async function testImageGeneration(provider) {
  const endpoint = provider.baseUrl.replace(/\/+$/, "")
  const response = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify(imageGenerationPayload(provider.modelName, "Connectivity test image: a plain gray square. No text.")),
  }, REQUEST_TIMEOUT_MS)
  const payload = await readResponse(response)
  return classifyResponse(response, payload, endpoint, (raw) => {
    const data = Array.isArray(raw.data) ? raw.data : []
    const imageUrl = data[0]?.url || data[0]?.b64_json
    if (imageUrl) return data[0]?.url ? "returned image url" : "returned base64 image"
    const inlineData = findInlineData(raw)
    return inlineData ? "returned inline image data" : ""
  })
}

function classifyResponse(response, payload, endpoint, successSummary) {
  const raw = payload.raw
  const message = providerErrorMessage(raw) || textSnippet(payload.text) || response.statusText
  const balanceRelated = /余额|balance|insufficient|quota|credit|billing|payment|fund|tokens plan/i.test(message)
  if (!response.ok) {
    return {
      status: balanceRelated ? "balance_or_quota_error" : "failed",
      httpStatus: response.status,
      endpoint,
      error: message,
      rawCode: raw.code || raw.error?.code || raw.error?.type || "",
    }
  }
  return {
    status: "ok",
    httpStatus: response.status,
    endpoint,
    responseSummary: successSummary(raw),
    usage: raw.usage || raw.usageMetadata || "",
  }
}

async function readResponse(response) {
  const text = await response.text()
  if (!text.trim()) return { raw: {}, text: "" }
  try {
    const parsed = JSON.parse(text)
    return { raw: parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : { value: parsed }, text }
  } catch {
    return { raw: { body: textSnippet(text) }, text }
  }
}

function providerErrorMessage(raw) {
  if (typeof raw.error === "string") return raw.error
  if (raw.error && typeof raw.error === "object") {
    return String(raw.error.message || raw.error.code || raw.error.type || "")
  }
  return String(raw.message || raw.msg || raw.fail_reason || raw.reason || "")
}

function findInlineData(value) {
  if (!value || typeof value !== "object") return false
  if (value.inlineData?.data || value.inline_data?.data) return true
  return Object.values(value).some((child) => (Array.isArray(child) ? child.some(findInlineData) : findInlineData(child)))
}

function chatEndpoint(baseUrl) {
  const normalized = (baseUrl || "").replace(/\/+$/, "")
  return normalized.endsWith("/chat/completions") ? normalized : `${normalized}/chat/completions`
}

function normalize302BaseUrl(value) {
  try {
    const url = new URL(value)
    if (url.hostname.toLowerCase() === "api.302.ai") {
      url.protocol = "https:"
      url.hostname = "api.302ai.cn"
      return url.toString()
    }
  } catch {
    return value
  }
  return value
}

function normalizedProviderLabel(id, label) {
  if (id === "provider_302_nano_banana2_async_edit") return "302-Nano Banana 2 Async Edit"
  return label
}

function imageGenerationPayload(modelName, prompt) {
  const payload = {
    model: modelName,
    prompt,
    n: 1,
  }
  if (modelName.startsWith("google/")) {
    payload.image_size = "1K"
  } else {
    payload.size = "1024x1024"
  }
  return payload
}

async function fetchWithTimeout(input, init, timeoutMs) {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (error) {
    if (error?.name === "AbortError") throw new Error(`request timed out after ${Math.round(timeoutMs / 1000)}s`)
    throw error
  } finally {
    clearTimeout(timeout)
  }
}

function safeJson(value, fallback) {
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function decryptSecret(value) {
  if (!value.startsWith("v1:")) return ""
  try {
    const [, ivValue, tagValue, encryptedValue] = value.split(":")
    const decipher = createDecipheriv("aes-256-gcm", providerSecretKey(), Buffer.from(ivValue, "base64"))
    decipher.setAuthTag(Buffer.from(tagValue, "base64"))
    return Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64")), decipher.final()]).toString("utf8")
  } catch {
    return ""
  }
}

function providerSecretKey() {
  const secret = process.env.CAR_MOD_SECRET || process.env.AUTH_SECRET || "car-mod-effect-studio-local-dev-secret"
  return createHash("sha256").update(secret).digest()
}

function textSnippet(value, limit = 500) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit)
}

function print(value) {
  console.log(JSON.stringify(value))
}
