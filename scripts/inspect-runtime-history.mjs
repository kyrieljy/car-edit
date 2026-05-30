import fs from "node:fs"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"
import { defaultDbPath, parseArgs, repoRoot, rows } from "./project-config-utils.mjs"

const args = parseArgs()
const explicitDb = args.db ? path.resolve(String(args.db)) : ""
const candidates = uniquePaths([
  explicitDb,
  path.join(process.cwd(), "data", "car_mod_effect.sqlite"),
  defaultDbPath(),
])

const report = {
  generatedAt: new Date().toISOString(),
  cwd: process.cwd(),
  repoRoot: repoRoot(),
  env: pickEnv([
    "APP_URL",
    "NEXT_PUBLIC_APP_URL",
    "SITE_URL",
    "PROVIDER_PUBLIC_BASE_URL",
    "AUTH_COOKIE_SECURE",
  ]),
  dbs: candidates.map(inspectDb),
}

if (args.format === "json") {
  console.log(JSON.stringify(report, null, 2))
} else {
  console.log(toMarkdown(report))
}

function inspectDb(dbPath) {
  const exists = fs.existsSync(dbPath)
  const item = {
    path: dbPath,
    exists,
    sizeBytes: exists ? fs.statSync(dbPath).size : 0,
    counts: {},
    generationGroups: [],
    visibleConfigGenerationCount: null,
    latestConfigGenerations: [],
    latestAnyGenerations: [],
    latestUploads: [],
    latestUsers: [],
    latestSessions: [],
  }
  if (!exists) return item
  const db = new DatabaseSync(dbPath, { readOnly: true })
  try {
    for (const table of ["users", "sessions", "vehicle_uploads", "generation_jobs", "garage_items", "chat_sessions", "chat_messages"]) {
      item.counts[table] = tableCount(db, table)
    }
    item.generationGroups = safeRows(
      db,
      `
        SELECT mode, status, COUNT(*) AS count
        FROM generation_jobs
        GROUP BY mode, status
        ORDER BY mode, status
      `,
    )
    item.visibleConfigGenerationCount = safeScalar(
      db,
      `
        SELECT COUNT(*) AS value
        FROM generation_jobs
        JOIN vehicle_uploads ON vehicle_uploads.id = generation_jobs.vehicle_upload_id
        WHERE generation_jobs.status = 'succeeded'
          AND generation_jobs.result_image_url != ''
          AND generation_jobs.mode = 'config'
      `,
    )
    item.latestConfigGenerations = safeRows(
      db,
      `
        SELECT id, user_id, mode, status, provider, vehicle_upload_id, result_image_url, failure_reason, created_at
        FROM generation_jobs
        WHERE mode = 'config'
        ORDER BY created_at DESC
        LIMIT 10
      `,
    ).map(mapGenerationRow)
    item.latestAnyGenerations = safeRows(
      db,
      `
        SELECT id, user_id, mode, status, provider, vehicle_upload_id, result_image_url, failure_reason, created_at
        FROM generation_jobs
        ORDER BY created_at DESC
        LIMIT 10
      `,
    ).map(mapGenerationRow)
    item.latestUploads = safeRows(
      db,
      `
        SELECT id, user_id, url, mime, size, created_at
        FROM vehicle_uploads
        ORDER BY created_at DESC
        LIMIT 10
      `,
    ).map((row) => ({
      id: text(row.id),
      userId: text(row.user_id),
      url: compactUrl(row.url),
      mime: text(row.mime),
      size: Number(row.size || 0),
      createdAt: formatMs(row.created_at),
    }))
    item.latestUsers = safeRows(
      db,
      `
        SELECT id, username, phone, role, plan, created_at
        FROM users
        ORDER BY created_at DESC
        LIMIT 10
      `,
    ).map((row) => ({
      id: text(row.id),
      username: text(row.username),
      phone: maskPhone(row.phone),
      role: text(row.role),
      plan: text(row.plan),
      createdAt: formatMs(row.created_at),
    }))
    item.latestSessions = safeRows(
      db,
      `
        SELECT id, user_id, expires_at, created_at
        FROM sessions
        ORDER BY created_at DESC
        LIMIT 10
      `,
    ).map((row) => ({
      id: text(row.id),
      userId: text(row.user_id),
      expiresAt: formatMs(row.expires_at),
      createdAt: formatMs(row.created_at),
    }))
  } finally {
    db.close()
  }
  return item
}

function tableCount(db, table) {
  try {
    return Number(db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get()?.count || 0)
  } catch {
    return null
  }
}

function safeRows(db, sql) {
  try {
    return rows(db, sql)
  } catch {
    return []
  }
}

function safeScalar(db, sql) {
  try {
    return Number(db.prepare(sql).get()?.value || 0)
  } catch {
    return null
  }
}

function mapGenerationRow(row) {
  return {
    id: text(row.id),
    userId: text(row.user_id),
    mode: text(row.mode),
    status: text(row.status),
    provider: text(row.provider),
    vehicleUploadId: text(row.vehicle_upload_id),
    resultImageUrl: compactUrl(row.result_image_url),
    failureReason: text(row.failure_reason).slice(0, 160),
    createdAt: formatMs(row.created_at),
  }
}

function toMarkdown(value) {
  const lines = []
  lines.push("# Runtime History Inspection")
  lines.push("")
  lines.push(`Generated: ${value.generatedAt}`)
  lines.push(`CWD: ${value.cwd}`)
  lines.push(`Repo: ${value.repoRoot}`)
  lines.push("")
  lines.push("## Environment")
  for (const [key, envValue] of Object.entries(value.env)) lines.push(`- ${key}: ${envValue || "(empty)"}`)
  lines.push("")
  for (const db of value.dbs) {
    lines.push(`## DB: ${db.path}`)
    lines.push("")
    lines.push(`- Exists: ${db.exists}`)
    lines.push(`- Size: ${db.sizeBytes} bytes`)
    if (!db.exists) {
      lines.push("")
      continue
    }
    lines.push(`- Counts: ${Object.entries(db.counts).map(([key, count]) => `${key}=${count ?? "missing"}`).join(", ")}`)
    lines.push(`- Visible config history rows: ${db.visibleConfigGenerationCount ?? "unknown"}`)
    lines.push("")
    lines.push("### Generation Groups")
    lines.push("")
    lines.push("| Mode | Status | Count |")
    lines.push("| --- | --- | ---: |")
    if (db.generationGroups.length) {
      for (const row of db.generationGroups) lines.push(`| ${text(row.mode) || "(empty)"} | ${text(row.status) || "(empty)"} | ${Number(row.count || 0)} |`)
    } else {
      lines.push("| none | none | 0 |")
    }
    lines.push("")
    appendTable(lines, "Latest Config Generations", db.latestConfigGenerations, ["id", "userId", "status", "provider", "resultImageUrl", "createdAt"])
    appendTable(lines, "Latest Any Generations", db.latestAnyGenerations, ["id", "userId", "mode", "status", "provider", "resultImageUrl", "createdAt"])
    appendTable(lines, "Latest Uploads", db.latestUploads, ["id", "userId", "url", "mime", "size", "createdAt"])
    appendTable(lines, "Latest Users", db.latestUsers, ["id", "username", "phone", "role", "plan", "createdAt"])
    appendTable(lines, "Latest Sessions", db.latestSessions, ["id", "userId", "expiresAt", "createdAt"])
  }
  return `${lines.join("\n")}\n`
}

function appendTable(lines, title, rows, columns) {
  lines.push(`### ${title}`)
  lines.push("")
  lines.push(`| ${columns.join(" | ")} |`)
  lines.push(`| ${columns.map(() => "---").join(" | ")} |`)
  if (rows.length) {
    for (const row of rows) lines.push(`| ${columns.map((column) => escapeCell(row[column])).join(" | ")} |`)
  } else {
    lines.push(`| ${columns.map((_, index) => (index === 0 ? "none" : "")).join(" | ")} |`)
  }
  lines.push("")
}

function pickEnv(keys) {
  return Object.fromEntries(keys.map((key) => [key, process.env[key] || ""]))
}

function uniquePaths(paths) {
  const seen = new Set()
  const out = []
  for (const item of paths) {
    if (!item) continue
    const resolved = path.resolve(item)
    if (seen.has(resolved)) continue
    seen.add(resolved)
    out.push(resolved)
  }
  return out
}

function compactUrl(value) {
  const textValue = text(value)
  if (textValue.length <= 96) return textValue
  return `${textValue.slice(0, 72)}...${textValue.slice(-16)}`
}

function text(value) {
  return String(value ?? "")
}

function formatMs(value) {
  const n = Number(value || 0)
  if (!n) return ""
  const date = new Date(n)
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString()
}

function maskPhone(value) {
  const raw = text(value)
  if (raw.length < 7) return raw
  return `${raw.slice(0, 3)}****${raw.slice(-4)}`
}

function escapeCell(value) {
  return text(value).replace(/\|/g, "\\|").replace(/\n/g, " ")
}
