import { mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"

type DynamicImageMount = {
  prefix: string
  dataDir: string[]
  publicDir: string[]
}

export type LocalImageData = {
  bytes: Buffer
  mime: string
  fileName: string
}

const dynamicImageMounts: DynamicImageMount[] = [
  { prefix: "uploads/chat/", dataDir: ["data", "uploads", "chat"], publicDir: ["public", "uploads", "chat"] },
  { prefix: "uploads/parts/", dataDir: ["data", "uploads", "parts"], publicDir: ["public", "uploads", "parts"] },
  { prefix: "uploads/", dataDir: ["data", "uploads"], publicDir: ["public", "uploads"] },
  { prefix: "results/", dataDir: ["data", "results"], publicDir: ["public", "results"] },
]

export async function writeChatUploadImage(fileName: string, bytes: Buffer | Uint8Array) {
  await writeDynamicImage(["data", "uploads", "chat"], ["public", "uploads", "chat"], fileName, bytes)
}

export async function writeVehicleUploadImage(fileName: string, bytes: Buffer | Uint8Array) {
  await writeDynamicImage(["data", "uploads"], ["public", "uploads"], fileName, bytes)
}

export async function writePartUploadImage(fileName: string, bytes: Buffer | Uint8Array) {
  await writeDynamicImage(["data", "uploads", "parts"], ["public", "uploads", "parts"], fileName, bytes)
}

export async function writeResultImage(fileName: string, bytes: Buffer | Uint8Array) {
  await writeDynamicImage(["data", "results"], ["public", "results"], fileName, bytes)
}

export async function readLocalImageByAppUrl(url: string): Promise<LocalImageData | null> {
  const cleanPath = cleanAppPath(url)
  if (!cleanPath) return null

  for (const mount of dynamicImageMounts) {
    if (!cleanPath.startsWith(mount.prefix)) continue
    const fileName = safeSingleFileName(cleanPath.slice(mount.prefix.length))
    if (!fileName) return null
    return readFirstImageCandidate([
      path.join(process.cwd(), ...mount.dataDir, fileName),
      path.join(process.cwd(), ...mount.publicDir, fileName),
    ], fileName)
  }

  const publicRoot = path.resolve(process.cwd(), "public")
  const absolutePath = path.resolve(publicRoot, cleanPath)
  if (!isInsideDirectory(absolutePath, publicRoot)) return null
  return readFirstImageCandidate([absolutePath], path.basename(cleanPath))
}

export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}

function cleanAppPath(url: string) {
  if (!url.startsWith("/")) return ""
  try {
    return decodeURIComponent(url.split("?")[0].replace(/^\/+/, ""))
  } catch {
    return ""
  }
}

function safeSingleFileName(value: string) {
  if (!value || value.includes("/") || value.includes("\\") || value.includes("..")) return ""
  return value === path.basename(value) ? value : ""
}

async function writeDynamicImage(dataDir: string[], publicDir: string[], fileName: string, bytes: Buffer | Uint8Array) {
  const safeName = safeSingleFileName(fileName)
  if (!safeName) throw new Error("Invalid image file name.")
  const buffer = Buffer.from(bytes)
  const dataPath = path.join(process.cwd(), ...dataDir, safeName)
  await mkdir(path.dirname(dataPath), { recursive: true })
  await writeFile(dataPath, buffer)

  // Keep a public copy for existing deployments, while the route can serve the data copy.
  const publicPath = path.join(process.cwd(), ...publicDir, safeName)
  try {
    await mkdir(path.dirname(publicPath), { recursive: true })
    await writeFile(publicPath, buffer)
  } catch (error) {
    console.warn(`Public image mirror failed for ${safeName}:`, error)
  }
}

async function readFirstImageCandidate(paths: string[], fileName: string): Promise<LocalImageData | null> {
  for (const candidate of paths) {
    try {
      const bytes = await readFile(candidate)
      const detectedMime = mimeFromImageBytes(bytes)
      return {
        bytes,
        mime: detectedMime || mimeFromPath(candidate),
        fileName,
      }
    } catch {
      // Try the next storage location.
    }
  }
  return null
}

function isInsideDirectory(absolutePath: string, root: string) {
  const relative = path.relative(root, absolutePath)
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative))
}

export function mimeFromPath(value: string) {
  const lower = value.toLowerCase()
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg"
  if (lower.endsWith(".webp")) return "image/webp"
  if (lower.endsWith(".svg")) return "image/svg+xml"
  return "image/png"
}

export function mimeFromImageBytes(bytes: Uint8Array) {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png"
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg"
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 4) === "WEBP") return "image/webp"
  if (bytes.length >= 12 && ascii(bytes, 4, 4) === "ftyp") {
    const brand = ascii(bytes, 8, 4)
    if (brand === "avif" || brand === "avis") return "image/avif"
  }
  return ""
}

function ascii(bytes: Uint8Array, offset: number, length: number) {
  return String.fromCharCode(...bytes.slice(offset, offset + length))
}
