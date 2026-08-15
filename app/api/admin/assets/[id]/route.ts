import { NextResponse } from "next/server"
import { deleteAsset, updateAsset } from "@/lib/server/db"
import { authErrorResponse, requireAdminUser } from "@/lib/server/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function PATCH(request: Request, context: { params: { id: string } }) {
  try {
    requireAdminUser()
    const body = await request.json()
    const asset = updateAsset(context.params.id, body)
    return NextResponse.json(asset)
  } catch (error) {
    return (error as { status?: number }).status ? authErrorResponse(error) : NextResponse.json({ error: error instanceof Error ? error.message : "Asset update failed" }, { status: 404 })
  }
}

export async function DELETE(_request: Request, context: { params: { id: string } }) {
  try {
    requireAdminUser()
    return NextResponse.json(deleteAsset(context.params.id))
  } catch (error) {
    return (error as { status?: number }).status
      ? authErrorResponse(error)
      : NextResponse.json({ error: error instanceof Error ? error.message : "Asset delete failed" }, { status: 400 })
  }
}
