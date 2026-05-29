const baseUrl = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3000"

async function request(path, options = {}) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 3500)
  try {
    const response = await fetch(`${baseUrl}${path}`, { ...options, signal: controller.signal })
    const text = await response.text()
    let body = null
    try {
      body = text ? JSON.parse(text) : null
    } catch {
      body = text
    }
    return { response, body }
  } finally {
    clearTimeout(timer)
  }
}

async function main() {
  try {
    await request("/api/catalog")
  } catch {
    console.log(`Smoke skipped: ${baseUrl} is not running.`)
    return
  }

  const catalog = await request("/api/catalog")
  assert(catalog.response.ok, "catalog should return 200")
  assert(Array.isArray(catalog.body.categories), "catalog should include categories")

  const code = await request("/api/auth/send-code", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone: "+8613800000000", purpose: "login" }),
  })
  assert(code.response.ok, "send-code should return 200")

  const adminGuard = await request("/api/admin/summary")
  assert(adminGuard.response.status === 401, "admin summary should be protected")

  const promptTemplateGuard = await request("/api/admin/prompt-templates")
  assert(promptTemplateGuard.response.status === 401, "admin prompt templates should be protected")

  const suggestions = await request("/api/chat/suggestions")
  assert(suggestions.response.ok, "chat suggestions should return 200")
  assert(Array.isArray(suggestions.body.prompts), "chat suggestions should include prompts")

  const generationGuard = await request("/api/generations", { method: "POST", body: new FormData() })
  assert(generationGuard.response.status === 401, "generation should require login")

  console.log("Smoke passed: catalog, auth code, admin guard, prompt templates guard, chat suggestions, generation guard.")
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Smoke failed: ${message}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
