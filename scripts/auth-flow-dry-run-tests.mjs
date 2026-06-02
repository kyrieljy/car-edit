import { spawn } from "node:child_process"
import fs from "node:fs/promises"

const cwd = process.cwd()
const baseUrl = process.env.AUTH_TEST_BASE_URL || "http://127.0.0.1:3124"
const basePort = new URL(baseUrl).port || "3124"
const runId = `${Date.now()}${Math.floor(Math.random() * 1000)}`
const testIp = `10.${Number(runId.slice(-6, -4)) || 17}.${Number(runId.slice(-4, -2)) || 42}.${Number(runId.slice(-2)) || 91}`
const phones = {
  existing: `139${runId.slice(-8)}`,
  pcBind: `138${runId.slice(-8)}`,
  oneTap: `137${runId.slice(-8)}`,
  mobileRegister: `136${runId.slice(-8)}`,
  wrongCode: `135${runId.slice(-8)}`,
}

const server = spawn(process.execPath, ["scripts/start-next-dev.mjs"], {
  cwd,
  env: {
    ...process.env,
    PORT: process.env.PORT || basePort,
    SMS_PROVIDER: "mock",
    PHONE_ONE_TAP_PROVIDER: "mock",
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
  throw new Error(`Auth test dev server did not become ready.\n${serverLog}`)
}

function sessionCookie(response) {
  const raw = response.headers.get("set-cookie") || ""
  return raw
    .split(",")
    .map((item) => item.trim())
    .find((item) => item.startsWith("car_mod_session="))
    ?.split(";")[0] || ""
}

async function post(path, body, expectedStatus = undefined) {
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

async function patchWithCookie(path, body, cookie, expectedStatus = undefined) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", "x-forwarded-for": testIp, cookie },
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(async () => ({ raw: await response.text().catch(() => "") }))
  if (expectedStatus !== undefined && response.status !== expectedStatus) {
    throw new Error(`${path} expected ${expectedStatus}, got ${response.status}: ${JSON.stringify(data)}`)
  }
  return { response, data }
}

async function postWithCookie(path, body, cookie, expectedStatus = undefined) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": testIp, cookie },
    body: JSON.stringify(body),
  })
  const data = await response.json().catch(async () => ({ raw: await response.text().catch(() => "") }))
  if (expectedStatus !== undefined && response.status !== expectedStatus) {
    throw new Error(`${path} expected ${expectedStatus}, got ${response.status}: ${JSON.stringify(data)}`)
  }
  return { response, data }
}

async function getJson(path, expectedStatus = undefined, cookie = "") {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: cookie ? { cookie } : undefined,
  })
  const data = await response.json().catch(async () => ({ raw: await response.text().catch(() => "") }))
  if (expectedStatus !== undefined && response.status !== expectedStatus) {
    throw new Error(`${path} expected ${expectedStatus}, got ${response.status}: ${JSON.stringify(data)}`)
  }
  return { response, data }
}

async function sendCode(phone, purpose) {
  const result = await post("/api/auth/send-code", { phone, purpose }, 200)
  if (!result.data.devCode) throw new Error(`Mock SMS did not return devCode for ${phone}/${purpose}.`)
  return result.data.devCode
}

function assert(pass, message) {
  if (!pass) throw new Error(message)
}

async function testExistingPhoneLogin() {
  const registerCode = await sendCode(phones.existing, "register")
  const username = `existing_${runId}`
  const created = await post("/api/auth/register", {
    username,
    phone: phones.existing,
    password: "AuthTest@1234",
    code: registerCode,
    purpose: "register",
  }, 201)
  assert(created.data.user?.phone?.endsWith(phones.existing), "Existing seed user phone mismatch.")

  const loginCode = await sendCode(phones.existing, "login")
  const login = await post("/api/auth/login", { mode: "code", phone: phones.existing, code: loginCode, bindRequired: true }, 200)
  assert(login.data.user?.id === created.data.user.id, "PC phone-code login should return existing user.")
  assert(Boolean(sessionCookie(login.response)), "Existing phone-code login should set session cookie.")
}

async function testPcPhoneBinding() {
  const code = await sendCode(phones.pcBind, "login")
  const probe = await post("/api/auth/login", { mode: "code", phone: phones.pcBind, code, bindRequired: true }, 200)
  assert(probe.data.requiresBinding === true, "New PC phone-code login should require binding.")
  assert(!sessionCookie(probe.response), "Binding probe must not create a session.")

  const username = `pcbind_${runId}`
  const bound = await post("/api/auth/register", {
    username,
    phone: phones.pcBind,
    password: "AuthTest@1234",
    code,
    purpose: "login",
  }, 201)
  assert(bound.data.user?.username === username, "PC binding should create the requested username.")
  assert(Boolean(sessionCookie(bound.response)), "PC binding should set session cookie.")
}

async function testOneTapMock() {
  const result = await post("/api/auth/one-tap", { token: "mock-one-tap", platform: "web_h5" }, 200)
  assert(result.data.user?.phone?.endsWith(phones.oneTap), "Mock one-tap should use PHONE_ONE_TAP_MOCK_PHONE.")
  assert(result.data.user?.username?.startsWith("u_"), "Mock one-tap auto-created user should use phone username naming.")
  assert(result.data.user?.name === `MOD\u7528\u6237_${result.data.user.username.slice(2)}`, "Mock one-tap auto-created user should use MOD default nickname.")
  assert(result.data.user?.avatarId === "person_default", "Mock one-tap auto-created user should use default avatar id.")
  assert(String(result.data.user?.avatarUrl || "").includes("/assets/avatars/person_default.png"), "Mock one-tap auto-created user should return default avatar URL.")
  const cookie = sessionCookie(result.response)
  assert(Boolean(cookie), "Mock one-tap should set session cookie.")

  const avatarList = await getJson("/api/account/avatar-presets", 200, cookie)
  assert(avatarList.data.avatars?.some((avatar) => avatar.id === "person_default"), "Avatar preset list should include active default avatar.")
  const alternateAvatar = avatarList.data.avatars?.find((avatar) => avatar.id !== "person_default")
  assert(Boolean(alternateAvatar), "Avatar preset list should include a second active avatar.")
  const updated = await patchWithCookie("/api/auth/me", {
    name: result.data.user.name,
    email: result.data.user.email || "",
    avatarId: alternateAvatar.id,
  }, cookie, 200)
  assert(updated.data.user?.avatarId === alternateAvatar.id, "Profile update should accept an active avatar id.")
  assert(updated.data.user?.avatarUrl === alternateAvatar.imageUrl, "Profile update should return selected avatar URL.")
  const invalid = await patchWithCookie("/api/auth/me", {
    name: result.data.user.name,
    email: result.data.user.email || "",
    avatarId: "not_existing_avatar",
  }, cookie, 400)
  assert(String(invalid.data.error || "").includes("Avatar preset"), "Invalid avatar id should be rejected.")
}

async function testPhoneOnlyPasswordNotSet() {
  const result = await post("/api/auth/login", { mode: "password", identifier: phones.oneTap, password: "AuthTest@1234" }, 401)
  assert(result.data.code === "PASSWORD_NOT_SET", "Phone-only auto-created users should return PASSWORD_NOT_SET on password login.")
}

async function testMobileOtherPhoneRegister() {
  const code = await sendCode(phones.mobileRegister, "register")
  const username = `mobile_${runId}`
  const result = await post("/api/auth/register", {
    username,
    phone: phones.mobileRegister,
    password: "AuthTest@1234",
    code,
    purpose: "register",
  }, 201)
  assert(result.data.user?.username === username, "Mobile other-phone register should bind username/password.")

  const login = await post("/api/auth/login", { mode: "password", identifier: username, password: "AuthTest@1234" }, 200)
  assert(login.data.user?.id === result.data.user.id, "Password login should work after phone registration.")
}

async function testBillingCheckoutDisabled() {
  const login = await post("/api/auth/login", { mode: "password", identifier: `mobile_${runId}`, password: "AuthTest@1234" }, 200)
  const cookie = sessionCookie(login.response)
  assert(Boolean(cookie), "Billing checkout test should have a logged-in user session.")

  const checkout = await postWithCookie("/api/billing/checkout", { planId: "max", method: "wechat" }, cookie, 403)
  assert(checkout.data.code === "SUBSCRIPTION_MANAGED_BY_ADMIN", "Checkout should be disabled for test users.")

  const mockPaid = await postWithCookie("/api/billing/mock-paid", { orderId: "order_mock" }, cookie, 403)
  assert(mockPaid.data.code === "SUBSCRIPTION_MANAGED_BY_ADMIN", "Mock payment completion should be disabled for test users.")
}

async function testDuplicateRegisterWarnings() {
  const sendResult = await post("/api/auth/send-code", { phone: phones.existing, purpose: "register" }, 409)
  assert(sendResult.data.code === "PHONE_ALREADY_REGISTERED", "Duplicate register send-code should return PHONE_ALREADY_REGISTERED.")
  assert(typeof sendResult.data.username === "string" && sendResult.data.username.startsWith("existing_"), "Duplicate register send-code should return bound username.")

  const registerResult = await post("/api/auth/register", {
    username: `dup_${runId}`,
    phone: phones.existing,
    password: "AuthTest@1234",
    code: "000000",
    purpose: "register",
  }, 409)
  assert(registerResult.data.code === "PHONE_ALREADY_REGISTERED", "Duplicate register submit should return PHONE_ALREADY_REGISTERED.")
  assert(registerResult.data.username === sendResult.data.username, "Duplicate submit should return the same bound username.")
}

async function testUsernameRegisterWarning() {
  const result = await post("/api/auth/register", {
    username: `existing_${runId}`,
    phone: `133${runId.slice(-8)}`,
    password: "AuthTest@1234",
    code: "000000",
    purpose: "register",
  }, 409)
  assert(result.data.code === "USERNAME_ALREADY_REGISTERED", "Duplicate username register should return USERNAME_ALREADY_REGISTERED.")
  assert(String(result.data.error || "").includes("用户名已存在"), "Duplicate username register should tell the user to enter another username.")
}

async function testForgotPasswordReset() {
  const resetCode = await sendCode(phones.mobileRegister, "reset_password")
  const reset = await post("/api/auth/reset-password", {
    phone: phones.mobileRegister,
    code: resetCode,
    nextPassword: "AuthReset@1234",
  }, 200)
  assert(reset.data.ok === true, "Reset password should return ok=true.")

  await post("/api/auth/login", { mode: "password", identifier: `mobile_${runId}`, password: "AuthTest@1234" }, 401)
  const login = await post("/api/auth/login", { mode: "password", identifier: `mobile_${runId}`, password: "AuthReset@1234" }, 200)
  assert(login.data.user?.phone?.endsWith(phones.mobileRegister), "New password should login the reset user.")

  await post("/api/auth/send-code", { phone: `134${runId.slice(-8)}`, purpose: "reset_password" }, 404)
  const weakCode = await sendCode(phones.existing, "reset_password")
  await post("/api/auth/reset-password", { phone: phones.existing, code: weakCode, nextPassword: "weak" }, 400)
}

async function testSecurityRegressions() {
  const code = await sendCode(phones.wrongCode, "login")
  await post("/api/auth/login", { mode: "code", phone: phones.wrongCode, code: code === "000000" ? "111111" : "000000" }, 401)
  const invalidPhone = await post("/api/auth/send-code", { phone: "13717382", purpose: "login" }, 400)
  assert(invalidPhone.data.code === "INVALID_PHONE", "Invalid phone should be rejected before sending a code.")
  await post("/api/auth/send-code", { phone: "18928268686", purpose: "login" }, 400)
}

async function testSocialButtonsArePlaceholders() {
  const source = await fs.readFile("components/auth-modal.tsx", "utf8")
  assert(source.includes("socialPlaceholder"), "Auth modal should route social buttons to placeholder handler.")
  assert(!source.includes("/api/auth/wechat/mock"), "Auth modal should not call mock WeChat auth from social buttons.")
  assert(!source.includes("/api/auth/google") && !source.includes("/api/auth/qq") && !source.includes("/api/auth/apple"), "Auth modal should not call real social auth endpoints yet.")
  assert(!source.includes("auth-flow-"), "Auth modal should use the restored auth-template/auth-mobile visual system.")
}

const tests = [
  ["existing phone code login", testExistingPhoneLogin],
  ["PC phone-code binding", testPcPhoneBinding],
  ["mobile mock one-tap login", testOneTapMock],
  ["phone-only password-not-set warning", testPhoneOnlyPasswordNotSet],
  ["mobile other-phone register + password login", testMobileOtherPhoneRegister],
  ["billing checkout disabled", testBillingCheckoutDisabled],
  ["duplicate register warnings", testDuplicateRegisterWarnings],
  ["duplicate username warning", testUsernameRegisterWarning],
  ["forgot password reset", testForgotPasswordReset],
  ["security regressions", testSecurityRegressions],
  ["social buttons placeholder only", testSocialButtonsArePlaceholders],
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
