import { NextResponse } from "next/server"
import { authErrorResponse, requireAdminUser } from "@/lib/server/auth"
import { getGenerationList, type GenerationListFilter } from "@/lib/server/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    requireAdminUser()
    const url = new URL(request.url)
    const page = Math.max(1, Number(url.searchParams.get("page") || "1"))
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") || "20")))
    const sortBy = (url.searchParams.get("sortBy") || "created_at") as GenerationListFilter["sortBy"]
    const sortOrder = (url.searchParams.get("sortOrder") || "desc") as GenerationListFilter["sortOrder"]

    const result = getGenerationList({
      page,
      pageSize,
      startDate: url.searchParams.get("startDate") || undefined,
      endDate: url.searchParams.get("endDate") || undefined,
      mode: url.searchParams.get("mode") || undefined,
      status: url.searchParams.get("status") || undefined,
      providerId: url.searchParams.get("providerId") || undefined,
      userQuery: url.searchParams.get("userQuery") || undefined,
      partCategory: url.searchParams.get("partCategory") || undefined,
      brand: url.searchParams.get("brand") || undefined,
      sortBy,
      sortOrder,
    })
    return NextResponse.json(result)
  } catch (error) {
    return authErrorResponse(error)
  }
}
