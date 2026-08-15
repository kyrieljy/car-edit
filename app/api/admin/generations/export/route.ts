import { authErrorResponse, requireAdminUser } from "@/lib/server/auth"
import { getGenerationList, type GenerationListFilter } from "@/lib/server/db"
import { createCsvResponse } from "@/lib/server/export-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: Request) {
  try {
    requireAdminUser()
    const url = new URL(request.url)
    const sortBy = (url.searchParams.get("sortBy") || "created_at") as GenerationListFilter["sortBy"]
    const sortOrder = (url.searchParams.get("sortOrder") || "desc") as GenerationListFilter["sortOrder"]

    const result = getGenerationList({
      page: 1,
      pageSize: 10000,
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

    return createCsvResponse(
      result.items as Array<Record<string, unknown>>,
      [
        { key: "id", label: "Task ID" },
        { key: "username", label: "User" },
        { key: "mode", label: "Mode" },
        { key: "status", label: "Status" },
        { key: "provider", label: "Provider" },
        { key: "displayVehicleModel", label: "Vehicle" },
        { key: "vehicleBrand", label: "Brand" },
        { key: "durationMs", label: "Duration (ms)" },
        { key: "createdAt", label: "Created At", format: (row) => new Date(Number(row.createdAt)).toISOString() },
        { key: "failureReason", label: "Failure Reason" },
      ],
      `generations_${new Date().toISOString().slice(0, 10)}.csv`,
    )
  } catch (error) {
    return authErrorResponse(error)
  }
}
