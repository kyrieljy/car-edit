import path from "node:path"
import {
  defaultDbPath,
  int,
  loadJson,
  openProjectDb,
  parseArgs,
  stableStringify,
  validateProjectConfig,
} from "./project-config-utils.mjs"

const args = parseArgs()
const filePath = args.file ? path.resolve(String(args.file)) : ""
if (!filePath) {
  console.error("Usage: node scripts/apply-project-config.mjs --file artifacts/project-config.json [--db data/car_mod_effect.sqlite] [--apply]")
  process.exit(2)
}

const config = loadJson(filePath)
const validation = validateProjectConfig(config)
if (!validation.ok) {
  console.error(stableStringify(validation))
  process.exit(1)
}

const dryRun = !args.apply
const actions = {
  dryRun,
  promptPresets: config.promptPresets.length,
  promptTemplates: config.promptTemplates.length,
  providers: config.providers.length,
  workflows: config.workflows.length,
  categories: config.categories.length,
  brands: config.brands.length,
  assets: config.assets.length,
  references: config.references.length,
  guardrails: config.guardrails.length,
  membershipPlans: config.membershipPlans.length,
  warnings: validation.warnings,
}

if (dryRun) {
  console.log(stableStringify(actions))
  process.exit(0)
}

const db = openProjectDb(path.resolve(String(args.db || defaultDbPath())))
db.exec("BEGIN")
try {
  upsertPromptPresets(db, config.promptPresets)
  upsertPromptTemplates(db, config.promptTemplates)
  upsertProviders(db, config.providers)
  upsertWorkflows(db, config.workflows)
  upsertCategories(db, config.categories)
  upsertBrands(db, config.brands)
  upsertAssets(db, config.assets)
  upsertReferences(db, config.references)
  upsertGuardrails(db, config.guardrails)
  upsertMembershipPlans(db, config.membershipPlans)
  db.exec("COMMIT")
} catch (error) {
  db.exec("ROLLBACK")
  throw error
} finally {
  db.close()
}

console.log(stableStringify(actions))

function upsertPromptPresets(db, rows) {
  const statement = db.prepare(`
    INSERT INTO prompt_presets (id, title, version, body, negative_prompt, active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      version = excluded.version,
      body = excluded.body,
      negative_prompt = excluded.negative_prompt,
      active = excluded.active
  `)
  rows.forEach((row) => statement.run(row.id, row.title, row.version, row.body, row.negativePrompt, int(row.active), row.createdAt || Date.now()))
}

function upsertPromptTemplates(db, rows) {
  const statement = db.prepare(`
    INSERT INTO prompt_templates (id, scope, title, body, asset_id, combination_key, active, sort_order, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      scope = excluded.scope,
      title = excluded.title,
      body = excluded.body,
      asset_id = excluded.asset_id,
      combination_key = excluded.combination_key,
      active = excluded.active,
      sort_order = excluded.sort_order,
      updated_at = excluded.updated_at
  `)
  rows.forEach((row) => statement.run(row.id, row.scope, row.title, row.body, row.assetId || "", row.combinationKey || "", int(row.active), row.sortOrder || 0, row.updatedAt || Date.now()))
}

function upsertProviders(db, rows) {
  const statement = db.prepare(`
    INSERT INTO provider_configs (id, label, base_url, model_name, capabilities_json, enabled, active, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      label = excluded.label,
      base_url = excluded.base_url,
      model_name = excluded.model_name,
      capabilities_json = excluded.capabilities_json,
      enabled = excluded.enabled,
      active = excluded.active,
      updated_at = excluded.updated_at
  `)
  rows.forEach((row) => statement.run(row.id, row.label, row.baseUrl, row.modelName, JSON.stringify(row.capabilities || []), int(row.enabled), int(row.active), row.updatedAt || Date.now()))
}

function upsertWorkflows(db, rows) {
  const statement = db.prepare(`
    INSERT INTO workflow_configs
      (id, mode, title, enabled, vehicle_check_enabled, part_check_enabled, allow_follow_up, prompt_template_ids_json, provider_id, fallback_provider_id, result_check_enabled, auto_retry_enabled, max_retries, nodes_json, edges_json, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      mode = excluded.mode,
      title = excluded.title,
      enabled = excluded.enabled,
      vehicle_check_enabled = excluded.vehicle_check_enabled,
      part_check_enabled = excluded.part_check_enabled,
      allow_follow_up = excluded.allow_follow_up,
      prompt_template_ids_json = excluded.prompt_template_ids_json,
      provider_id = excluded.provider_id,
      fallback_provider_id = excluded.fallback_provider_id,
      result_check_enabled = excluded.result_check_enabled,
      auto_retry_enabled = excluded.auto_retry_enabled,
      max_retries = excluded.max_retries,
      nodes_json = excluded.nodes_json,
      edges_json = excluded.edges_json,
      updated_at = excluded.updated_at
  `)
  rows.forEach((row) => statement.run(
    row.id,
    row.mode,
    row.title,
    int(row.enabled),
    int(row.vehicleCheckEnabled),
    int(row.partCheckEnabled),
    int(row.allowFollowUp),
    JSON.stringify(row.promptTemplateIds || []),
    row.providerId || "",
    row.fallbackProviderId || "",
    int(row.resultCheckEnabled),
    int(row.autoRetryEnabled),
    row.maxRetries || 0,
    JSON.stringify(row.nodes || []),
    JSON.stringify(row.edges || []),
    row.updatedAt || Date.now(),
  ))
}

function upsertCategories(db, rows) {
  const statement = db.prepare(`
    INSERT INTO asset_categories (id, label, label_en, label_zh, description, sort_order, aliases_json, chat_enabled, reference_high_risk)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      label = excluded.label,
      label_en = excluded.label_en,
      label_zh = excluded.label_zh,
      description = excluded.description,
      sort_order = excluded.sort_order,
      aliases_json = excluded.aliases_json,
      chat_enabled = excluded.chat_enabled,
      reference_high_risk = excluded.reference_high_risk
  `)
  rows.forEach((row) => statement.run(row.id, row.label, row.labelEn || "", row.labelZh || "", row.description || "", row.sortOrder || 0, JSON.stringify(row.aliases || []), int(row.chatEnabled), int(row.referenceHighRisk)))
}

function upsertBrands(db, rows) {
  const statement = db.prepare(`
    INSERT INTO asset_brands (id, category_id, label, sort_order, active)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      category_id = excluded.category_id,
      label = excluded.label,
      sort_order = excluded.sort_order,
      active = excluded.active
  `)
  rows.forEach((row) => statement.run(row.id, row.categoryId, row.label, row.sortOrder || 0, int(row.active)))
}

function upsertAssets(db, rows) {
  const statement = db.prepare(`
    INSERT INTO part_assets
      (id, category_id, brand_id, brand, model, variant, keywords, color, finish, image_url, image_crop, active, sort_order, prompt_hint, default_color_policy, allowed_color_policies_json, prompt_test_status, generation_ready, bad_case_notes, recommended_views_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      category_id = excluded.category_id,
      brand_id = excluded.brand_id,
      brand = excluded.brand,
      model = excluded.model,
      variant = excluded.variant,
      keywords = excluded.keywords,
      color = excluded.color,
      finish = excluded.finish,
      image_url = excluded.image_url,
      image_crop = excluded.image_crop,
      active = excluded.active,
      sort_order = excluded.sort_order,
      prompt_hint = excluded.prompt_hint,
      default_color_policy = excluded.default_color_policy,
      allowed_color_policies_json = excluded.allowed_color_policies_json,
      prompt_test_status = excluded.prompt_test_status,
      generation_ready = excluded.generation_ready,
      bad_case_notes = excluded.bad_case_notes,
      recommended_views_json = excluded.recommended_views_json
  `)
  rows.forEach((row) => statement.run(
    row.id,
    row.categoryId,
    row.brandId || "",
    row.brand,
    row.model,
    row.variant || "",
    row.keywords || "",
    row.color || "",
    row.finish || "",
    row.imageUrl,
    row.imageCrop || "",
    int(row.active),
    row.sortOrder || 0,
    row.promptHint || "",
    row.defaultColorPolicy || "part_reference_color",
    JSON.stringify(row.allowedColorPolicies || []),
    row.promptTestStatus || "untested",
    int(row.generationReady),
    row.badCaseNotes || "",
    JSON.stringify(row.recommendedViews || []),
    row.createdAt || Date.now(),
  ))
}

function upsertReferences(db, rows) {
  const statement = db.prepare(`
    INSERT INTO part_asset_references (id, asset_id, url, role, view, priority, prompt_hint, upload_to_model, active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      asset_id = excluded.asset_id,
      url = excluded.url,
      role = excluded.role,
      view = excluded.view,
      priority = excluded.priority,
      prompt_hint = excluded.prompt_hint,
      upload_to_model = excluded.upload_to_model,
      active = excluded.active
  `)
  rows.forEach((row) => statement.run(row.id, row.assetId, row.url, row.role || "shape_reference", row.view || "product", row.priority || 10, row.promptHint || "", int(row.uploadToModel), int(row.active), row.createdAt || Date.now()))
}

function upsertGuardrails(db, rows) {
  const statement = db.prepare(`
    INSERT INTO guardrail_configs (id, sop, allowed_description, blocked_terms, recommended_prompts, mock_mode, mock_fail_uploads, provider, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      sop = excluded.sop,
      allowed_description = excluded.allowed_description,
      blocked_terms = excluded.blocked_terms,
      recommended_prompts = excluded.recommended_prompts,
      mock_mode = excluded.mock_mode,
      mock_fail_uploads = excluded.mock_fail_uploads,
      provider = excluded.provider,
      updated_at = excluded.updated_at
  `)
  rows.forEach((row) => statement.run(row.id, row.sop, row.allowedDescription, row.blockedTerms, row.recommendedPrompts || "", int(row.mockMode), int(row.mockFailUploads), row.provider || "mock", row.updatedAt || Date.now()))
}

function upsertMembershipPlans(db, rows) {
  const statement = db.prepare(`
    INSERT INTO membership_plans (id, label, price_cents, config_limit, chat_daily_limit, config_unlimited, chat_unlimited, chat_enabled, active, sort_order, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      label = excluded.label,
      price_cents = excluded.price_cents,
      config_limit = excluded.config_limit,
      chat_daily_limit = excluded.chat_daily_limit,
      config_unlimited = excluded.config_unlimited,
      chat_unlimited = excluded.chat_unlimited,
      chat_enabled = excluded.chat_enabled,
      active = excluded.active,
      sort_order = excluded.sort_order,
      updated_at = excluded.updated_at
  `)
  rows.forEach((row) => statement.run(row.id, row.label, row.priceCents || 0, row.configLimit || 0, row.chatDailyLimit || 0, int(row.configUnlimited), int(row.chatUnlimited), int(row.chatEnabled), int(row.active), row.sortOrder || 0, row.updatedAt || Date.now()))
}
