import { NextResponse } from "next/server"
import { listUserGenerations, saveGarage } from "@/lib/server/db"
import { authErrorResponse, requireUser } from "@/lib/server/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const user = requireUser()
    return NextResponse.json({ generations: listUserGenerations(user.id) })
  } catch (error) {
    return authErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = requireUser()
    const body = await request.json()
    if (!body.generationId) return NextResponse.json({ error: "generationId is required" }, { status: 400 })
    return NextResponse.json(saveGarage(String(body.generationId), user.id))
  } catch (error) {
    return authErrorResponse(error)
  }
}
