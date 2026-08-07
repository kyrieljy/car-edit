// Isomorphic (client + server) helpers for provider image-generation parameter configuration.
// This module must not import any Node-only API so it can be shared by both the admin UI and the
// generation engine. Endpoint-classification predicates used to live in generation-provider.ts and
// are re-exported here so there is a single source of truth.

import type { ImageParamTemplateKey, ProviderImageParam, ProviderOptions } from './types'

// Reserved values that are not literal API values.
export const IMAGE_PARAM_VALUE_NONE = '' // 不传：parameter is omitted from the request.
export const IMAGE_PARAM_VALUE_AUTO = '__auto__' // 跟随原图：resolved at runtime by adaptive logic.

// Display labels for the reserved values.
export const IMAGE_PARAM_RESERVE_LABELS: Record<string, string> = {
  [IMAGE_PARAM_VALUE_AUTO]: '跟随原图',
  [IMAGE_PARAM_VALUE_NONE]: '不传（使用平台默认）',
}

export const IMAGE_PARAM_MAX_COUNT = 20

// ---------------------------------------------------------------------------
// Endpoint-classification predicates (pure, URL-only)
// ---------------------------------------------------------------------------

export function is302ApiHost(host: string) {
  return host === 'api.302.ai' || host === 'api.302ai.cn' || host === 'api.302ai.com'
}

export function is302GeminiOriginalImageEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint)
    const host = url.hostname.toLowerCase()
    return is302ApiHost(host) && url.pathname.includes('/google/v1/models/gemini-')
  } catch {
    return false
  }
}

export function isYunwuGeminiGenerateContentEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint)
    return url.hostname.toLowerCase() === 'yunwu.ai' && url.pathname.includes('/v1beta/models/gemini-') && url.pathname.endsWith(':generateContent')
  } catch {
    return false
  }
}

export function isGeminiGenerateContentImageEndpoint(endpoint: string) {
  return is302GeminiOriginalImageEndpoint(endpoint) || isYunwuGeminiGenerateContentEndpoint(endpoint)
}

export function is302NanoBananaWsEditEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint)
    const host = url.hostname.toLowerCase()
    return is302ApiHost(host) && url.pathname.endsWith('/ws/api/v3/google/nano-banana-2/edit')
  } catch {
    return false
  }
}

export function is302ImageEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint)
    const host = url.hostname.toLowerCase()
    return is302ApiHost(host) && (url.pathname.endsWith('/images/edits') || url.pathname.endsWith('/images/generations'))
  } catch {
    return false
  }
}

export function isYunwuImageEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint)
    return url.hostname.toLowerCase() === 'yunwu.ai' && (url.pathname.endsWith('/v1/images/edits') || url.pathname.endsWith('/v1/images/generations'))
  } catch {
    return false
  }
}

export function isYunwuFalNanoBananaEditEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint)
    return url.hostname.toLowerCase() === 'yunwu.ai' && (url.pathname.endsWith('/fal-ai/nano-banana/edit') || url.pathname.endsWith('/fal-ai/nano-banana-2/edit'))
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Template classification
// ---------------------------------------------------------------------------

// Map a provider base URL to a built-in parameter template key.
export function classifyImageParamTemplate(baseUrl: string, modelName = ''): ImageParamTemplateKey | null {
  const normalized = (baseUrl || '').replace(/\/+$/, '')
  if (isGeminiGenerateContentImageEndpoint(normalized)) return 'gemini-generate-content'
  if (is302NanoBananaWsEditEndpoint(normalized)) return '302-nano-banana-ws'
  if (isYunwuFalNanoBananaEditEndpoint(normalized)) return 'yunwu-fal-nano-banana'
  if (is302ImageEndpoint(normalized)) return '302-images-edits'
  if (isYunwuImageEndpoint(normalized)) return 'yunwu-images-edits'
  if (normalized.endsWith('/images/edits') || normalized.endsWith('/images/generations')) {
    return 'openai-images'
  }
  if (normalized.endsWith('/chat/completions')) return null
  return modelName.toLowerCase().includes('gpt-image') ? 'openai-images' : null
}

// ---------------------------------------------------------------------------
// Built-in default parameter templates
// ---------------------------------------------------------------------------
// Default values are intentionally identical to the previous hard-coded runtime behaviour so that
// upgrading with no configuration changes produces identical API requests.

const TEMPLATE_302_IMAGES_EDITS: ProviderImageParam[] = [
  { key: 'quality', label: '图片质量', options: ['auto', 'low', 'medium', 'high'], value: 'high' },
  { key: 'size', label: '输出尺寸', options: [IMAGE_PARAM_VALUE_AUTO, '1024x1024', '1536x1024', '1024x1536', 'auto'], value: IMAGE_PARAM_VALUE_AUTO },
  { key: 'background', label: '背景', options: ['auto', 'opaque', 'transparent'], value: 'opaque' },
  { key: 'output_format', label: '输出格式', options: ['png', 'jpeg', 'webp'], value: 'webp' },
  { key: 'output_compression', label: '输出压缩率', options: ['60', '70', '80', '85', '90', '95', '100'], value: '85' },
  { key: 'input_fidelity', label: '输入保真', options: ['low', 'high'], value: IMAGE_PARAM_VALUE_NONE },
]

const TEMPLATE_YUNWU_IMAGES_EDITS: ProviderImageParam[] = [
  { key: 'quality', label: '图片质量', options: ['auto', 'low', 'medium', 'high'], value: 'low' },
  { key: 'size', label: '输出尺寸', options: [IMAGE_PARAM_VALUE_AUTO, '1024x1024', '1536x1024', '1024x1536'], value: '1024x1024' },
  { key: 'output_format', label: '输出格式', options: ['png', 'jpeg', 'webp'], value: 'jpeg' },
  { key: 'output_compression', label: '输出压缩率', options: ['60', '70', '80', '85', '90', '95', '100'], value: '80' },
  { key: 'background', label: '背景', options: ['auto', 'opaque', 'transparent'], value: IMAGE_PARAM_VALUE_NONE },
  { key: 'input_fidelity', label: '输入保真', options: ['low', 'high'], value: IMAGE_PARAM_VALUE_NONE },
]

const TEMPLATE_OPENAI_IMAGES: ProviderImageParam[] = [
  { key: 'quality', label: '图片质量', options: ['auto', 'low', 'medium', 'high'], value: IMAGE_PARAM_VALUE_NONE },
  { key: 'size', label: '输出尺寸', options: [IMAGE_PARAM_VALUE_AUTO, '1024x1024', '1536x1024', '1024x1536'], value: '1024x1024' },
  { key: 'input_fidelity', label: '输入保真', options: ['low', 'high'], value: IMAGE_PARAM_VALUE_NONE },
]

const TEMPLATE_GEMINI_GENERATE_CONTENT: ProviderImageParam[] = [
  { key: 'generationConfig.imageConfig.imageSize', label: '图片尺寸', options: ['512', '1K', '2K', '4K'], value: '512' },
  { key: 'generationConfig.imageConfig.aspectRatio', label: '宽高比', options: [IMAGE_PARAM_VALUE_AUTO, '1:1', '4:3', '3:4', '16:9', '9:16'], value: IMAGE_PARAM_VALUE_AUTO },
]

const TEMPLATE_302_NANO_BANANA_WS: ProviderImageParam[] = [
  { key: 'resolution', label: '分辨率', options: ['0.5k', '1k', '2k', '4k'], value: '0.5k' },
  { key: 'aspect_ratio', label: '宽高比', options: [IMAGE_PARAM_VALUE_AUTO, '1:1', '4:3', '3:4', '16:9', '9:16'], value: IMAGE_PARAM_VALUE_AUTO },
]

const TEMPLATE_YUNWU_FAL_NANO_BANANA: ProviderImageParam[] = [
  { key: 'resolution', label: '分辨率', options: ['0.5K', '1K', '2K', '4K'], value: '0.5K' },
  { key: 'output_format', label: '输出格式', options: ['png', 'jpeg', 'webp'], value: 'jpeg' },
  { key: 'aspect_ratio', label: '宽高比', options: ['auto', '1:1', '4:3', '3:4', '16:9', '9:16'], value: 'auto' },
]

const TEMPLATES: Record<ImageParamTemplateKey, () => ProviderImageParam[]> = {
  '302-images-edits': () => clone(TEMPLATE_302_IMAGES_EDITS),
  'yunwu-images-edits': () => clone(TEMPLATE_YUNWU_IMAGES_EDITS),
  'openai-images': () => clone(TEMPLATE_OPENAI_IMAGES),
  'gemini-generate-content': () => clone(TEMPLATE_GEMINI_GENERATE_CONTENT),
  '302-nano-banana-ws': () => clone(TEMPLATE_302_NANO_BANANA_WS),
  'yunwu-fal-nano-banana': () => clone(TEMPLATE_YUNWU_FAL_NANO_BANANA),
}

function clone(params: ProviderImageParam[]): ProviderImageParam[] {
  return params.map((param) => ({ ...param, options: [...param.options] }))
}

// Build the default parameter set for a provider, optionally refining defaults that depend on the
// model name (e.g. input_fidelity for gpt-image series). Returns an empty set when no template applies.
export function buildDefaultImageParams(baseUrl: string, modelName = ''): ProviderImageParam[] {
  const key = classifyImageParamTemplate(baseUrl, modelName)
  if (!key) return []
  const params = TEMPLATES[key]()
  if (key === 'openai-images' && /gpt-image/i.test(modelName)) {
    const fidelity = params.find((param) => param.key === 'input_fidelity')
    if (fidelity) fidelity.value = 'high'
  }
  return params
}

// Build the ProviderOptions wrapper for a provider.
export function buildDefaultProviderOptions(baseUrl: string, modelName = ''): ProviderOptions {
  return { imageParams: buildDefaultImageParams(baseUrl, modelName) }
}

// ---------------------------------------------------------------------------
// Validation & sanitization
// ---------------------------------------------------------------------------

const PARAM_KEY_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*$/

export type ImageParamValidationError = string

// Validate a single parameter key (identifier or dotted nested path, no empty segments).
export function validateImageParamKey(key: string): ImageParamValidationError | null {
  if (!key) return '参数名不能为空。'
  if (!PARAM_KEY_PATTERN.test(key)) return `参数名 "${key}" 格式不合法，仅支持字母、数字、下划线与点号路径。`
  return null
}

// Whether a key is allowed on a multipart endpoint (no nested path).
export function isMultipartSafeKey(key: string): boolean {
  return !key.includes('.')
}

// Sanitize and validate a list of configured parameters. Returns the cleaned list plus any errors.
// Cleaning: trims labels/values, de-dupes enum options, removes blank enum entries, drops unknown keys.
export function sanitizeImageParams(
  params: unknown,
): { params: ProviderImageParam[]; errors: ImageParamValidationError[] } {
  const errors: ImageParamValidationError[] = []
  if (!Array.isArray(params)) return { params: [], errors: ['画质参数必须为数组。'] }
  if (params.length > IMAGE_PARAM_MAX_COUNT) {
    errors.push(`画质参数条数不能超过 ${IMAGE_PARAM_MAX_COUNT} 条。`)
  }
  const seenKeys = new Set<string>()
  const cleaned: ProviderImageParam[] = []
  for (const raw of params) {
    if (!raw || typeof raw !== 'object') {
      errors.push('存在非法的画质参数项。')
      continue
    }
    const record = raw as Record<string, unknown>
    const key = typeof record.key === 'string' ? record.key.trim() : ''
    const keyError = validateImageParamKey(key)
    if (keyError) {
      errors.push(keyError)
      continue
    }
    if (seenKeys.has(key)) {
      errors.push(`参数名 "${key}" 重复。`)
      continue
    }
    seenKeys.add(key)
    const label = typeof record.label === 'string' && record.label.trim() ? record.label.trim() : key
    const options = Array.isArray(record.options)
      ? Array.from(new Set(record.options.map((option) => String(option).trim()).filter(Boolean)))
      : []
    if (!options.length) {
      errors.push(`参数 "${key}" 的枚举值列表不能为空。`)
      continue
    }
    const rawValue = typeof record.value === 'string' ? record.value : ''
    let value = rawValue
    if (value !== IMAGE_PARAM_VALUE_NONE && value !== IMAGE_PARAM_VALUE_AUTO && !options.includes(value)) {
      // Auto-correct the value to the first enum option if it is not a reserved value.
      value = options[0]
      errors.push(`参数 "${key}" 的当前值 "${rawValue}" 不在枚举列表中，已重置为 "${value}"。`)
    }
    cleaned.push({ key, label, options, value })
  }
  return { params: cleaned, errors }
}

// Validate the full configuration (used for server-side persistence checks).
export function validateProviderImageParams(
  params: unknown,
  multipart: boolean,
): { params: ProviderImageParam[]; errors: ImageParamValidationError[] } {
  const result = sanitizeImageParams(params)
  for (const param of result.params) {
    if (multipart && !isMultipartSafeKey(param.key)) {
      result.errors.push(`参数名 "${param.key}" 含点号路径，当前端点（multipart）不支持嵌套参数。`)
    }
  }
  return result
}
