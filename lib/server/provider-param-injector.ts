// Server-side image-parameter injector.
// Turns a provider's configured image params (provider.options.imageParams) into the concrete
// request fields consumed by the generation engine, replacing the previously hard-coded constants
// and environment-variable reads. Resolves the two reserved values:
//   - ''   (IMAGE_PARAM_VALUE_NONE)   => parameter omitted from the request
//   - '__auto__' (IMAGE_PARAM_VALUE_AUTO) => adaptive value computed from the source image

import type { ProviderConfig } from '../types'
import { IMAGE_PARAM_VALUE_AUTO, IMAGE_PARAM_VALUE_NONE } from '../provider-image-params'
import {
  closestNanoBananaAspectRatio,
  generationEndpoint,
  imageDimensions,
  providerGenerationBaseUrl,
  providerOutputImageSize,
} from './generation-provider'

// Resolve configured image params into a flat "key -> value" dictionary that should be sent to the
// provider API. Empty values are omitted; "__auto__" values are replaced by adaptive resolutions.
export function resolveImageParams(provider: ProviderConfig, vehicleImage?: { bytes: Uint8Array }): Record<string, string> {
  const params = provider.options?.imageParams ?? []
  if (!params.length) return {}
  const endpoint = generationEndpoint(providerGenerationBaseUrl(provider)).url
  const dimensions = vehicleImage ? imageDimensions(vehicleImage.bytes) : null
  const effective: Record<string, string> = {}
  for (const param of params) {
    const value = param.value ?? ''
    if (value === IMAGE_PARAM_VALUE_NONE) continue
    if (value === IMAGE_PARAM_VALUE_AUTO) {
      const auto = resolveAutoValue(param.key, endpoint, vehicleImage, dimensions)
      if (auto !== null) effective[param.key] = auto
      continue
    }
    effective[param.key] = value
  }
  // output_compression only applies to jpeg/webp output formats.
  if (effective.output_compression !== undefined && effective.output_format !== undefined) {
    if (effective.output_format !== 'jpeg' && effective.output_format !== 'webp') {
      delete effective.output_compression
    }
  }
  return effective
}

function resolveAutoValue(
  key: string,
  endpoint: string,
  vehicleImage: { bytes: Uint8Array } | undefined,
  dimensions: { width: number; height: number } | null,
): string | null {
  if (key === 'size') {
    return providerOutputImageSize(endpoint, vehicleImage)
  }
  if (key === 'aspectRatio' || key === 'aspect_ratio') {
    return dimensions ? closestNanoBananaAspectRatio(dimensions) : '4:3'
  }
  return null
}

// Write resolved params onto a multipart FormData. Nested (dotted) keys are unsupported on
// multipart endpoints and are skipped with a warning.
export function applyImageParamsToFormData(formData: FormData, params: Record<string, string>, endpoint: string) {
  for (const [key, value] of Object.entries(params)) {
    if (key.includes('.')) {
      console.warn(`[provider-params] skipped nested param "${key}" on multipart endpoint ${endpoint}`)
      continue
    }
    formData.set(key, value)
  }
}

// Write resolved params onto a JSON object, expanding dotted keys into nested objects.
export function applyImageParamsToJson(target: Record<string, unknown>, params: Record<string, string>): Record<string, unknown> {
  for (const [key, value] of Object.entries(params)) {
    if (!key.includes('.')) {
      target[key] = value
      continue
    }
    const segments = key.split('.')
    let node: Record<string, unknown> = target
    for (let index = 0; index < segments.length - 1; index += 1) {
      const segment = segments[index]
      const current = node[segment]
      if (typeof current !== 'object' || current === null || Array.isArray(current)) {
        node[segment] = {}
      }
      node = node[segment] as Record<string, unknown>
    }
    node[segments[segments.length - 1]] = value
  }
  return target
}

// Build a nested object from a flat key->value dictionary (used to extract a subtree such as
// generationConfig.imageConfig for the Gemini endpoint).
export function buildNestedFromFlat(params: Record<string, string>): Record<string, unknown> {
  return applyImageParamsToJson({}, params)
}
