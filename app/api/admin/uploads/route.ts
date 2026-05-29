import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { NextResponse } from "next/server"
import { authErrorResponse, requireAdminUser } from "@/lib/server/auth"
import { validateImageUpload } from "@/lib/upload-limits"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    requireAdminUser()
    const formData = await request.formData()
    const file = formData.get("file")
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "file is required" }, { status: 400 })
    }
    const uploadValidation = validateImageUpload(file, "file")
    if (!uploadValidation.ok) {
      return NextResponse.json({ error: uploadValidation.error }, { status: uploadValidation.status })
    }

    const ext = file.type === "image/png" ? ".png" : file.type === "image/webp" ? ".webp" : ".jpg"
    const fileName = `part-${Date.now()}-${Math.random().toString(16).slice(2)}${ext}`
    const uploadDir = path.join(process.cwd(), "public", "uploads", "parts")
    await mkdir(uploadDir, { recursive: true })
    await writeFile(path.join(uploadDir, fileName), Buffer.from(await file.arrayBuffer()))

    return NextResponse.json({ imageUrl: `/uploads/parts/${fileName}` }, { status: 201 })
  } catch (error) {
    return (error as { status?: number }).status ? authErrorResponse(error) : NextResponse.json({ error: error instanceof Error ? error.message : "Upload failed" }, { status: 500 })
  }
}
