import { NextResponse } from "next/server"
import { listAvatarPresets } from "@/lib/server/db"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json({ avatars: listAvatarPresets({ activeOnly: true }) })
}
