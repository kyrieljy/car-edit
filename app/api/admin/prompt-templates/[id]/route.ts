import { NextResponse } from "next/server"
import { deletePromptTemplate, updatePromptTemplate } from "@/lib/server/db"
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

function parseScope(value: unknown): PromptTemplateScope | undefined {
  if (value === undefined) return undefined
  const scope = String(value)
  if (!scopes.includes(scope as PromptTemplateScope)) throw new Error("Invalid prompt scope")
  return scope as PromptTemplateScope
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    requireAdminUser()
    const body = await request.json()
    const template = updatePromptTemplate(params.id, {
      scope: parseScope(body.scope),
      title: typeof body.title === "string" ? body.title : undefined,
      body: typeof body.body === "string" ? body.body : undefined,
      assetId: typeof body.assetId === "string" ? body.assetId : undefined,
      combinationKey: typeof body.combinationKey === "string" ? body.combinationKey : undefined,
      active: typeof body.active === "boolean" ? body.active : undefined,
      sortOrder: Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : undefined,
    })
    return NextResponse.json(template)
  } catch (error) {
    return (error as { status?: number }).status ? authErrorResponse(error) : NextResponse.json({ error: error instanceof Error ? error.message : "Prompt template update failed" }, { status: 400 })
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    requireAdminUser()
    return NextResponse.json(deletePromptTemplate(params.id))
  } catch (error) {
    return (error as { status?: number }).status ? authErrorResponse(error) : NextResponse.json({ error: error instanceof Error ? error.message : "Prompt template delete failed" }, { status: 400 })
  }
}
