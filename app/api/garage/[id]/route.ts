import { NextResponse } from "next/server"
import { deleteGeneration } from "@/lib/server/db"
import { authErrorResponse, requireUser } from "@/lib/server/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function DELETE(_request: Request, context: { params: { id: string } }) {
  try {
    const user = requireUser()
    return NextResponse.json(deleteGeneration(context.params.id, user.id))
  } catch (error) {
    return (error as { status?: number }).status
      ? authErrorResponse(error)
      : NextResponse.json({ error: error instanceof Error ? error.message : "Generation delete failed" }, { status: 404 })
  }
}
