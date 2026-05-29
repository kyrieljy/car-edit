import { readLocalImageByAppUrl, mimeFromImageBytes, toArrayBuffer, type LocalImageData } from "./local-images"

export const MAX_IMAGE_ASSET_BYTES = 20 * 1024 * 1024

const IMAGE_FETCH_TIMEOUT_MS = 30_000

export async function readImageAsset(url: string): Promise<LocalImageData | null> {
  const value = url.trim()
  if (!value) return null
  if (value.startsWith("/api/proxy-image")) {
    const nestedUrl = proxyImageTargetUrl(value)
    return nestedUrl ? readImageAsset(nestedUrl) : null
  }
  if (value.startsWith("/")) return readLocalImageByAppUrl(value)

  const parsedUrl = parseAllowedRemoteImageUrl(value)
  if (!parsedUrl) return null

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), IMAGE_FETCH_TIMEOUT_MS)
  try {
    const response = await fetch(parsedUrl, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        Accept: "image/avif,image/webp,image/png,image/jpeg,image/*,*/*;q=0.8",
        "User-Agent": "Mozilla/5.0 (compatible; ModLabImageFetcher/1.0)",
      },
    })
    if (!response.ok) return null

    const contentLength = Number(response.headers.get("content-length") || 0)
    if (contentLength > MAX_IMAGE_ASSET_BYTES) return null

    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.byteLength > MAX_IMAGE_ASSET_BYTES) return null

    const contentType = response.headers.get("content-type")?.split(";")[0]?.toLowerCase() || ""
    const detectedMime = mimeFromImageBytes(bytes)
    const mime = detectedMime || (contentType.startsWith("image/") ? contentType : "")
    if (!mime) return null

    return {
      bytes: Buffer.from(bytes),
      mime,
      fileName: fileNameFromUrl(parsedUrl),
    }
  } finally {
    clearTimeout(timeout)
  }
}

export function imageAssetResponse(image: LocalImageData, cacheControl = "public, max-age=31536000") {
  return new Response(toArrayBuffer(image.bytes), {
    headers: {
      "Cache-Control": cacheControl,
      "Content-Type": image.mime,
    },
  })
}

export function imageDownloadResponse(image: LocalImageData, fileName: string) {
  const safeName = safeDownloadFileName(fileName || image.fileName || "image.png", image.mime)
  return new Response(toArrayBuffer(image.bytes), {
    headers: {
      "Cache-Control": "private, no-store",
      "Content-Disposition": contentDispositionAttachment(safeName),
      "Content-Type": image.mime,
    },
  })
}

export function parseAllowedRemoteImageUrl(value: string) {
  try {
    const url = new URL(value)
    if (url.protocol !== "https:") return null
    const hostname = url.hostname.toLowerCase()
    if (hostname === "fal.media" || hostname.endsWith(".fal.media")) return url
    if (hostname === "file.302.ai" || hostname.endsWith(".file.302.ai")) return url
    return null
  } catch {
    return null
  }
}

function fileNameFromUrl(url: URL) {
  const name = decodeURIComponent(url.pathname.split("/").pop() || "").trim()
  return name && name.includes(".") ? name : "image.png"
}

function proxyImageTargetUrl(value: string) {
  try {
    return new URLSearchParams(value.split("?")[1] || "").get("url") || ""
  } catch {
    return ""
  }
}

function safeDownloadFileName(value: string, mime: string) {
  const fallbackExtension = extensionFromMime(mime)
  const clean = value
    .trim()
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "-")
    .replace(/\s+/g, "-")
    .slice(0, 160)
    .replace(/^-+|-+$/g, "")
  const fileName = clean || `image.${fallbackExtension}`
  return /\.[a-z0-9]{2,5}$/i.test(fileName) ? fileName : `${fileName}.${fallbackExtension}`
}

function extensionFromMime(mime: string) {
  const lower = mime.toLowerCase()
  if (lower.includes("jpeg") || lower.includes("jpg")) return "jpg"
  if (lower.includes("webp")) return "webp"
  if (lower.includes("avif")) return "avif"
  return "png"
}

function contentDispositionAttachment(fileName: string) {
  const asciiName = fileName.replace(/[^\x20-\x7e]+/g, "_").replace(/"/g, "'")
  return `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeRFC5987(fileName)}`
}

function encodeRFC5987(value: string) {
  return encodeURIComponent(value).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
}
