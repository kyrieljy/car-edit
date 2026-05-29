import { NextResponse } from "next/server"
import { readLocalImageByAppUrl, toArrayBuffer } from "@/lib/server/local-images"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_request: Request, context: { params: { fileName: string } }) {
  const image = await readLocalImageByAppUrl(`/uploads/chat/${context.params.fileName}`)
  if (!image) return new NextResponse("Not found", { status: 404 })
  return new NextResponse(toArrayBuffer(image.bytes), {
    headers: {
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Type": image.mime,
    },
  })
}
