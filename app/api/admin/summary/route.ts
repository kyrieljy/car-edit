import { NextResponse } from "next/server"
import { getAdminSummary } from "@/lib/server/db"
import { authErrorResponse, requireAdminUser } from "@/lib/server/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    requireAdminUser()
    return NextResponse.json(getAdminSummary())
  } catch (error) {
    return authErrorResponse(error)
  }
}
