import { NextResponse } from "next/server"
import { authErrorResponse, requireAdminUser } from "@/lib/server/auth"
import { database } from "@/lib/server/db"
import type { BroadcastMessageInput } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    requireAdminUser()
    const body = (await request.json()) as BroadcastMessageInput

    if (!body.title || !body.body) {
      return NextResponse.json({ error: "Title and body are required" }, { status: 400 })
    }

    const db = database()
    let userIds: string[] = []

    if (body.target === "all") {
      const rows = db.prepare("SELECT id FROM users").all() as Array<{ id: string }>
      userIds = rows.map((r) => r.id)
    } else if (body.target === "plan" && body.planId) {
      const rows = db.prepare("SELECT id FROM users WHERE plan = ?").all(body.planId) as Array<{ id: string }>
      userIds = rows.map((r) => r.id)
    } else if (body.target === "tag" && body.tag) {
      // Query users that have the specified manual tag
      const rows = db
        .prepare("SELECT user_id FROM user_tags WHERE tag = ?")
        .all(body.tag) as Array<{ user_id: string }>
      userIds = rows.map((r) => r.user_id)
    } else if (body.target === "users" && body.userIds && body.userIds.length > 0) {
      userIds = body.userIds
    } else {
      return NextResponse.json({ error: "Invalid target or missing filter" }, { status: 400 })
    }

    if (userIds.length === 0) {
      return NextResponse.json({ sent: 0 })
    }

    const now = Date.now()
    const insert = db.prepare(
      "INSERT OR IGNORE INTO account_messages (id, user_id, kind, title, body, metadata_json, read_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )

    db.exec("BEGIN")
    try {
      for (const userId of userIds) {
        const id = `broadcast_${crypto.randomUUID().slice(0, 10)}`
        insert.run(id, userId, "system", body.title, body.body, "{}", 0, now)
      }
      db.exec("COMMIT")
    } catch (err) {
      db.exec("ROLLBACK")
      throw err
    }

    return NextResponse.json({ sent: userIds.length })
  } catch (error) {
    return authErrorResponse(error)
  }
}
