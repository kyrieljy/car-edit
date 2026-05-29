import { NextResponse } from "next/server"
import { createPrompt } from "@/lib/server/db"
import { authErrorResponse, requireAdminUser } from "@/lib/server/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    requireAdminUser()
    const body = await request.json()
    const prompt = createPrompt({
      title: String(body.title || "Untitled prompt"),
      version: String(body.version || "1.0"),
      body: String(body.body || ""),
      negativePrompt: String(body.negativePrompt || ""),
      active: body.active !== false,
    })
    return NextResponse.json(prompt, { status: 201 })
  } catch (error) {
    return (error as { status?: number }).status ? authErrorResponse(error) : NextResponse.json({ error: error instanceof Error ? error.message : "Prompt create failed" }, { status: 400 })
  }
}
