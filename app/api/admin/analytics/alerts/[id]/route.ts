import { NextResponse } from "next/server"
import { authErrorResponse, requireAdminUser } from "@/lib/server/auth"
import { updateAlertStatus } from "@/lib/server/db"
import type { AlertStatus } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const adminUser = requireAdminUser()
    const { id } = await context.params
    const body = await request.json() as { status: string }
    const status = body.status as AlertStatus

    if (!["confirmed", "ignored"].includes(status)) {
      return NextResponse.json({ error: "Invalid status. Must be 'confirmed' or 'ignored'." }, { status: 400 })
    }

    const alert = updateAlertStatus(id, status, adminUser.id)
    if (!alert) {
      return NextResponse.json({ error: "Alert not found" }, { status: 404 })
    }

    return NextResponse.json({ alert })
  } catch (error) {
    return authErrorResponse(error)
  }
}
