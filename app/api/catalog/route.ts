import { NextResponse } from "next/server"
import { getCatalog } from "@/lib/server/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    return NextResponse.json(getCatalog())
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Catalog failed" }, { status: 500 })
  }
}
