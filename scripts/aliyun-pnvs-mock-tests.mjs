import { spawn } from "node:child_process"

const cwd = process.cwd()
const baseUrl = process.env.ALIYUN_AUTH_TEST_BASE_URL || "http://127.0.0.1:3125"
const basePort = new URL(baseUrl).port || "3125"
const runId = `${Date.now()}${Math.floor(Math.random() * 1000)}`
const testIp = `10.${Number(runId.slice(-6, -4)) || 18}.${Number(runId.slice(-4, -2)) || 43}.${Number(runId.slice(-2)) || 92}`
const phones = {
  sms: `132${runId.slice(-8)}`,
  smsFail: `131${runId.slice(-8)}`,
  oneTap: `137${runId.slice(-8)}`,
}

const server = spawn(process.execPath, ["scripts/start-next-dev.mjs"], {
  cwd,
  env: {
    ...process.env,
    PORT: process.env.PORT || basePort,
    SMS_PROVIDER: "aliyun_pnvs",
    PHONE_ONE_TAP_PROVIDER: "aliyun_h5",
    ALIYUN_PNVS_MOCK: "1",
    ALIYUN_PNVS_MOCK_SMS_FAIL_PHONE: phones.smsFail,
    PHONE_ONE_TAP_MOCK_PHONE: phones.oneTap,
  },
  stdio: ["ignore", "pipe", "pipe"],
})

let serverLog = ""
server.stdout.on("data", (chunk) => {
  serverLog += chunk.toString()
})
server.stderr.on("data", (chunk) => {
  serverLog += chunk.toString()
})

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForServer() {
  for (let index = 0; index < 80; index += 1) {
    try {
      const response = await fetch(baseUrl, { signal: AbortSignal.timeout(2000) })
      if (response.status < 500) return
    } catch {
      await sleep(500)
    }
  }
  throw new Error(`Aliyun auth mock dev server did not become ready.\n${serverLog}`)
}

function sessionCookie(response) {
  const raw = response.headers.get("set-cookie") || ""
  return raw
    .split(",")
    .map((item) => item.trim())
    .find((item) => item.startsWith("car_mod_session="))
    ?.split(";")[0] || ""
}

async function post(path, body = {}, expectedStatus = undefined) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": testIp },
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(async () => ({ raw: await response.text().catch(() => "") }))
  if (expectedStatus !== undefined && response.status !== expectedStatus) {
    throw new Error(`${path} expected ${expectedStatus}, got ${response.status}: ${JSON.stringify(data)}`)
  }
  return { response, data }
}

function assert(pass, message) {
  if (!pass) throw new Error(message)
}

async function sendCode(phone, purpose) {
  const result = await post("/api/auth/send-code", { phone, purpose }, 200)
  assert(/^\d{6}$/.test(String(result.data.devCode || "")), `PNVS mock SMS should return a 6 digit devCode for ${phone}.`)
  return result.data.devCode
}

async function testPnvsMockSmsRegister() {
  const code = await sendCode(phones.sms, "register")
  const username = `pnvs_${runId}`
  const created = await post("/api/auth/register", {
    username,
    phone: phones.sms,
    password: "AuthTest@1234",
    code,
    purpose: "register",
  }, 201)
  assert(created.data.user?.username === username, "PNVS mock code should complete phone registration.")
  assert(created.data.user?.phone?.endsWith(phones.sms), "PNVS mock registration should bind the requested phone.")
  assert(Boolean(sessionCookie(created.response)), "PNVS mock registration should set a session cookie.")
}

async function testPnvsMockSmsFailure() {
  const failed = await post("/api/auth/send-code", { phone: phones.smsFail, purpose: "login" }, 400)
  assert(String(failed.data.error || "").includes("Mock Aliyun PNVS SMS failed"), "PNVS mock failure should surface the provider error.")
}

async function testAliyunH5MockTokenAndLogin() {
  const token = await post("/api/auth/one-tap/token", {}, 200)
  assert(token.data.provider === "mock", "Aliyun H5 mock auth token should be marked as mock.")
  assert(Boolean(token.data.accessToken && token.data.jwtToken), "Aliyun H5 mock auth token should include SDK tokens.")

  const login = await post("/api/auth/one-tap", { spToken: "mock_aliyun_h5_success", platform: "web_h5" }, 200)
  assert(login.data.provider === "mock", "Aliyun H5 mock phone exchange should be marked as mock.")
  assert(login.data.user?.phone?.endsWith(phones.oneTap), "Aliyun H5 mock one-tap should use PHONE_ONE_TAP_MOCK_PHONE.")
  assert(Boolean(sessionCookie(login.response)), "Aliyun H5 mock one-tap should set a session cookie.")
}

async function testAliyunH5MockFailure() {
  const failed = await post("/api/auth/one-tap", { spToken: "mock-fail", platform: "web_h5" }, 400)
  assert(String(failed.data.error || "").includes("Mock Aliyun H5 token failed"), "Aliyun H5 mock failure should surface the provider error.")
}

const tests = [
  ["PNVS mock SMS register", testPnvsMockSmsRegister],
  ["PNVS mock SMS failure", testPnvsMockSmsFailure],
  ["Aliyun H5 mock token + one-tap login", testAliyunH5MockTokenAndLogin],
  ["Aliyun H5 mock token failure", testAliyunH5MockFailure],
]

try {
  await waitForServer()
  const results = []
  for (const [name, fn] of tests) {
    const startedAt = Date.now()
    await fn()
    results.push({ name, ok: true, ms: Date.now() - startedAt })
  }
  console.log(JSON.stringify({ total: results.length, passed: results.length, failed: 0, results }, null, 2))
} finally {
  try {
    if (server.pid) {
      const { execFileSync } = await import("node:child_process")
      execFileSync("taskkill.exe", ["/PID", String(server.pid), "/T", "/F"], { stdio: "ignore" })
    }
  } catch {
    server.kill("SIGTERM")
  }
  server.stdout.destroy()
  server.stderr.destroy()
}
