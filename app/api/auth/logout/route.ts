import { NextResponse } from "next/server"
import { clearSession } from "@/lib/server/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST() {
  return clearSession(NextResponse.json({ ok: true }))
}
