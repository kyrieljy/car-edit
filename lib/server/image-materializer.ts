import { readImageAsset } from "./image-assets"
import { mimeFromPath, writeChatUploadImage, writeResultImage, writeVehicleUploadImage } from "./local-images"

export type MaterializedImageUrl = {
  url: string
  fileName: string
  mime: string
  size: number
  materialized: boolean
}

type ImageMaterializeKind = "result" | "vehicle_upload" | "chat_upload"

export async function materializeImageUrl(
  url: string,
  kind: ImageMaterializeKind,
  fileNamePrefix: string = kind,
): Promise<MaterializedImageUrl | null> {
  const cleanUrl = url.trim()
  if (!cleanUrl) return null

  const image = await readImageAsset(cleanUrl)
  if (!image) return null

  const mime = image.mime || mimeFromPath(cleanUrl)
  const size = image.bytes.byteLength
  if (isPersistentLocalImageUrl(cleanUrl)) {
    return {
      url: cleanUrl,
      fileName: image.fileName,
      mime,
      size,
      materialized: false,
    }
  }

  const safePrefix = fileNamePrefix.replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || kind
  const fileName = `${safePrefix}-${Date.now()}-${Math.random().toString(16).slice(2)}.${extensionFromMime(mime)}`
  if (kind === "result") {
    await writeResultImage(fileName, image.bytes)
    return { url: `/results/${fileName}`, fileName, mime, size, materialized: true }
  }
  if (kind === "vehicle_upload") {
    await writeVehicleUploadImage(fileName, image.bytes)
    return { url: `/uploads/${fileName}`, fileName, mime, size, materialized: true }
  }
  await writeChatUploadImage(fileName, image.bytes)
  return { url: `/uploads/chat/${fileName}`, fileName, mime, size, materialized: true }
}

export function isPersistentLocalImageUrl(url: string) {
  return url.startsWith("/uploads/chat/") || url.startsWith("/uploads/") || url.startsWith("/results/") || url.startsWith("/assets/")
}

function extensionFromMime(mime: string) {
  const lower = mime.toLowerCase()
  if (lower.includes("jpeg") || lower.includes("jpg")) return "jpg"
  if (lower.includes("webp")) return "webp"
  if (lower.includes("avif")) return "avif"
  return "png"
}
