import { type NextRequest, NextResponse } from "next/server"
import { imageDownloadResponse, readImageAsset } from "@/lib/server/image-assets"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const imageUrl = searchParams.get("url") || ""
    const fileName = searchParams.get("filename") || ""

    if (!imageUrl) {
      return NextResponse.json({ error: "URL parameter is required" }, { status: 400 })
    }

    const image = await readImageAsset(imageUrl)
    if (!image) {
      return NextResponse.json({ error: "Image is unavailable" }, { status: 404 })
    }

    return imageDownloadResponse(image, fileName)
  } catch (error) {
    console.error("Error downloading image:", error)
    return NextResponse.json({ error: "Failed to download image" }, { status: 500 })
  }
}
