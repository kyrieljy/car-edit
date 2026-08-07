import { getCatalog, getProviderApiKey } from '@/lib/server/db'
import type { ProviderConfig, ProviderCapability } from '@/lib/types'
import { applyImageParamsToFormData, applyImageParamsToJson, resolveImageParams } from './provider-param-injector'

/**
 * Provider test result item.
 * - status "available": API is reachable and authentication is valid.
 * - status "unavailable": connection failed, auth error, or server error.
 * - status "skipped": mock/local provider, or no API key configured.
 */
export type ProviderTestResult = {
  id: string
  label: string
  modelName: string
  capabilities: ProviderCapability[]
  status: 'available' | 'unavailable' | 'skipped'
  latencyMs: number
  detail: string
}

/** Test all providers concurrently and return results sorted by severity. */
export async function testAllProviders(): Promise<ProviderTestResult[]> {
  const { providers } = getCatalog()
  const results = await Promise.all(providers.map((provider) => testProvider(provider)))
  // Sort: unavailable first (needs attention), then available, then skipped.
  const rank: Record<ProviderTestResult['status'], number> = { unavailable: 0, available: 1, skipped: 2 }
  return results.sort((a, b) => rank[a.status] - rank[b.status])
}

/** Test a single provider by sending a minimal request (omitting image data). */
async function testProvider(provider: ProviderConfig): Promise<ProviderTestResult> {
  const base: ProviderTestResult = {
    id: provider.id,
    label: provider.label,
    modelName: provider.modelName,
    capabilities: provider.capabilities,
    status: 'skipped',
    latencyMs: 0,
    detail: '',
  }

  // Skip mock / local providers.
  if (provider.id === 'mock' || provider.id === 'mock-vision' || provider.id === 'mock-llm' || provider.baseUrl.startsWith('local://')) {
    base.detail = '本地 Mock，跳过测试'
    return base
  }
  // Skip providers without API key.
  if (!provider.hasApiKey) {
    base.detail = '未配置 API Key，跳过测试'
    return base
  }

  const apiKey = getProviderApiKey(provider.id)
  if (!apiKey) {
    base.detail = 'API Key 读取失败，跳过测试'
    return base
  }

  const start = Date.now()
  try {
    const outcome = await sendMinimalTestRequest(provider, apiKey)
    base.latencyMs = Date.now() - start
    base.status = outcome.status
    base.detail = outcome.detail
  } catch (error) {
    base.latencyMs = Date.now() - start
    base.status = 'unavailable'
    base.detail = error instanceof Error ? error.message : String(error)
  }
  return base
}

type TestOutcome = { status: 'available' | 'unavailable'; detail: string }

/** Determine endpoint type and send the appropriate minimal test request. */
async function sendMinimalTestRequest(provider: ProviderConfig, apiKey: string): Promise<TestOutcome> {
  const baseUrl = provider.baseUrl.replace(/\/+$/, '')
  // Resolve configured image params (no source image in a test request, so "__auto__" falls back).
  const resolvedParams = resolveImageParams(provider)
  const paramKeys = Object.keys(resolvedParams)

  // Gemini generateContent endpoint.
  if (baseUrl.includes(':generateContent')) {
    return testGeminiEndpoint(baseUrl, provider.modelName, apiKey, resolvedParams, paramKeys)
  }

  // 302 nano-banana async edit endpoint.
  if (baseUrl.includes('nano-banana')) {
    return testNanoBananaEndpoint(baseUrl, provider.modelName, apiKey, resolvedParams, paramKeys)
  }

  // OpenAI-compatible chat/completions (LLM / Vision / chat-image).
  if (baseUrl.endsWith('/chat/completions')) {
    return testChatCompletionsEndpoint(baseUrl, provider.modelName, apiKey)
  }

  // OpenAI-compatible images/generations.
  if (baseUrl.endsWith('/images/generations')) {
    return testImageGenerationEndpoint(baseUrl, provider.modelName, apiKey, resolvedParams, paramKeys)
  }

  // OpenAI-compatible images/edits (default).
  if (baseUrl.endsWith('/images/edits')) {
    return testImageEditEndpoint(baseUrl, provider.modelName, apiKey, resolvedParams, paramKeys)
  }

  // Fallback: treat unknown URL patterns as image-edit (same as generationEndpoint default).
  return testImageEditEndpoint(`${baseUrl}/images/edits`, provider.modelName, apiKey, resolvedParams, paramKeys)
}

/** Chat/completions: send text-only message with max_tokens=1. */
async function testChatCompletionsEndpoint(url: string, modelName: string, apiKey: string): Promise<TestOutcome> {
  const body = JSON.stringify({
    model: modelName,
    max_tokens: 1,
    messages: [{ role: 'user', content: 'hi' }],
  })
  return fetchAndClassify(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body,
  })
}

/** Gemini generateContent: send text-only contents with maxOutputTokens=1. */
async function testGeminiEndpoint(url: string, modelName: string, apiKey: string, resolvedParams: Record<string, string>, paramKeys: string[]): Promise<TestOutcome> {
  // Some Gemini endpoints embed the model name in the URL path; include modelName in body for safety.
  const body: Record<string, unknown> = {
    contents: [{ parts: [{ text: 'hi' }] }],
    generationConfig: { maxOutputTokens: 1 },
  }
  applyImageParamsToJson(body, resolvedParams)
  return fetchAndClassify(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  }, paramKeys)
}

/** images/generations: send minimal text prompt with n=1 (image param omitted). */
async function testImageGenerationEndpoint(url: string, modelName: string, apiKey: string, resolvedParams: Record<string, string>, paramKeys: string[]): Promise<TestOutcome> {
  const body: Record<string, unknown> = {
    model: modelName,
    prompt: 'test',
    n: 1,
  }
  applyImageParamsToJson(body, resolvedParams)
  return fetchAndClassify(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  }, paramKeys)
}

/** nano-banana async: submit minimal request without image, do not poll for results. */
async function testNanoBananaEndpoint(url: string, modelName: string, apiKey: string, resolvedParams: Record<string, string>, paramKeys: string[]): Promise<TestOutcome> {
  const body: Record<string, unknown> = {
    model: modelName,
    prompt: 'test',
  }
  applyImageParamsToJson(body, resolvedParams)
  return fetchAndClassify(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      Connection: 'close',
    },
    body: JSON.stringify(body),
  }, paramKeys)
}

/** images/edits: send FormData without image[] field (API will reject with param error, proving connectivity). */
async function testImageEditEndpoint(url: string, modelName: string, apiKey: string, resolvedParams: Record<string, string>, paramKeys: string[]): Promise<TestOutcome> {
  const formData = new FormData()
  formData.set('model', modelName)
  formData.set('prompt', 'test')
  formData.set('n', '1')
  formData.set('size', '1024x1024')
  // Intentionally omit image[] — the API will return a parameter-missing error,
  // but a successful HTTP round-trip proves the endpoint is reachable and the key is valid.
  applyImageParamsToFormData(formData, resolvedParams, url)
  return fetchAndClassify(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  }, paramKeys)
}

/**
 * Execute a fetch with 15s timeout, classify the HTTP response status.
 * - 2xx / 400 / 422 / 429 -> available (connectivity + auth OK), unless the 4xx body references a
 *   configured param key, in which case it is a parameter-configuration error.
 * - 401 / 403 / 404 / 5xx  -> unavailable (auth failure, wrong URL, or server error).
 * - Network errors / timeout -> unavailable.
 */
async function fetchAndClassify(url: string, init: RequestInit, paramKeys: string[] = []): Promise<TestOutcome> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15_000)
  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    const status = response.status
    if (status === 400 || status === 422) {
      const text = await readErrorText(response).catch(() => '')
      const matched = paramKeys.find((key) => key && text.toLowerCase().includes(key.toLowerCase()))
      if (matched) {
        const excerpt = text.length > 200 ? `${text.slice(0, 200)}…` : text
        return { status: 'unavailable', detail: `HTTP ${status} — 参数配置错误（"${matched}"）：${excerpt}` }
      }
    }
    return classifyHttpStatus(status)
  } catch (error) {
    if ((error as { name?: string }).name === 'AbortError') {
      return { status: 'unavailable', detail: '连接超时（15s）' }
    }
    return { status: 'unavailable', detail: error instanceof Error ? error.message : String(error) }
  } finally {
    clearTimeout(timeout)
  }
}

async function readErrorText(response: Response): Promise<string> {
  try {
    return await response.text()
  } catch {
    return ''
  }
}

/** Map HTTP status code to test outcome with descriptive detail. */
function classifyHttpStatus(status: number): TestOutcome {
  if (status >= 200 && status < 300) {
    return { status: 'available', detail: `HTTP ${status} — 正常返回` }
  }
  if (status === 400 || status === 422) {
    return { status: 'available', detail: `HTTP ${status} — 参数缺失（连通性和鉴权正常）` }
  }
  if (status === 429) {
    return { status: 'available', detail: `HTTP 429 — 限流（连通性和鉴权正常）` }
  }
  if (status === 401 || status === 403) {
    return { status: 'unavailable', detail: `HTTP ${status} — 鉴权失败（API Key 无效或权限不足）` }
  }
  if (status === 404) {
    return { status: 'unavailable', detail: 'HTTP 404 — URL 错误或模型不存在' }
  }
  if (status >= 500) {
    return { status: 'unavailable', detail: `HTTP ${status} — 服务端错误` }
  }
  return { status: 'unavailable', detail: `HTTP ${status} — 未预期的状态码` }
}
