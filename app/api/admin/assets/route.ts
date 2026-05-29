import { NextResponse } from "next/server"
import { createAsset, reorderAssets } from "@/lib/server/db"
import { authErrorResponse, requireAdminUser } from "@/lib/server/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    requireAdminUser()
    const body = await request.json()
    const id = String(body.id || `${body.categoryId}-${Date.now()}`).toLowerCase().replace(/[^a-z0-9-]/g, "-")
    const asset = createAsset({
      id,
      categoryId: String(body.categoryId),
      brandId: typeof body.brandId === "string" ? body.brandId : undefined,
      brand: String(body.brand || "Custom"),
      model: String(body.model || "Asset"),
      variant: String(body.variant || "Default"),
      keywords: String(body.keywords || ""),
      color: String(body.color || "Custom"),
      finish: String(body.finish || "custom"),
      imageUrl: String(body.imageUrl || "/placeholder.svg"),
      imageCrop: String(body.imageCrop || ""),
      promptHint: String(body.promptHint || "install this custom part naturally on the uploaded vehicle"),
      defaultColorPolicy: body.defaultColorPolicy,
      allowedColorPolicies: Array.isArray(body.allowedColorPolicies) ? body.allowedColorPolicies : undefined,
      generationReferences: Array.isArray(body.generationReferences) ? body.generationReferences : [],
      promptTestStatus: body.promptTestStatus,
      generationReady: Boolean(body.generationReady),
      badCaseNotes: String(body.badCaseNotes || ""),
      recommendedViews: Array.isArray(body.recommendedViews) ? body.recommendedViews.map((item: unknown) => String(item)) : [],
      active: body.active !== false,
    })
    return NextResponse.json(asset, { status: 201 })
  } catch (error) {
    return (error as { status?: number }).status ? authErrorResponse(error) : NextResponse.json({ error: error instanceof Error ? error.message : "Asset create failed" }, { status: 400 })
  }
}

export async function PATCH(request: Request) {
  try {
    requireAdminUser()
    const body = await request.json()
    const orderedIds = Array.isArray(body.orderedIds) ? body.orderedIds.map((id: unknown) => String(id)) : []
    return NextResponse.json({
      assets: reorderAssets(String(body.categoryId || ""), String(body.brandId || ""), orderedIds),
    })
  } catch (error) {
    return (error as { status?: number }).status ? authErrorResponse(error) : NextResponse.json({ error: error instanceof Error ? error.message : "Asset reorder failed" }, { status: 400 })
  }
}
