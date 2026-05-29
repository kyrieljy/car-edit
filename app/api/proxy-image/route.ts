import { type NextRequest, NextResponse } from "next/server"
import { imageAssetResponse, readImageAsset } from "@/lib/server/image-assets"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const imageUrl = searchParams.get("url")

    if (!imageUrl) {
      return NextResponse.json({ error: "URL parameter is required" }, { status: 400 })
    }

    const image = await readImageAsset(imageUrl)
    if (!image) {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
    }

    return imageAssetResponse(image)
  } catch (error) {
    console.error("Error proxying image:", error)
    return NextResponse.json({ error: "Failed to proxy image" }, { status: 500 })
  }
}
