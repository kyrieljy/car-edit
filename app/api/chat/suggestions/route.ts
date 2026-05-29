import { NextResponse } from "next/server"
import { getGuardrailConfig, listPromptTemplates } from "@/lib/server/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  const config = getGuardrailConfig()
  const managedPrompts = listPromptTemplates("chat_recommendation")
    .filter((template) => template.active)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((template) => template.body.trim())
    .filter(Boolean)
  const prompts = managedPrompts.length
    ? managedPrompts
    : config.recommendedPrompts
        .split(/\r?\n/)
        .map((prompt) => prompt.trim())
        .filter(Boolean)

  return NextResponse.json({ prompts })
}
