import { authErrorResponse, requireAdminUser } from "@/lib/server/auth"
import { getUsersForExport } from "@/lib/server/db"
import { createCsvResponse } from "@/lib/server/export-service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    requireAdminUser()
    const users = getUsersForExport()

    return createCsvResponse(
      users as Array<Record<string, unknown>>,
      [
        { key: "username", label: "Username" },
        { key: "phone", label: "Phone" },
        { key: "plan", label: "Plan" },
        { key: "role", label: "Role" },
        { key: "createdAt", label: "Registered At", format: (row) => new Date(Number(row.createdAt)).toISOString() },
        { key: "lastLoginAt", label: "Last Login", format: (row) => (Number(row.lastLoginAt) > 0 ? new Date(Number(row.lastLoginAt)).toISOString() : "") },
        { key: "tags", label: "Tags", format: (row) => Array.isArray(row.tags) ? (row.tags as string[]).join("; ") : "" },
      ],
      `users_${new Date().toISOString().slice(0, 10)}.csv`,
    )
  } catch (error) {
    return authErrorResponse(error)
  }
}
