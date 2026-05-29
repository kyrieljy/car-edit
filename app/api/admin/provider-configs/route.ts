import { NextResponse } from "next/server"
import { updateProvider } from "@/lib/server/db"
import { authErrorResponse, requireAdminUser } from "@/lib/server/auth"
import type { ProviderCapability, ProviderId } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    requireAdminUser()
    const body = await request.json()
    const provider = updateProvider({
      id: body.id ? (String(body.id) as ProviderId) : undefined,
      label: typeof body.label === "string" ? body.label.trim() : undefined,
      baseUrl: typeof body.baseUrl === "string" ? body.baseUrl.trim() : undefined,
      modelName: typeof body.modelName === "string" ? body.modelName.trim() : undefined,
      capabilities: Array.isArray(body.capabilities) ? body.capabilities.map(String).filter((item: string): item is ProviderCapability => ["llm", "vision", "image_generation", "embedding"].includes(item)) : undefined,
      enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
      active: typeof body.active === "boolean" ? body.active : undefined,
      apiKey: body.apiKey ? String(body.apiKey) : undefined,
    })
    return NextResponse.json(provider)
  } catch (error) {
    return (error as { status?: number }).status ? authErrorResponse(error) : NextResponse.json({ error: error instanceof Error ? error.message : "Provider update failed" }, { status: 400 })
  }
}
