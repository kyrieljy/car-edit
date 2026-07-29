import { NextResponse } from "next/server"
import { authErrorResponse, requireAdminUser } from "@/lib/server/auth"
import { getGenerationDetail } from "@/lib/server/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    requireAdminUser()
    const detail = getGenerationDetail(params.id)
    if (!detail) {
      return NextResponse.json({ error: "Generation job not found" }, { status: 404 })
    }
    return NextResponse.json(detail)
  } catch (error) {
    return authErrorResponse(error)
  }
}
