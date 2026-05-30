import fs from "node:fs"
import path from "node:path"
import {
  defaultDbPath,
  openReadonlyProjectDb,
  parseArgs,
  projectConfigTables,
  rows,
  runtimeTables,
  safeJson,
  stableStringify,
} from "./project-config-utils.mjs"

const args = parseArgs()
const dbPath = path.resolve(String(args.db || defaultDbPath()))
const format = String(args.format || "markdown")
const audit = buildAudit(dbPath)

if (args.out) {
  const outPath = path.resolve(String(args.out))
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, format === "json" ? `${stableStringify(audit)}\n` : auditToMarkdown(audit), "utf8")
  console.log(`Wrote audit report to ${outPath}`)
} else if (format === "json") {
  console.log(stableStringify(audit))
} else {
  console.log(auditToMarkdown(audit))
}

function buildAudit(dbPath) {
  const db = openReadonlyProjectDb(dbPath)
  try {
    const tableCounts = Object.fromEntries([...projectConfigTables, ...runtimeTables].map((table) => [table, countTable(db, table)]))
    const providers = rows(db, "SELECT id, label, base_url, model_name, capabilities_json, enabled, active, api_key_cipher, api_key_masked, updated_at FROM provider_configs ORDER BY active DESC, id").map((row) => ({
      id: String(row.id),
      label: String(row.label || ""),
      baseUrlHost: hostOnly(String(row.base_url || "")),
      modelName: String(row.model_name || ""),
      capabilities: safeJson(String(row.capabilities_json || "[]"), []),
      enabled: Boolean(row.enabled),
      active: Boolean(row.active),
      hasStoredKey: Boolean(row.api_key_cipher || row.api_key_masked),
      updatedAt: Number(row.updated_at || 0),
    }))
    const workflows = rows(db, "SELECT id, mode, title, enabled, provider_id, fallback_provider_id, result_check_enabled, auto_retry_enabled, updated_at FROM workflow_configs ORDER BY mode, id").map((row) => ({
      id: String(row.id),
      mode: String(row.mode),
      title: String(row.title || ""),
      enabled: Boolean(row.enabled),
      providerId: String(row.provider_id || ""),
      fallbackProviderId: String(row.fallback_provider_id || ""),
      resultCheckEnabled: Boolean(row.result_check_enabled),
      autoRetryEnabled: Boolean(row.auto_retry_enabled),
      updatedAt: Number(row.updated_at || 0),
    }))
    const activePrompt = rows(db, "SELECT id, title, version, created_at FROM prompt_presets WHERE active = 1 ORDER BY created_at DESC LIMIT 1")[0] ?? null
    const promptTemplateCounts = rows(db, "SELECT scope, COUNT(*) AS count FROM prompt_templates GROUP BY scope ORDER BY scope").map((row) => ({
      scope: String(row.scope),
      count: Number(row.count || 0),
    }))
    const imageUrls = [
      ...rows(db, "SELECT url AS value FROM vehicle_uploads").map((row) => ({ area: "vehicle_uploads.url", value: String(row.value || "") })),
      ...rows(db, "SELECT result_image_url AS value FROM generation_jobs").map((row) => ({ area: "generation_jobs.result_image_url", value: String(row.value || "") })),
      ...rows(db, "SELECT result_image_url AS value FROM chat_messages WHERE result_image_url != ''").map((row) => ({ area: "chat_messages.result_image_url", value: String(row.value || "") })),
      ...rows(db, "SELECT url AS value FROM chat_attachments").map((row) => ({ area: "chat_attachments.url", value: String(row.value || "") })),
      ...rows(db, "SELECT image_url AS value FROM part_assets").map((row) => ({ area: "part_assets.image_url", value: String(row.value || "") })),
      ...rows(db, "SELECT url AS value FROM part_asset_references").map((row) => ({ area: "part_asset_references.url", value: String(row.value || "") })),
    ]
    const imageBuckets = summarizeImageUrls(imageUrls)
    return {
      generatedAt: new Date().toISOString(),
      dbPath,
      tableCounts,
      projectConfigTables,
      runtimeTables,
      activePrompt: activePrompt
        ? {
            id: String(activePrompt.id),
            title: String(activePrompt.title || ""),
            version: String(activePrompt.version || ""),
            createdAt: Number(activePrompt.created_at || 0),
          }
        : null,
      promptTemplateCounts,
      providers,
      workflows,
      imageBuckets,
      unusedCodeCandidates: scanUnusedCodeCandidates(),
      deploymentRisks: [
        "SQLite mixes project configuration and runtime/user data; use export/apply scripts for project config instead of copying the whole DB.",
        "Provider keys are environment secrets and are intentionally excluded from project config exports.",
        "Runtime upload/result folders are ignored by Git; fresh provider outputs must be materialized locally before DB persistence.",
        "Yunwu is the default image provider; verify with an approved live test after saving the environment-specific API key.",
      ],
    }
  } finally {
    db.close()
  }
}

function countTable(db, table) {
  try {
    const row = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get()
    return Number(row?.count || 0)
  } catch {
    return null
  }
}

function summarizeImageUrls(items) {
  const summary = new Map()
  for (const item of items) {
    const bucket = imageBucket(item.value)
    const key = `${item.area}::${bucket}`
    const current = summary.get(key) ?? { area: item.area, bucket, count: 0, examples: [] }
    current.count += 1
    if (current.examples.length < 3 && item.value) current.examples.push(redactUrl(item.value))
    summary.set(key, current)
  }
  return Array.from(summary.values()).sort((a, b) => a.area.localeCompare(b.area) || a.bucket.localeCompare(b.bucket))
}

function imageBucket(value) {
  if (!value) return "empty"
  if (value.startsWith("/results/")) return "local_result"
  if (value.startsWith("/uploads/")) return "local_upload"
  if (value.startsWith("/assets/")) return "static_asset"
  if (value.startsWith("/api/proxy-image")) return "app_proxy"
  if (/^https?:\/\//i.test(value)) return "remote_url"
  return "other"
}

function hostOnly(value) {
  try {
    return new URL(value).host
  } catch {
    return value.startsWith("local://") ? value : ""
  }
}

function redactUrl(value) {
  if (!/^https?:\/\//i.test(value)) return value
  try {
    const url = new URL(value)
    return `${url.protocol}//${url.host}${url.pathname}`
  } catch {
    return "remote-url"
  }
}

function scanUnusedCodeCandidates() {
  const filePath = path.join(process.cwd(), "components", "admin-console.tsx")
  if (!fs.existsSync(filePath)) return []
  const source = fs.readFileSync(filePath, "utf8")
  return [
    "AssetManager",
    "ProviderManager",
    "ProviderManagerV2",
    "LegacyProviderManagerV2",
    "PromptTemplateManager",
    "PromptManager",
    "PlanManager",
    "WorkflowManager",
  ].filter((name) => new RegExp(`function\\s+${name}\\b`).test(source))
}

function auditToMarkdown(audit) {
  const lines = []
  lines.push("# Project State Audit")
  lines.push("")
  lines.push(`Generated: ${audit.generatedAt}`)
  lines.push(`DB: ${audit.dbPath}`)
  lines.push("")
  lines.push("## Table Boundary Counts")
  lines.push("")
  lines.push("| Boundary | Table | Rows |")
  lines.push("| --- | --- | ---: |")
  audit.projectConfigTables.forEach((table) => lines.push(`| project_config | ${table} | ${audit.tableCounts[table] ?? "missing"} |`))
  audit.runtimeTables.forEach((table) => lines.push(`| runtime | ${table} | ${audit.tableCounts[table] ?? "missing"} |`))
  lines.push("")
  lines.push("## Active Config")
  lines.push("")
  lines.push(`- Active prompt: ${audit.activePrompt ? `${audit.activePrompt.id} (${audit.activePrompt.version})` : "none"}`)
  audit.providers.forEach((provider) => {
    lines.push(`- Provider ${provider.active ? "[active] " : ""}${provider.id}: enabled=${provider.enabled}, host=${provider.baseUrlHost}, model=${provider.modelName}, hasStoredKey=${provider.hasStoredKey}`)
  })
  audit.workflows.forEach((workflow) => {
    lines.push(`- Workflow ${workflow.mode}/${workflow.id}: enabled=${workflow.enabled}, provider=${workflow.providerId}, fallback=${workflow.fallbackProviderId || "none"}`)
  })
  lines.push("")
  lines.push("## Prompt Templates")
  lines.push("")
  audit.promptTemplateCounts.forEach((item) => lines.push(`- ${item.scope}: ${item.count}`))
  lines.push("")
  lines.push("## Image URL Buckets")
  lines.push("")
  lines.push("| Area | Bucket | Count | Examples |")
  lines.push("| --- | --- | ---: | --- |")
  audit.imageBuckets.forEach((bucket) => lines.push(`| ${bucket.area} | ${bucket.bucket} | ${bucket.count} | ${bucket.examples.join("<br>")} |`))
  lines.push("")
  lines.push("## Cleanup Candidates")
  lines.push("")
  lines.push(audit.unusedCodeCandidates.length ? audit.unusedCodeCandidates.map((name) => `- ${name}`).join("\n") : "- none")
  lines.push("")
  lines.push("## Deployment Risks")
  lines.push("")
  lines.push(audit.deploymentRisks.map((item) => `- ${item}`).join("\n"))
  lines.push("")
  return `${lines.join("\n")}\n`
}
