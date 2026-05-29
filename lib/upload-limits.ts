export const ALLOWED_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"])

export const IMAGE_UPLOAD_MAX_BYTES = 20 * 1024 * 1024
export const IMAGE_UPLOAD_MAX_MB = IMAGE_UPLOAD_MAX_BYTES / 1024 / 1024

export const MAX_CHAT_PART_IMAGES = 8
export const CHAT_UPLOAD_MAX_TOTAL_BYTES = 180 * 1024 * 1024
export const CHAT_UPLOAD_MAX_TOTAL_MB = CHAT_UPLOAD_MAX_TOTAL_BYTES / 1024 / 1024

export type UploadValidationResult = { ok: true } | { ok: false; status: 400 | 413; error: string }

export function isAllowedImageMimeType(type: string) {
  return ALLOWED_IMAGE_MIME_TYPES.has(type)
}

export function totalUploadBytes(files: File[]) {
  return files.reduce((total, file) => total + file.size, 0)
}

export function validateImageUpload(file: File, label = "Image"): UploadValidationResult {
  if (!isAllowedImageMimeType(file.type)) {
    return { ok: false, status: 400, error: "Only jpg, png, and webp uploads are supported." }
  }
  if (file.size > IMAGE_UPLOAD_MAX_BYTES) {
    return { ok: false, status: 413, error: `${label} must be ${IMAGE_UPLOAD_MAX_MB}MB or smaller.` }
  }
  return { ok: true }
}

export function validateImageUploadTotal(files: File[], maxBytes = CHAT_UPLOAD_MAX_TOTAL_BYTES): UploadValidationResult {
  if (totalUploadBytes(files) > maxBytes) {
    return { ok: false, status: 413, error: `Uploads are limited to ${maxBytes / 1024 / 1024}MB per request.` }
  }
  return { ok: true }
}
