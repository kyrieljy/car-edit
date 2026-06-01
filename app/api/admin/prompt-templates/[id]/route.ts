import { NextResponse } from "next/server"
import { authErrorResponse, requireAdminUser } from "@/lib/server/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function readOnlyPromptResponse() {
  return NextResponse.json({ error: "Prompt templates are managed from Git seed and are read-only at runtime." }, { status: 405 })
}

export async function PATCH() {
  try {
    requireAdminUser()
    return readOnlyPromptResponse()
  } catch (error) {
    return authErrorResponse(error)
  }
}

export async function DELETE() {
  try {
    requireAdminUser()
    return readOnlyPromptResponse()
  } catch (error) {
    return authErrorResponse(error)
  }
}
