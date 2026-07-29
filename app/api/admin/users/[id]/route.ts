import { NextResponse } from "next/server"
import { authErrorResponse, requireAdminUser } from "@/lib/server/auth"
import { getBillingStatus, getUserDetail, updateAdminUser } from "@/lib/server/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    requireAdminUser()
    const detail = getUserDetail(params.id)
    if (!detail) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }
    return NextResponse.json(detail)
  } catch (error) {
    return authErrorResponse(error)
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const admin = requireAdminUser()
    const body = await request.json()
    const user = updateAdminUser(admin.id, {
      userId: params.id,
      role: String(body.role || ""),
      plan: String(body.plan || ""),
      status: String(body.status || ""),
    })
    return NextResponse.json({ user, billing: getBillingStatus(user.id) })
  } catch (error) {
    return (error as { status?: number }).status
      ? authErrorResponse(error)
      : NextResponse.json({ error: error instanceof Error ? error.message : "User update failed" }, { status: 400 })
  }
}
