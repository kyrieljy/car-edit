import { type NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const MAX_PROXY_IMAGE_BYTES = 20 * 1024 * 1024

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const imageUrl = searchParams.get("url")

    if (!imageUrl) {
      return NextResponse.json({ error: "URL parameter is required" }, { status: 400 })
    }

    const parsedUrl = parseAllowedFalMediaUrl(imageUrl)
    if (!parsedUrl) {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
    }

    const response = await fetch(parsedUrl)

    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.status}`)
    }

    const contentType = response.headers.get("content-type") || "image/png"
    if (!contentType.toLowerCase().startsWith("image/")) {
      return NextResponse.json({ error: "URL did not return an image" }, { status: 400 })
    }
    const contentLength = Number(response.headers.get("content-length") || 0)
    if (contentLength > MAX_PROXY_IMAGE_BYTES) {
      return NextResponse.json({ error: "Image is too large" }, { status: 413 })
    }

    const imageBuffer = await response.arrayBuffer()
    if (imageBuffer.byteLength > MAX_PROXY_IMAGE_BYTES) {
      return NextResponse.json({ error: "Image is too large" }, { status: 413 })
    }

    return new NextResponse(imageBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000",
      },
    })
  } catch (error) {
    console.error("Error proxying image:", error)
    return NextResponse.json({ error: "Failed to proxy image" }, { status: 500 })
  }
}

function parseAllowedFalMediaUrl(value: string) {
  try {
    const url = new URL(value)
    const hostname = url.hostname.toLowerCase()
    if (url.protocol !== "https:") return null
    if (hostname !== "fal.media" && !hostname.endsWith(".fal.media")) return null
    return url
  } catch {
    return null
  }
}
