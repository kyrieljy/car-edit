import { NextResponse } from "next/server"
import { listPromptTemplates } from "@/lib/server/db"
import { authErrorResponse, requireAdminUser } from "@/lib/server/auth"
import type { PromptTemplateScope } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const scopes: PromptTemplateScope[] = [
  "base",
  "config_base",
  "config_mode",
  "chat_mode",
  "category",
  "part",
  "combo",
  "chat_recommendation",
  "chat_parser",
  "chat_optimizer",
  "vehicle_recognition",
  "part_recognition",
  "negative",
  "result_check",
  "retry",
]

function parseScope(value: unknown): PromptTemplateScope {
  const scope = String(value || "config_base")
  if (!scopes.includes(scope as PromptTemplateScope)) throw new Error("Invalid prompt scope")
  return scope as PromptTemplateScope
}

export async function GET(request: Request) {
  try {
    requireAdminUser()
    const url = new URL(request.url)
    const scope = url.searchParams.get("scope")
    return NextResponse.json({ templates: scope ? listPromptTemplates(parseScope(scope)) : listPromptTemplates() })
  } catch (error) {
    return (error as { status?: number }).status ? authErrorResponse(error) : NextResponse.json({ error: error instanceof Error ? error.message : "Prompt templates failed" }, { status: 400 })
  }
}

export async function POST(request: Request) {
  try {
    requireAdminUser()
    await request.json().catch(() => ({}))
    return NextResponse.json({ error: "Prompt templates are managed from Git seed and are read-only at runtime." }, { status: 405 })
  } catch (error) {
    return (error as { status?: number }).status ? authErrorResponse(error) : NextResponse.json({ error: error instanceof Error ? error.message : "Prompt template create failed" }, { status: 400 })
  }
}
