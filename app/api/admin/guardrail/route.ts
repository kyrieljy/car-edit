import { NextResponse } from "next/server"
import { getGuardrailConfig, updateGuardrailConfig } from "@/lib/server/db"
import { authErrorResponse, requireAdminUser } from "@/lib/server/auth"
import type { GuardrailConfig } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    requireAdminUser()
    return NextResponse.json(getGuardrailConfig())
  } catch (error) {
    return authErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    requireAdminUser()
    const body = await request.json()
    const config = updateGuardrailConfig({
      sop: typeof body.sop === "string" ? body.sop : undefined,
      allowedDescription: typeof body.allowedDescription === "string" ? body.allowedDescription : undefined,
      blockedTerms: typeof body.blockedTerms === "string" ? body.blockedTerms : undefined,
      recommendedPrompts: typeof body.recommendedPrompts === "string" ? body.recommendedPrompts : undefined,
      mockMode: typeof body.mockMode === "boolean" ? body.mockMode : undefined,
      mockFailUploads: typeof body.mockFailUploads === "boolean" ? body.mockFailUploads : undefined,
      provider: typeof body.provider === "string" ? (body.provider as GuardrailConfig["provider"]) : undefined,
    })
    return NextResponse.json(config)
  } catch (error) {
    return authErrorResponse(error)
  }
}
