import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { DatabaseSync } from "node:sqlite"

export const PROJECT_CONFIG_SCHEMA_VERSION = 1

export const projectConfigTables = [
  "asset_categories",
  "asset_brands",
  "part_assets",
  "part_asset_references",
  "prompt_presets",
  "prompt_templates",
  "provider_configs",
  "workflow_configs",
  "guardrail_configs",
  "membership_plans",
]

export const runtimeTables = [
  "users",
  "user_identities",
  "sessions",
  "verification_codes",
  "vehicle_uploads",
  "generation_jobs",
  "usage_ledger",
  "garage_items",
  "chat_sessions",
  "chat_messages",
  "chat_attachments",
  "subscriptions",
  "entitlement_usage",
  "quota_adjustments",
  "payment_orders",
  "account_messages",
  "audit_logs",
  "generation_bad_cases",
]

const forbiddenSecretFieldNames = new Set([
  "apiKey",
  "api_key",
  "apiKeyCipher",
  "api_key_cipher",
  "apiKeyMasked",
  "api_key_masked",
  "maskedKey",
  "secret",
  "token",
])

export function repoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
}

export function defaultDbPath() {
  return path.join(repoRoot(), "data", "car_mod_effect.sqlite")
}

export function parseArgs(argv = process.argv.slice(2)) {
  const args = {}
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (!arg.startsWith("--")) continue
    const key = arg.slice(2)
    const next = argv[index + 1]
    if (!next || next.startsWith("--")) {
      args[key] = true
      continue
    }
    args[key] = next
    index += 1
  }
  return args
}

export function openProjectDb(dbPath = defaultDbPath()) {
  if (!fs.existsSync(dbPath)) {
    throw new Error(`SQLite DB not found: ${dbPath}`)
  }
  return new DatabaseSync(dbPath, { readOnly: false })
}

export function openReadonlyProjectDb(dbPath = defaultDbPath()) {
  if (!fs.existsSync(dbPath)) {
    throw new Error(`SQLite DB not found: ${dbPath}`)
  }
  return new DatabaseSync(dbPath, { readOnly: true })
}

export function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"))
}

export function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${stableStringify(value)}\n`, "utf8")
}

export function stableStringify(value) {
  return JSON.stringify(sortDeep(value), null, 2)
}

export function exportProjectConfig(dbPath = defaultDbPath()) {
  const db = openReadonlyProjectDb(dbPath)
  try {
    const promptPresets = rows(db, "SELECT id, title, version, body, negative_prompt, active, created_at FROM prompt_presets ORDER BY id").map((row) => ({
      id: text(row.id),
      title: text(row.title),
      version: text(row.version),
      body: text(row.body),
      negativePrompt: text(row.negative_prompt),
      active: bool(row.active),
      createdAt: number(row.created_at),
    }))
    const promptTemplates = rows(db, "SELECT id, scope, title, body, asset_id, combination_key, active, sort_order, updated_at FROM prompt_templates ORDER BY scope, sort_order, id").map((row) => ({
      id: text(row.id),
      scope: text(row.scope),
      title: text(row.title),
      body: text(row.body),
      assetId: text(row.asset_id),
      combinationKey: text(row.combination_key),
      active: bool(row.active),
      sortOrder: number(row.sort_order),
      updatedAt: number(row.updated_at),
    }))
    const providers = rows(db, "SELECT id, label, base_url, model_name, capabilities_json, enabled, active, api_key_cipher, api_key_masked, updated_at FROM provider_configs ORDER BY id").map((row) => ({
      id: text(row.id),
      label: text(row.label),
      baseUrl: text(row.base_url),
      modelName: text(row.model_name),
      capabilities: safeJson(text(row.capabilities_json), []),
      enabled: bool(row.enabled),
      active: bool(row.active),
      hasStoredKey: Boolean(row.api_key_cipher || row.api_key_masked),
      updatedAt: number(row.updated_at),
    }))
    const workflows = rows(db, "SELECT * FROM workflow_configs ORDER BY mode, id").map((row) => ({
      id: text(row.id),
      mode: text(row.mode),
      title: text(row.title),
      enabled: bool(row.enabled),
      vehicleCheckEnabled: bool(row.vehicle_check_enabled),
      partCheckEnabled: bool(row.part_check_enabled),
      allowFollowUp: bool(row.allow_follow_up),
      promptTemplateIds: safeJson(text(row.prompt_template_ids_json), []),
      providerId: text(row.provider_id),
      fallbackProviderId: text(row.fallback_provider_id),
      resultCheckEnabled: bool(row.result_check_enabled),
      autoRetryEnabled: bool(row.auto_retry_enabled),
      maxRetries: number(row.max_retries),
      nodes: safeJson(text(row.nodes_json), []),
      edges: safeJson(text(row.edges_json), []),
      updatedAt: number(row.updated_at),
    }))
    const categories = rows(db, "SELECT * FROM asset_categories ORDER BY sort_order, id").map((row) => ({
      id: text(row.id),
      label: text(row.label),
      labelEn: text(row.label_en),
      labelZh: text(row.label_zh),
      description: text(row.description),
      sortOrder: number(row.sort_order),
      aliases: safeJson(text(row.aliases_json), []),
      chatEnabled: bool(row.chat_enabled),
      referenceHighRisk: bool(row.reference_high_risk),
    }))
    const brands = rows(db, "SELECT * FROM asset_brands ORDER BY category_id, sort_order, id").map((row) => ({
      id: text(row.id),
      categoryId: text(row.category_id),
      label: text(row.label),
      sortOrder: number(row.sort_order),
      active: bool(row.active),
    }))
    const assets = rows(db, "SELECT * FROM part_assets ORDER BY category_id, sort_order, id").map((row) => ({
      id: text(row.id),
      categoryId: text(row.category_id),
      brandId: text(row.brand_id),
      brand: text(row.brand),
      model: text(row.model),
      variant: text(row.variant),
      keywords: text(row.keywords),
      color: text(row.color),
      finish: text(row.finish),
      imageUrl: text(row.image_url),
      imageCrop: text(row.image_crop),
      active: bool(row.active),
      sortOrder: number(row.sort_order),
      promptHint: text(row.prompt_hint),
      defaultColorPolicy: text(row.default_color_policy),
      allowedColorPolicies: safeJson(text(row.allowed_color_policies_json), []),
      promptTestStatus: text(row.prompt_test_status),
      generationReady: bool(row.generation_ready),
      badCaseNotes: text(row.bad_case_notes),
      recommendedViews: safeJson(text(row.recommended_views_json), []),
      createdAt: number(row.created_at),
    }))
    const references = rows(db, "SELECT * FROM part_asset_references ORDER BY asset_id, priority, id").map((row) => ({
      id: text(row.id),
      assetId: text(row.asset_id),
      url: text(row.url),
      role: text(row.role),
      view: text(row.view),
      priority: number(row.priority),
      promptHint: text(row.prompt_hint),
      uploadToModel: bool(row.upload_to_model),
      active: bool(row.active),
      createdAt: number(row.created_at),
    }))
    const guardrails = rows(db, "SELECT * FROM guardrail_configs ORDER BY id").map((row) => ({
      id: text(row.id),
      sop: text(row.sop),
      allowedDescription: text(row.allowed_description),
      blockedTerms: text(row.blocked_terms),
      recommendedPrompts: text(row.recommended_prompts),
      mockMode: bool(row.mock_mode),
      mockFailUploads: bool(row.mock_fail_uploads),
      provider: text(row.provider),
      updatedAt: number(row.updated_at),
    }))
    const membershipPlans = rows(db, "SELECT * FROM membership_plans ORDER BY sort_order, id").map((row) => ({
      id: text(row.id),
      label: text(row.label),
      priceCents: number(row.price_cents),
      configLimit: number(row.config_limit),
      chatDailyLimit: number(row.chat_daily_limit),
      configUnlimited: bool(row.config_unlimited),
      chatUnlimited: bool(row.chat_unlimited),
      chatEnabled: bool(row.chat_enabled),
      active: bool(row.active),
      sortOrder: number(row.sort_order),
      updatedAt: number(row.updated_at),
    }))

    return {
      schemaVersion: PROJECT_CONFIG_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      source: {
        dbPath: path.relative(repoRoot(), dbPath).replace(/\\/g, "/"),
      },
      active: {
        promptPresetId: promptPresets.find((item) => item.active)?.id ?? "",
        promptPresetVersion: promptPresets.find((item) => item.active)?.version ?? "",
        providerId: providers.find((item) => item.active)?.id ?? "",
        workflows: Object.fromEntries(workflows.filter((item) => item.enabled).map((item) => [item.mode, item.id])),
      },
      promptPresets,
      promptTemplates,
      providers,
      workflows,
      categories,
      brands,
      assets,
      references,
      guardrails,
      membershipPlans,
    }
  } finally {
    db.close()
  }
}

export function validateProjectConfig(config) {
  const errors = []
  const warnings = []
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return { ok: false, errors: ["config must be a JSON object"], warnings }
  }
  if (config.schemaVersion !== PROJECT_CONFIG_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${PROJECT_CONFIG_SCHEMA_VERSION}`)
  }
  const secretPaths = secretFieldPaths(config)
  if (secretPaths.length) {
    errors.push(`secret-bearing fields are not allowed: ${secretPaths.join(", ")}`)
  }
  for (const key of ["promptPresets", "promptTemplates", "providers", "workflows", "categories", "brands", "assets", "references", "guardrails", "membershipPlans"]) {
    if (!Array.isArray(config[key])) errors.push(`${key} must be an array`)
  }
  const providerIds = new Set((config.providers ?? []).map((item) => item.id))
  for (const workflow of config.workflows ?? []) {
    if (workflow.providerId && !providerIds.has(workflow.providerId)) {
      warnings.push(`workflow ${workflow.id} references provider ${workflow.providerId}, which is not in the export`)
    }
  }
  for (const provider of config.providers ?? []) {
    if (!provider.id || !provider.label || !provider.baseUrl || !provider.modelName) {
      warnings.push(`provider ${provider.id || "(missing id)"} has incomplete non-secret config`)
    }
    if (String(provider.baseUrl || "").includes("api.302.ai")) {
      warnings.push(`provider ${provider.id} uses api.302.ai; prefer the domestic/configured 302 host before exporting to a server in China`)
    }
  }
  return { ok: errors.length === 0, errors, warnings }
}

export function normalizedForCompare(config) {
  const copy = structuredClone(config)
  delete copy.exportedAt
  delete copy.source
  return sortDeep(copy)
}

export function safeJson(value, fallback) {
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

export function rows(db, sql, params = []) {
  return db.prepare(sql).all(...params)
}

export function text(value) {
  return String(value ?? "")
}

export function number(value) {
  return Number(value || 0)
}

export function bool(value) {
  return Boolean(value)
}

export function int(value) {
  return value ? 1 : 0
}

function secretFieldPaths(value, pathParts = []) {
  if (!value || typeof value !== "object") return []
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => secretFieldPaths(item, [...pathParts, String(index)]))
  }
  return Object.entries(value).flatMap(([key, child]) => {
    const path = [...pathParts, key]
    const own = forbiddenSecretFieldNames.has(key) ? [path.join(".")] : []
    return [...own, ...secretFieldPaths(child, path)]
  })
}

function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep)
  if (!value || typeof value !== "object") return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortDeep(value[key])]))
}
