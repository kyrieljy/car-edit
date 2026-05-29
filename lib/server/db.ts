import { mkdirSync } from "node:fs"
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto"
import path from "node:path"
import { DatabaseSync } from "node:sqlite"
import { assetsSeed, brandsSeed, categoriesSeed, guardrailSeed, paintsSeed, promptSeed, promptTemplateSeed, providerSeed, workflowSeed } from "../catalog"
import { defaultAliasesForCategory, defaultChatEnabledForCategory, defaultReferenceHighRiskForCategory } from "../part-category-aliases"
import type {
  AdminSummary,
  AccountMessage,
  AccountMessageKind,
  AuditLog,
  AuthUser,
  CatalogResponse,
  ChatAttachment,
  ChatMessage,
  ChatSession,
  EntitlementStatus,
  GenerationBadCase,
  GenerationJob,
  GenerationMode,
  GenerationStandardJson,
  GuardrailConfig,
  GuardrailResult,
  MembershipPlan,
  MembershipPlanId,
  PartAsset,
  PartAssetReference,
  PartBrand,
  PartCategory,
  PartColorPolicy,
  PartPromptTestStatus,
  PartReferenceRole,
  PartSelectionOptions,
  PaymentOrder,
  PromptTemplate,
  PromptTemplateScope,
  PromptPreset,
  ProviderConfig,
  ProviderId,
  ResultCheckResult,
  SelectionMap,
  Subscription,
  WorkflowConfig,
  WorkflowMode,
} from "../types"

const DB_PATH = path.join(process.cwd(), "data", "car_mod_effect.sqlite")
const DEMO_USER_ID = "demo-user"
const systemCategoryIds = new Set(categoriesSeed.map((item) => item.id))
const systemBrandIds = new Set(brandsSeed.map((item) => item.id))
const systemAssetIds = new Set(assetsSeed.map((item) => item.id))
const systemPromptTemplateIds = new Set(promptTemplateSeed.map((item) => item.id))
const systemProviderIds = new Set(providerSeed.map((item) => item.id))
const systemWorkflowIds = new Set(workflowSeed.map((item) => item.id))

let db: DatabaseSync | null = null
let seeded = false

function database() {
  if (!db) {
    mkdirSync(path.dirname(DB_PATH), { recursive: true })
    db = new DatabaseSync(DB_PATH)
    db.exec("PRAGMA journal_mode = WAL;")
    initSchema(db)
  }
  if (!seeded) {
    seed(db)
    seeded = true
  }
  return db
}

function initSchema(conn: DatabaseSync) {
  conn.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL DEFAULT '',
      password_hash TEXT NOT NULL DEFAULT '',
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      role TEXT NOT NULL,
      plan TEXT NOT NULL DEFAULT 'prototype',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS asset_categories (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      label_en TEXT NOT NULL DEFAULT '',
      label_zh TEXT NOT NULL DEFAULT '',
      description TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      aliases_json TEXT NOT NULL DEFAULT '[]',
      chat_enabled INTEGER NOT NULL DEFAULT 1,
      reference_high_risk INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS asset_brands (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL,
      label TEXT NOT NULL,
      sort_order INTEGER NOT NULL,
      active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS part_assets (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL,
      brand_id TEXT NOT NULL DEFAULT '',
      brand TEXT NOT NULL,
      model TEXT NOT NULL,
      variant TEXT NOT NULL,
      keywords TEXT NOT NULL DEFAULT '',
      color TEXT NOT NULL,
      finish TEXT NOT NULL,
      image_url TEXT NOT NULL,
      image_crop TEXT,
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      prompt_hint TEXT NOT NULL,
      default_color_policy TEXT NOT NULL DEFAULT 'part_reference_color',
      allowed_color_policies_json TEXT NOT NULL DEFAULT '[]',
      prompt_test_status TEXT NOT NULL DEFAULT 'untested',
      generation_ready INTEGER NOT NULL DEFAULT 0,
      bad_case_notes TEXT NOT NULL DEFAULT '',
      recommended_views_json TEXT NOT NULL DEFAULT '[]',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS part_asset_references (
      id TEXT PRIMARY KEY,
      asset_id TEXT NOT NULL,
      url TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'shape_reference',
      view TEXT NOT NULL DEFAULT 'product',
      priority INTEGER NOT NULL DEFAULT 10,
      prompt_hint TEXT NOT NULL DEFAULT '',
      upload_to_model INTEGER NOT NULL DEFAULT 1,
      active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS prompt_presets (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      version TEXT NOT NULL,
      body TEXT NOT NULL,
      negative_prompt TEXT NOT NULL,
      active INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS provider_configs (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      base_url TEXT NOT NULL DEFAULT '',
      model_name TEXT NOT NULL,
      capabilities_json TEXT NOT NULL DEFAULT '["image_generation"]',
      enabled INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 0,
      api_key_cipher TEXT,
      api_key_masked TEXT,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS vehicle_uploads (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      file_name TEXT NOT NULL,
      url TEXT NOT NULL,
      mime TEXT NOT NULL,
      size INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS generation_jobs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      vehicle_upload_id TEXT NOT NULL,
      mode TEXT NOT NULL DEFAULT 'config',
      provider TEXT NOT NULL,
      paint_id TEXT NOT NULL,
      stance INTEGER NOT NULL,
      selections_json TEXT NOT NULL,
      selection_options_json TEXT NOT NULL DEFAULT '{}',
      standard_json TEXT NOT NULL DEFAULT '{}',
      workflow_id TEXT NOT NULL DEFAULT '',
      prompt_version TEXT NOT NULL DEFAULT '',
      prompt_summary TEXT NOT NULL,
      prompt_hidden TEXT NOT NULL,
      result_check_json TEXT NOT NULL DEFAULT '',
      retry_count INTEGER NOT NULL DEFAULT 0,
      failure_reason TEXT NOT NULL DEFAULT '',
      cost_cents INTEGER NOT NULL DEFAULT 0,
      bad_case_tags_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL,
      result_image_url TEXT NOT NULL,
      usage_units INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS usage_ledger (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      generation_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      usage_units INTEGER NOT NULL,
      cost_cents INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS garage_items (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      generation_id TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS guardrail_configs (
      id TEXT PRIMARY KEY,
      sop TEXT NOT NULL,
      allowed_description TEXT NOT NULL,
      blocked_terms TEXT NOT NULL,
      recommended_prompts TEXT NOT NULL DEFAULT '',
      mock_mode INTEGER NOT NULL DEFAULT 1,
      mock_fail_uploads INTEGER NOT NULL DEFAULT 0,
      provider TEXT NOT NULL DEFAULT 'mock',
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      pinned INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      result_image_url TEXT NOT NULL DEFAULT '',
      guardrail_status TEXT NOT NULL DEFAULT 'pending',
      guardrail_reason TEXT NOT NULL DEFAULT '',
      context_mode TEXT NOT NULL DEFAULT 'latest',
      standard_json TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_attachments (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      type TEXT NOT NULL,
      url TEXT NOT NULL,
      file_name TEXT NOT NULL,
      mime TEXT NOT NULL,
      size INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS user_identities (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      provider_user_id TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS verification_codes (
      id TEXT PRIMARY KEY,
      phone TEXT NOT NULL,
      purpose TEXT NOT NULL,
      code TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      consumed_at INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS membership_plans (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      price_cents INTEGER NOT NULL,
      config_limit INTEGER NOT NULL,
      chat_daily_limit INTEGER NOT NULL,
      config_unlimited INTEGER NOT NULL DEFAULT 0,
      chat_unlimited INTEGER NOT NULL DEFAULT 0,
      chat_enabled INTEGER NOT NULL DEFAULT 1,
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      status TEXT NOT NULL,
      current_period_end INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS entitlement_usage (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      mode TEXT NOT NULL,
      date_key TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quota_adjustments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      admin_user_id TEXT NOT NULL,
      mode TEXT NOT NULL,
      date_key TEXT NOT NULL,
      delta INTEGER NOT NULL,
      before_used INTEGER NOT NULL,
      after_used INTEGER NOT NULL,
      reason TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payment_orders (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      plan_id TEXT NOT NULL,
      method TEXT NOT NULL,
      status TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS account_messages (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      read_at INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      metadata TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS prompt_templates (
      id TEXT PRIMARY KEY,
      scope TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      asset_id TEXT NOT NULL DEFAULT '',
      combination_key TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      sort_order INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workflow_configs (
      id TEXT PRIMARY KEY,
      mode TEXT NOT NULL,
      title TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      vehicle_check_enabled INTEGER NOT NULL DEFAULT 1,
      part_check_enabled INTEGER NOT NULL DEFAULT 0,
      allow_follow_up INTEGER NOT NULL DEFAULT 0,
      prompt_template_ids_json TEXT NOT NULL DEFAULT '[]',
      provider_id TEXT NOT NULL DEFAULT 'mock',
      fallback_provider_id TEXT NOT NULL DEFAULT '',
      result_check_enabled INTEGER NOT NULL DEFAULT 1,
      auto_retry_enabled INTEGER NOT NULL DEFAULT 1,
      max_retries INTEGER NOT NULL DEFAULT 1,
      nodes_json TEXT NOT NULL DEFAULT '[]',
      edges_json TEXT NOT NULL DEFAULT '[]',
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS generation_bad_cases (
      id TEXT PRIMARY KEY,
      generation_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      mode TEXT NOT NULL,
      bad_case_type TEXT NOT NULL,
      summary TEXT NOT NULL,
      standard_json TEXT NOT NULL DEFAULT '{}',
      result_check_json TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL
    );
  `)
  conn.exec("CREATE UNIQUE INDEX IF NOT EXISTS entitlement_usage_unique ON entitlement_usage(user_id, mode, date_key);")
  conn.exec("CREATE INDEX IF NOT EXISTS account_messages_user_created_idx ON account_messages(user_id, created_at DESC);")
  conn.exec("CREATE INDEX IF NOT EXISTS quota_adjustments_user_created_idx ON quota_adjustments(user_id, created_at DESC);")
  migrateSchema(conn)
}

function migrateSchema(conn: DatabaseSync) {
  const userColumns = conn.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>
  if (!userColumns.some((column) => column.name === "username")) {
    conn.exec("ALTER TABLE users ADD COLUMN username TEXT NOT NULL DEFAULT ''")
  }
  if (!userColumns.some((column) => column.name === "phone")) {
    conn.exec("ALTER TABLE users ADD COLUMN phone TEXT NOT NULL DEFAULT ''")
  }
  if (!userColumns.some((column) => column.name === "password_hash")) {
    conn.exec("ALTER TABLE users ADD COLUMN password_hash TEXT NOT NULL DEFAULT ''")
  }
  const providerColumns = conn.prepare("PRAGMA table_info(provider_configs)").all() as Array<{ name: string }>
  if (!providerColumns.some((column) => column.name === "base_url")) {
    conn.exec("ALTER TABLE provider_configs ADD COLUMN base_url TEXT NOT NULL DEFAULT ''")
  }
  if (!providerColumns.some((column) => column.name === "active")) {
    conn.exec("ALTER TABLE provider_configs ADD COLUMN active INTEGER NOT NULL DEFAULT 0")
  }
  if (!providerColumns.some((column) => column.name === "capabilities_json")) {
    conn.exec("ALTER TABLE provider_configs ADD COLUMN capabilities_json TEXT NOT NULL DEFAULT '[\"image_generation\"]'")
  }
  const assetColumns = conn.prepare("PRAGMA table_info(part_assets)").all() as Array<{ name: string }>
  if (!assetColumns.some((column) => column.name === "brand_id")) {
    conn.exec("ALTER TABLE part_assets ADD COLUMN brand_id TEXT NOT NULL DEFAULT ''")
  }
  if (!assetColumns.some((column) => column.name === "keywords")) {
    conn.exec("ALTER TABLE part_assets ADD COLUMN keywords TEXT NOT NULL DEFAULT ''")
  }
  if (!assetColumns.some((column) => column.name === "sort_order")) {
    conn.exec("ALTER TABLE part_assets ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0")
    const rows = conn.prepare("SELECT id FROM part_assets ORDER BY category_id ASC, brand_id ASC, created_at ASC").all() as Array<{ id: string }>
    const statement = conn.prepare("UPDATE part_assets SET sort_order = ? WHERE id = ?")
    rows.forEach((row, index) => statement.run((index + 1) * 10, row.id))
  }
  if (!assetColumns.some((column) => column.name === "prompt_test_status")) {
    conn.exec("ALTER TABLE part_assets ADD COLUMN prompt_test_status TEXT NOT NULL DEFAULT 'untested'")
  }
  if (!assetColumns.some((column) => column.name === "generation_ready")) {
    conn.exec("ALTER TABLE part_assets ADD COLUMN generation_ready INTEGER NOT NULL DEFAULT 0")
  }
  if (!assetColumns.some((column) => column.name === "bad_case_notes")) {
    conn.exec("ALTER TABLE part_assets ADD COLUMN bad_case_notes TEXT NOT NULL DEFAULT ''")
  }
  if (!assetColumns.some((column) => column.name === "recommended_views_json")) {
    conn.exec("ALTER TABLE part_assets ADD COLUMN recommended_views_json TEXT NOT NULL DEFAULT '[]'")
  }
  if (!assetColumns.some((column) => column.name === "default_color_policy")) {
    conn.exec("ALTER TABLE part_assets ADD COLUMN default_color_policy TEXT NOT NULL DEFAULT 'part_reference_color'")
  }
  if (!assetColumns.some((column) => column.name === "allowed_color_policies_json")) {
    conn.exec("ALTER TABLE part_assets ADD COLUMN allowed_color_policies_json TEXT NOT NULL DEFAULT '[]'")
  }
  conn.exec(`
    CREATE TABLE IF NOT EXISTS part_asset_references (
      id TEXT PRIMARY KEY,
      asset_id TEXT NOT NULL,
      url TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'shape_reference',
      view TEXT NOT NULL DEFAULT 'product',
      priority INTEGER NOT NULL DEFAULT 10,
      prompt_hint TEXT NOT NULL DEFAULT '',
      upload_to_model INTEGER NOT NULL DEFAULT 1,
      active INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL
    );
  `)
  const categoryColumns = conn.prepare("PRAGMA table_info(asset_categories)").all() as Array<{ name: string }>
  const addedCategoryLabelEn = !categoryColumns.some((column) => column.name === "label_en")
  const addedCategoryLabelZh = !categoryColumns.some((column) => column.name === "label_zh")
  const addedCategoryAliases = !categoryColumns.some((column) => column.name === "aliases_json")
  const addedCategoryChatEnabled = !categoryColumns.some((column) => column.name === "chat_enabled")
  const addedCategoryReferenceHighRisk = !categoryColumns.some((column) => column.name === "reference_high_risk")
  if (addedCategoryLabelEn) {
    conn.exec("ALTER TABLE asset_categories ADD COLUMN label_en TEXT NOT NULL DEFAULT ''")
    conn.exec("UPDATE asset_categories SET label_en = label WHERE label_en = ''")
  }
  if (addedCategoryLabelZh) {
    conn.exec("ALTER TABLE asset_categories ADD COLUMN label_zh TEXT NOT NULL DEFAULT ''")
    conn.exec("UPDATE asset_categories SET label_zh = label WHERE label_zh = ''")
  }
  if (addedCategoryAliases) {
    conn.exec("ALTER TABLE asset_categories ADD COLUMN aliases_json TEXT NOT NULL DEFAULT '[]'")
  }
  if (addedCategoryChatEnabled) {
    conn.exec("ALTER TABLE asset_categories ADD COLUMN chat_enabled INTEGER NOT NULL DEFAULT 1")
  }
  if (addedCategoryReferenceHighRisk) {
    conn.exec("ALTER TABLE asset_categories ADD COLUMN reference_high_risk INTEGER NOT NULL DEFAULT 0")
  }
  if (addedCategoryAliases) {
    const updateAliases = conn.prepare("UPDATE asset_categories SET aliases_json = ? WHERE id = ? AND (aliases_json = '' OR aliases_json = '[]')")
    for (const category of categoriesSeed) updateAliases.run(JSON.stringify(category.aliases ?? defaultAliasesForCategory(category.id)), category.id)
  }
  if (addedCategoryChatEnabled) {
    const updateChatEnabled = conn.prepare("UPDATE asset_categories SET chat_enabled = ? WHERE id = ?")
    for (const category of categoriesSeed) updateChatEnabled.run((category.chatEnabled ?? defaultChatEnabledForCategory(category.id)) ? 1 : 0, category.id)
  }
  if (addedCategoryReferenceHighRisk) {
    const updateReferenceHighRisk = conn.prepare("UPDATE asset_categories SET reference_high_risk = ? WHERE id = ?")
    for (const category of categoriesSeed) updateReferenceHighRisk.run((category.referenceHighRisk ?? defaultReferenceHighRiskForCategory(category.id)) ? 1 : 0, category.id)
  }
  const guardrailColumns = conn.prepare("PRAGMA table_info(guardrail_configs)").all() as Array<{ name: string }>
  if (!guardrailColumns.some((column) => column.name === "recommended_prompts")) {
    conn.exec("ALTER TABLE guardrail_configs ADD COLUMN recommended_prompts TEXT NOT NULL DEFAULT ''")
  }
  const chatColumns = conn.prepare("PRAGMA table_info(chat_messages)").all() as Array<{ name: string }>
  if (!chatColumns.some((column) => column.name === "context_mode")) {
    conn.exec("ALTER TABLE chat_messages ADD COLUMN context_mode TEXT NOT NULL DEFAULT 'latest'")
  }
  if (!chatColumns.some((column) => column.name === "standard_json")) {
    conn.exec("ALTER TABLE chat_messages ADD COLUMN standard_json TEXT NOT NULL DEFAULT '{}'")
  }
  const generationColumns = conn.prepare("PRAGMA table_info(generation_jobs)").all() as Array<{ name: string }>
  const generationColumnDefaults: Array<[string, string]> = [
    ["mode", "TEXT NOT NULL DEFAULT 'config'"],
    ["selection_options_json", "TEXT NOT NULL DEFAULT '{}'"],
    ["standard_json", "TEXT NOT NULL DEFAULT '{}'"],
    ["workflow_id", "TEXT NOT NULL DEFAULT ''"],
    ["prompt_version", "TEXT NOT NULL DEFAULT ''"],
    ["result_check_json", "TEXT NOT NULL DEFAULT ''"],
    ["retry_count", "INTEGER NOT NULL DEFAULT 0"],
    ["failure_reason", "TEXT NOT NULL DEFAULT ''"],
    ["cost_cents", "INTEGER NOT NULL DEFAULT 0"],
    ["bad_case_tags_json", "TEXT NOT NULL DEFAULT '[]'"],
  ]
  generationColumnDefaults.forEach(([name, definition]) => {
    if (!generationColumns.some((column) => column.name === name)) {
      conn.exec(`ALTER TABLE generation_jobs ADD COLUMN ${name} ${definition}`)
    }
  })
  const workflowColumns = conn.prepare("PRAGMA table_info(workflow_configs)").all() as Array<{ name: string }>
  if (!workflowColumns.some((column) => column.name === "nodes_json")) {
    conn.exec("ALTER TABLE workflow_configs ADD COLUMN nodes_json TEXT NOT NULL DEFAULT '[]'")
  }
  if (!workflowColumns.some((column) => column.name === "edges_json")) {
    conn.exec("ALTER TABLE workflow_configs ADD COLUMN edges_json TEXT NOT NULL DEFAULT '[]'")
  }
}

function seed(conn: DatabaseSync) {
  const now = nowMs()
  conn.prepare("INSERT OR IGNORE INTO users (id, username, phone, password_hash, name, email, role, plan, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
    DEMO_USER_ID,
    "demo",
    "+8613800000000",
    passwordHash("Demo@1234"),
    "Demo User",
    "demo@local",
    "user",
    "free",
    now,
  )
  conn.prepare("INSERT OR IGNORE INTO users (id, username, phone, password_hash, name, email, role, plan, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)").run(
    "admin",
    "admin",
    "+8618928268686",
    passwordHash("Admin@1234"),
    "Admin",
    "admin@local",
    "admin",
    "internal",
    now,
  )
  conn.prepare("UPDATE users SET username = CASE WHEN username = '' THEN 'admin' ELSE username END, phone = CASE WHEN phone = '' THEN '+8618928268686' ELSE phone END, password_hash = CASE WHEN password_hash = '' THEN ? ELSE password_hash END WHERE id = 'admin'").run(passwordHash("Admin@1234"))
  conn.prepare("UPDATE users SET username = CASE WHEN username = '' THEN 'demo' ELSE username END, phone = CASE WHEN phone = '' THEN '+8613800000000' ELSE phone END, password_hash = CASE WHEN password_hash = '' THEN ? ELSE password_hash END, plan = CASE WHEN plan = 'prototype' THEN 'free' ELSE plan END WHERE id = ?").run(passwordHash("Demo@1234"), DEMO_USER_ID)

  seedMembershipPlans(conn, now)
  seedAccountMessages(conn, now)
  if (!shouldSeedLegacyStaticConfig()) return

  const categoryStatement = conn.prepare(`
    INSERT INTO asset_categories (id, label, label_en, label_zh, description, sort_order, aliases_json, chat_enabled, reference_high_risk) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      label = excluded.label,
      label_en = excluded.label_en,
      label_zh = excluded.label_zh,
      description = excluded.description
  `)
  for (const category of categoriesSeed) {
    categoryStatement.run(
      category.id,
      category.label,
      category.labelEn,
      category.labelZh,
      category.description,
      category.sortOrder,
      JSON.stringify(category.aliases ?? defaultAliasesForCategory(category.id)),
      (category.chatEnabled ?? defaultChatEnabledForCategory(category.id)) ? 1 : 0,
      (category.referenceHighRisk ?? defaultReferenceHighRiskForCategory(category.id)) ? 1 : 0,
    )
  }

  const brandStatement = conn.prepare(`
    INSERT INTO asset_brands (id, category_id, label, sort_order, active) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      category_id = excluded.category_id,
      label = excluded.label,
      active = excluded.active
  `)
  for (const brand of brandsSeed) {
    brandStatement.run(brand.id, brand.categoryId, brand.label, brand.sortOrder, brand.active ? 1 : 0)
  }

  const assetStatement = conn.prepare(`
    INSERT INTO part_assets
    (id, category_id, brand_id, brand, model, variant, keywords, color, finish, image_url, image_crop, active, sort_order, prompt_hint, default_color_policy, allowed_color_policies_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      category_id = CASE WHEN part_assets.category_id = '' THEN excluded.category_id ELSE part_assets.category_id END,
      brand_id = CASE WHEN part_assets.brand_id = '' THEN excluded.brand_id ELSE part_assets.brand_id END,
      brand = CASE WHEN part_assets.brand = '' THEN excluded.brand ELSE part_assets.brand END,
      model = CASE WHEN part_assets.model = '' THEN excluded.model ELSE part_assets.model END,
      variant = CASE WHEN part_assets.variant = '' THEN excluded.variant ELSE part_assets.variant END,
      keywords = CASE
        WHEN trim(part_assets.keywords) = '' THEN excluded.keywords
        WHEN part_assets.keywords = trim(part_assets.model || ' ' || part_assets.variant || ' ' || part_assets.id) THEN excluded.keywords
        ELSE part_assets.keywords
      END,
      color = CASE WHEN part_assets.color = '' THEN excluded.color ELSE part_assets.color END,
      finish = CASE WHEN part_assets.finish = '' THEN excluded.finish ELSE part_assets.finish END,
      image_url = CASE WHEN part_assets.image_url = '' THEN excluded.image_url ELSE part_assets.image_url END,
      image_crop = CASE WHEN COALESCE(part_assets.image_crop, '') = '' THEN excluded.image_crop ELSE part_assets.image_crop END,
      prompt_hint = excluded.prompt_hint,
      default_color_policy = excluded.default_color_policy,
      allowed_color_policies_json = excluded.allowed_color_policies_json
  `)
  const assetReferenceStatement = conn.prepare(`
    INSERT INTO part_asset_references
    (id, asset_id, url, role, view, priority, prompt_hint, upload_to_model, active, created_at)
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
  for (const asset of assetsSeed) {
    const defaultColorPolicy = normalizeColorPolicy(asset.defaultColorPolicy) ?? inferAssetDefaultColorPolicy(asset)
    const allowedColorPolicies = resolveAllowedColorPolicies(asset, defaultColorPolicy)
    assetStatement.run(
      asset.id,
      asset.categoryId,
      asset.brandId,
      asset.brand,
      asset.model,
      asset.variant,
      normalizeAssetKeywords(asset.keywords || defaultAssetKeywords(asset)),
      asset.color,
      asset.finish,
      asset.imageUrl,
      asset.imageCrop ?? "",
      asset.active ? 1 : 0,
      asset.sortOrder,
      asset.promptHint,
      defaultColorPolicy,
      JSON.stringify(allowedColorPolicies),
      now,
    )
    ;(asset.generationReferences ?? []).forEach((reference, index) => {
      assetReferenceStatement.run(
        reference.id || `${asset.id}-seed-ref-${index + 1}`,
        asset.id,
        reference.url,
        normalizeReferenceRole(reference.role),
        reference.view || "product",
        Number.isFinite(Number(reference.priority)) ? Number(reference.priority) : index + 1,
        reference.promptHint || "",
        reference.uploadToModel === false || reference.role === "avoid_upload" ? 0 : 1,
        reference.active === false ? 0 : 1,
        now,
      )
    })
  }

  conn.prepare(`
    INSERT INTO guardrail_configs
    (id, sop, allowed_description, blocked_terms, recommended_prompts, mock_mode, mock_fail_uploads, provider, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `).run(
    guardrailSeed.id,
    guardrailSeed.sop,
    guardrailSeed.allowedDescription,
    guardrailSeed.blockedTerms,
    guardrailSeed.recommendedPrompts,
    guardrailSeed.mockMode ? 1 : 0,
    guardrailSeed.mockFailUploads ? 1 : 0,
    guardrailSeed.provider,
    now,
  )
  seedWorkflows(conn, now)

  conn.prepare(`
    INSERT OR IGNORE INTO prompt_presets
    (id, title, version, body, negative_prompt, active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(promptSeed.id, promptSeed.title, promptSeed.version, promptSeed.body, promptSeed.negativePrompt, 1, now)
  seedPromptTemplatesV1(conn, now)

  const providerStatement = conn.prepare(`
    INSERT INTO provider_configs
    (id, label, base_url, model_name, capabilities_json, enabled, active, api_key_cipher, api_key_masked, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      label = CASE WHEN provider_configs.label = '' THEN excluded.label ELSE provider_configs.label END,
      base_url = CASE WHEN provider_configs.base_url = '' THEN excluded.base_url ELSE provider_configs.base_url END,
      model_name = CASE WHEN provider_configs.model_name = '' THEN excluded.model_name ELSE provider_configs.model_name END,
      capabilities_json = CASE WHEN provider_configs.capabilities_json = '' OR provider_configs.capabilities_json = '[]' THEN excluded.capabilities_json ELSE provider_configs.capabilities_json END
  `)
  for (const provider of providerSeed) {
    providerStatement.run(provider.id, provider.label, provider.baseUrl, provider.modelName, JSON.stringify(provider.capabilities), provider.enabled ? 1 : 0, provider.id === "mock" ? 1 : 0, "", "", now)
  }
  conn.prepare("UPDATE provider_configs SET active = 1 WHERE id = 'mock' AND NOT EXISTS (SELECT 1 FROM provider_configs WHERE active = 1)").run()
  const activeProviders = conn.prepare("SELECT id FROM provider_configs WHERE active = 1 ORDER BY updated_at DESC").all() as Row[]
  if (activeProviders.length > 1) {
    conn.prepare("UPDATE provider_configs SET active = CASE WHEN id = ? THEN 1 ELSE 0 END").run(String(activeProviders[0].id))
  }
}

function shouldSeedLegacyStaticConfig() {
  return process.env.CAR_MOD_LEGACY_STATIC_DB_SEED === "1"
}

function seedWorkflows(conn: DatabaseSync, now: number) {
  const statement = conn.prepare(`
    INSERT INTO workflow_configs
    (id, mode, title, enabled, vehicle_check_enabled, part_check_enabled, allow_follow_up, prompt_template_ids_json, provider_id, fallback_provider_id, result_check_enabled, auto_retry_enabled, max_retries, nodes_json, edges_json, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `)
  const refreshStatement = conn.prepare(`
    UPDATE workflow_configs
    SET nodes_json = CASE WHEN nodes_json = '[]' OR nodes_json = '' THEN ? ELSE nodes_json END,
        edges_json = CASE WHEN edges_json = '[]' OR edges_json = '' THEN ? ELSE edges_json END,
        title = CASE
          WHEN title IN ('Input recognition workflow', 'Configuration generation workflow') OR title LIKE '%Generation Workflow' THEN ?
          ELSE title
        END
    WHERE id = ?
  `)
  workflowSeed.forEach((workflow) => {
    const nodesJson = JSON.stringify(workflow.nodes)
    const edgesJson = JSON.stringify(workflow.edges)
    statement.run(
      workflow.id,
      workflow.mode,
      workflow.title,
      workflow.enabled ? 1 : 0,
      workflow.vehicleCheckEnabled ? 1 : 0,
      workflow.partCheckEnabled ? 1 : 0,
      workflow.allowFollowUp ? 1 : 0,
      JSON.stringify(workflow.promptTemplateIds),
      workflow.providerId,
      workflow.fallbackProviderId,
      workflow.resultCheckEnabled ? 1 : 0,
      workflow.autoRetryEnabled ? 1 : 0,
      workflow.maxRetries,
      nodesJson,
      edgesJson,
      now,
    )
    refreshStatement.run(nodesJson, edgesJson, workflow.title, workflow.id)
  })
}

function seedMembershipPlans(conn: DatabaseSync, now: number) {
  const statement = conn.prepare(`
    INSERT INTO membership_plans
    (id, label, price_cents, config_limit, chat_daily_limit, config_unlimited, chat_unlimited, chat_enabled, active, sort_order, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO NOTHING
  `)
  statement.run("free", "Free", 0, 5, 0, 0, 0, 0, 1, 10, now)
  statement.run("pro", "Pro", 2000, 0, 10, 1, 0, 1, 1, 20, now)
  statement.run("max", "Max", 20000, 0, 0, 1, 1, 1, 1, 30, now)
}

function seedAccountMessages(conn: DatabaseSync, now: number) {
  const users = conn.prepare("SELECT id FROM users").all() as Row[]
  const statement = conn.prepare(`
    INSERT OR IGNORE INTO account_messages (id, user_id, kind, title, body, metadata_json, read_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  for (const user of users) {
    const userId = String(user.id)
    statement.run(
      `${userId}-welcome-v1`,
      userId,
      "system",
      "欢迎使用 AI 改装助手",
      "这里会收纳站内信、充值状态、订阅成功、订阅失败和到期提醒。点击消息后才会标记为已读。",
      JSON.stringify({ source: "seed" }),
      0,
      now,
    )
  }
}

function seedPromptTemplatesV1(conn: DatabaseSync, now: number) {
  const statement = conn.prepare(`
    INSERT INTO prompt_templates
    (id, scope, title, body, asset_id, combination_key, active, sort_order, updated_at)
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

  promptTemplateSeed.forEach((template) => {
    statement.run(
      template.id,
      template.scope,
      template.title,
      template.body,
      template.assetId,
      template.combinationKey,
      template.active ? 1 : 0,
      template.sortOrder,
      now,
    )
  })

  assetsSeed.forEach((asset, index) => {
    statement.run(
      `tpl_part_${asset.id}`,
      "part",
      `${asset.brand} ${asset.model} ${asset.variant}`.trim(),
      asset.promptHint,
      asset.id,
      "",
      asset.active ? 1 : 0,
      (index + 1) * 10,
      now,
    )
  })

  guardrailSeed.recommendedPrompts
    .split(/\r?\n/)
    .map((prompt) => prompt.trim())
    .filter(Boolean)
    .forEach((prompt, index) => {
      statement.run(
        `tpl_chat_rec_${index + 1}`,
        "chat_recommendation",
        `Chat recommendation ${index + 1}`,
        prompt,
        "",
        "",
        1,
        (index + 1) * 10,
        now,
      )
    })
}

function seedGenerationPromptPack(statement: ReturnType<DatabaseSync["prepare"]>, now: number) {
  const prompts: Array<[string, PromptTemplateScope, string, string, string, string, number]> = [
    [
      "tpl_base_photo_edit",
      "base",
      "通用基础 Prompt - 保留原车与照片环境",
      "你是专业汽车改装效果图修图模型。请以用户上传的原车照片为唯一主体参考，生成真实照片级汽车改装效果图。必须保留：同一辆车、同一车型、同一车身比例、同一拍摄角度、同一镜头透视、同一背景、同一地面、同一光照方向、同一阴影、同一车窗、灯具、中网、车牌区域位置、车身钣金缝隙和原图真实噪点质感。只允许修改标准 JSON 和 Workflow 指定的改装项。不要把图片变成广告海报、概念图、3D 渲染图、插画或玩具模型。最终结果必须像真实摄影师在同一地点拍到的改装后照片。",
      "",
      "",
      5,
    ],
    [
      "tpl_config_base_default",
      "config_base",
      "配置模式基础 Prompt - 结构化输入",
      "当前任务来自配置模式。所有改装需求都已经由前台配置和标准 JSON 明确给出。请严格根据 JSON 中的 paint、stance、parts 执行，不要根据常见改装审美额外添加未选择内容。如果 parts 为空但 paint 或 stance 有变化，只执行颜色或车高调整；如果 paint 为保持原厂颜色，则不要改变车身颜色。",
      "",
      "",
      8,
    ],
    [
      "tpl_config_mode_default",
      "config_mode",
      "配置模式 Prompt - 严格执行后台配置",
      "本次生图以后台配置 JSON 为最高优先级。请严格执行 JSON 中的 paint、stance、parts 字段，并以已选资产的品牌、型号、颜色、材质、安装位置和参考图为准。资产库图片只作为配件外观参考，最终要把配件自然安装到用户上传的原车照片上。没有出现在 JSON parts 中的配件绝对不要出现；同一类别只执行当前选择的一个配件。不要根据常见改装审美额外添加未选择内容。",
      "",
      "",
      10,
    ],
    [
      "tpl_chat_mode_default",
      "chat_mode",
      "对话模式 Prompt - 使用用户上传参考图",
      "本次生图以用户上传的配件参考图和用户自然语言为最高优先级。若上传了配件参考图，请优先提取参考图中的造型、颜色、材质、比例和安装意图，不要求与后台资产库匹配。参考图只定义配件外观，不要把参考图的背景、文字、水印、人物、包装、展示台或无关物体带入结果。若用户描述与参考图冲突，以参考图可见外观为准；若没有参考图，则按用户文字中的明确改装需求执行。",
      "",
      "",
      10,
    ],
    [
      "tpl_category_wheels",
      "category",
      "分类 Prompt - 轮毂",
      "轮毂改装必须保持四个轮子圆形不变，不能椭圆、扭曲或断裂。轮毂中心必须对准原车轮心，大小要符合原车轮拱和轮胎比例，不能过大穿出翼子板。保留真实轮胎侧壁、刹车盘深度、轮辐透视、地面接触阴影和金属反光。参考轮毂的颜色、轮辐数量、轮唇层次和多片式结构要尽量准确。",
      "",
      "wheels",
      10,
    ],
    [
      "tpl_category_calipers",
      "category",
      "分类 Prompt - 刹车卡钳",
      "刹车卡钳必须位于轮辐后方并贴合刹车盘，不能漂浮在轮毂表面，也不能盖住轮毂主体造型。卡钳大小要符合车辆比例，受轮辐自然遮挡，颜色清晰但不过曝。保留刹车盘、轮毂深度、阴影和原图光照方向。",
      "",
      "calipers",
      20,
    ],
    [
      "tpl_category_rear_wing",
      "category",
      "分类 Prompt - 尾翼",
      "尾翼必须安装在车尾合理位置，贴合尾箱盖、掀背门或原厂扰流区域，支架数量、角度和落点要符合真实结构。不要悬空，不要穿透玻璃或车身。尾翼宽度不能夸张超过车身过多，碳纤维材质要有细腻纹理和真实反光。",
      "",
      "rear-wing",
      30,
    ],
    [
      "tpl_category_front_bumper",
      "category",
      "分类 Prompt - 前唇 / 前包围",
      "前唇和前包围改装必须沿着原车前保险杠下沿安装，保留原车大灯、中网、进气口和车头轮廓。前唇离地高度、投影阴影和碳纤维反光要真实，不能改变车头整体车型识别，也不能生成夸张赛车包围。",
      "",
      "front-bumper",
      40,
    ],
    [
      "tpl_category_side_skirts",
      "category",
      "分类 Prompt - 侧裙",
      "侧裙必须沿车身下侧门槛自然延伸，和前后轮拱衔接顺畅。保持车门缝隙、侧面反光和原图透视，不能让侧裙穿入地面、遮挡轮胎或改变车身长度。",
      "",
      "side-skirts",
      50,
    ],
    [
      "tpl_category_diffuser",
      "category",
      "分类 Prompt - 后扩散器",
      "后扩散器必须安装在后保险杠下方，鳍片方向、深度和阴影要符合原图透视。不能改变尾灯、后备箱、车牌区域和排气位置。扩散器应增强车尾层次，而不是重画整个车尾。",
      "",
      "diffuser",
      60,
    ],
    [
      "tpl_category_exhaust",
      "category",
      "分类 Prompt - 排气",
      "排气尾喉必须出现在车尾后包围合理开口位置，数量、左右对称、金属材质、内腔暗部和烧蓝/钛色反光要真实。不要改变整个后包围结构，不要让尾喉悬空或穿出车身。",
      "",
      "exhaust",
      70,
    ],
    [
      "tpl_category_hood",
      "category",
      "分类 Prompt - 机盖",
      "机盖改装必须保留原车机盖边缘、钣金缝隙、雨刷和前挡风玻璃关系。碳纤维机盖或散热孔只能出现在机盖表面，不能改变车头车型结构。机盖反光、纹理和阴影要跟原图光照一致。",
      "",
      "hood",
      80,
    ],
    [
      "tpl_category_lights",
      "category",
      "分类 Prompt - 灯膜 / 灯具处理",
      "灯膜或灯具处理只能改变灯罩色调和透明度，不得改变大灯/尾灯形状、内部灯组结构和位置。烟熏效果要保留灯具玻璃反光和边缘高光，不能把灯完全涂黑或生成错误灯型。",
      "",
      "lights",
      90,
    ],
    [
      "tpl_category_wrap",
      "category",
      "分类 Prompt - 改色 / 贴膜",
      "车身改色或贴膜只能作用于车身漆面板件，不能改变玻璃、轮胎、灯具、牌照区域、进气格栅、碳纤维件和黑色塑料饰条。必须保留原图高光、阴影、反射、车身折线和环境色温。不要改变背景和车身结构。",
      "",
      "wrap",
      100,
    ],
    [
      "tpl_category_mirrors",
      "category",
      "分类 Prompt - 后视镜",
      "后视镜改装只修改后视镜外壳或镜盖材质，必须保留原后视镜形状、角度、镜片位置、边缘缝隙和车门连接结构。碳纤维纹理要细腻，不能让后视镜变形或消失。",
      "",
      "mirrors",
      110,
    ],
    [
      "tpl_category_grille",
      "category",
      "分类 Prompt - 中网 / 格栅",
      "中网或格栅改装必须保留原车前脸比例、大灯位置、保险杠轮廓和品牌车型识别。只调整格栅内部样式、颜色或材质，不得重画整个车头，不得改变车标位置和进气口透视。",
      "",
      "grille",
      120,
    ],
    [
      "tpl_vehicle_recognition_default",
      "vehicle_recognition",
      "车辆识别 Prompt - 输入检测",
      "你是汽车车型识别助手。请判断用户上传图片是否为真实车辆照片，并返回严格 JSON。如果是车辆，必须给出一个确定、具体、规范化的最佳车型猜测，不要使用“可能是 / 疑似 / maybe / probably / looks like”等不确定话术。model 字段必须尽量包含品牌、车系/车型、车身形式和代号/世代；格式示例：BMW M4 coupe (F82)、Porsche 911 GT3 (992)、Toyota GR Supra coupe (A90)。不要只返回品牌或单个车系代号，例如不要只写 BMW、M4、911；如果画面信息不足但仍是车辆，也要填写最具体的 best guess，并用 confidence 表示不确定性。只有在完全无法判断为车辆或车辆主体不可识别时，model 才写 unknown，并给出 rejectReason。返回字段：isVehicle、model、make、series、generation、bodyStyle、view、confidence、qualityFlags、rejectReason。只返回 JSON，不要 Markdown。",
      "",
      "",
      5,
    ],
    [
      "tpl_part_recognition_default",
      "part_recognition",
      "配件识别 Prompt - 参考图检测",
      "请检查用户上传的配件参考图，判断它最可能属于哪类汽车改装件：轮毂、刹车卡钳、尾翼、前唇/前包围、侧裙、扩散器、排气、机盖、灯膜、贴膜/颜色、后视镜、中网。输出结构化结果，包含 category、confidence、visualFeatures、usableAsReference、rejectReason。不确定时标记 unknown，禁止编造品牌或型号。",
      "",
      "",
      6,
    ],
    [
      "tpl_chat_parser_default",
      "chat_parser",
      "对话解析 Prompt - 自然语言转标准 JSON",
      "请把用户的自然语言改装需求解析成稳定标准 JSON。必须提取：车辆信息、是否改色、目标颜色、车身高度/姿态、配件类别、配件来源、参考图对应关系、风格关键词、必须保留的约束。如果缺少关键字段，返回 needs_followup，并只问一个最关键的追问；不要直接调用生图，不要扣生图额度。用户原文不能直接作为生图 Prompt，必须先结构化。非汽车改装需求返回 rejected。",
      "",
      "",
      7,
    ],
    [
      "tpl_result_check_default",
      "result_check",
      "结果检查 Prompt - 质量验收",
      "请对比原车图、标准 JSON、最终生成图，判断生成结果是否合格。检查项：是否仍是同一辆车、背景是否被改变、拍摄角度是否被改变、光照和阴影是否一致、车身是否变形、轮毂是否圆且位置正确、所需配件是否全部出现、颜色是否正确、材质是否合理、是否有水印/文字/人物/杂物、是否有明显 AI 伪影。输出 passed、score、missingElements、wrongElements、badCaseTags、summary、retryPrompt。不合格时 retryPrompt 只描述需要修复的失败点。",
      "",
      "",
      10,
    ],
    [
      "tpl_retry_default",
      "retry",
      "修复重试 Prompt - 只修失败点",
      "这是一次修复重试，不是重新设计。请只修复结果检查中指出的失败点：缺失配件、颜色错误、轮毂变形、卡钳位置错误、背景变化、角度变化、车身扭曲、水印文字等。已经正确的内容必须保持不变。必须恢复原车身份、原背景、原拍摄角度、原光照和真实照片质感。不要新增未选择配件，不要改变用户没有要求修改的区域。",
      "",
      "",
      10,
    ],
  ]
  prompts.forEach(([id, scope, title, body, assetId, combinationKey, sortOrder]) => {
    statement.run(id, scope, title, body, assetId, combinationKey, 1, sortOrder, now)
  })
}

function seedPromptTemplates(conn: DatabaseSync, now: number) {
  const statement = conn.prepare(`
    INSERT OR IGNORE INTO prompt_templates
    (id, scope, title, body, asset_id, combination_key, active, sort_order, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  statement.run(
    "tpl_config_base_default",
    "config_base",
    "配置模式基础 Prompt - 结构化输入",
    "当前任务来自配置模式。所有改装需求都已经由前台配置和标准 JSON 明确给出。请严格根据 JSON 中的 paint、stance、parts 执行，不要根据常见改装审美额外添加未选择内容。如果 parts 为空但 paint 或 stance 有变化，只执行颜色或车高调整；如果 paint 为保持原厂颜色，则不要改变车身颜色。",
    "",
    "",
    1,
    10,
    now,
  )
  seedGenerationPromptPack(statement, now)
  statement.run(
    "tpl_negative_default",
    "negative",
    "默认 Negative Prompt",
    promptSeed.negativePrompt,
    "",
    "",
    1,
    10,
    now,
  )
  statement.run(
    "tpl_combo_wheel_stance",
    "combo",
    "组合 Prompt - 轮毂 + 降低车高",
    "当轮毂和降低车身同时出现时，优先保证轮毂圆形、轮胎侧壁完整、轮拱几何不变。降低车高只能减少轮胎与轮拱间隙，不能让轮胎穿进翼子板，不能压扁轮胎，不能让地面接触阴影消失。姿态应真实自然，接近齐平 fitment。",
    "",
    "wheels,stance_lowered",
    1,
    20,
    now,
  )
  statement.run(
    "tpl_combo_wheel_caliper",
    "combo",
    "组合 Prompt - 轮毂 + 卡钳",
    "当轮毂和卡钳同时出现时，先保持轮毂设计准确，再把卡钳放在轮辐后方。卡钳不能盖住轮毂中心盖和轮辐主体，必须贴合刹车盘，存在真实遮挡和深度。轮毂、卡钳、刹车盘三者必须共享同一透视。",
    "",
    "wheels,calipers",
    1,
    30,
    now,
  )
  statement.run(
    "tpl_combo_paint_carbon",
    "combo",
    "组合 Prompt - 改色 + 碳纤维件",
    "当车身改色和碳纤维件同时出现时，车身漆面和碳纤维材质必须分层清晰。改色只作用于金属车身板件，不要把碳纤维前唇、尾翼、后视镜、扩散器或黑色饰条一起改成车身颜色。碳纤维纹理要细腻，反光方向与原图一致。",
    "",
    "paint_change,carbon_parts",
    1,
    40,
    now,
  )
  statement.run(
    "tpl_combo_aero_parts",
    "combo",
    "组合 Prompt - 多个空气动力学套件",
    "当前唇、侧裙、尾翼、扩散器等多个空气动力学套件同时出现时，要保持整体风格统一但不过度夸张。所有套件必须贴合原车边缘，不能悬空、穿模或改变车型。保留车身原有线条、钣金缝隙和真实阴影。",
    "",
    "front-bumper,carbon_parts",
    1,
    50,
    now,
  )
  statement.run(
    "tpl_combo_uploaded_reference",
    "combo",
    "组合 Prompt - 用户上传参考图",
    "当配件来源是用户上传参考图时，参考图只用于配件外观，不用于改变整张照片的背景、构图、光线或车辆身份。请把参考图中的关键外观特征迁移到原车对应位置，并按原车照片的角度、比例、遮挡和光照重新融合。",
    "",
    "uploaded_reference",
    1,
    60,
    now,
  )
  statement.run(
    "tpl_chat_optimizer_default",
    "chat_optimizer",
    "对话模式用户输入优化 Prompt",
    "请把用户自然语言需求整理为简洁、明确、只围绕汽车改装的说明。保留用户真正想改的部位、颜色、材质和风格，去掉无关闲聊。不得把用户原文直接塞给生图模型；如果需求不是汽车改装，或缺少关键改装部位，请返回追问。",
    "",
    "",
    1,
    10,
    now,
  )

  assetsSeed.forEach((asset, index) => {
    statement.run(
      `tpl_part_${asset.id}`,
      "part",
      `${asset.brand} ${asset.model} ${asset.variant}`,
      asset.promptHint,
      asset.id,
      "",
      asset.active ? 1 : 0,
      (index + 1) * 10,
      now,
    )
  })

  guardrailSeed.recommendedPrompts
    .split(/\r?\n/)
    .map((prompt) => prompt.trim())
    .filter(Boolean)
    .forEach((prompt, index) => {
      statement.run(
        `tpl_chat_rec_${index + 1}`,
        "chat_recommendation",
        `推荐提示词 ${index + 1}`,
        prompt,
        "",
        "",
        1,
        (index + 1) * 10,
        now,
      )
    })
}

const referenceRoles: PartReferenceRole[] = ["shape_reference", "material_reference", "color_reference", "install_context", "full_part_reference", "avoid_upload"]
const promptTestStatuses: PartPromptTestStatus[] = ["untested", "pass", "weak", "fail"]
const colorPolicies: PartColorPolicy[] = ["body_color", "exposed_carbon", "part_reference_color"]
const carbonPattern = /carbon|dry carbon|wet carbon|forged carbon|碳纤|碳纖|碳纹|碳紋|碳盖|碳蓋|裸碳|露碳/i

function normalizeReferenceRole(value: unknown): PartReferenceRole {
  return referenceRoles.includes(value as PartReferenceRole) ? (value as PartReferenceRole) : "shape_reference"
}

function normalizePromptTestStatus(value: unknown): PartPromptTestStatus {
  return promptTestStatuses.includes(value as PartPromptTestStatus) ? (value as PartPromptTestStatus) : "untested"
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean)
  if (typeof value === "string") {
    return value
      .split(/[\n,，、;；]/)
      .map((item) => item.trim())
      .filter(Boolean)
  }
  return []
}

function normalizeAssetKeywords(value: unknown) {
  return Array.from(new Set(normalizeStringArray(value).map((item) => item.replace(/\s+/g, " ").trim()).filter(Boolean))).join(", ")
}

function defaultAssetKeywords(asset: Pick<PartAsset, "id" | "brand" | "model" | "variant">) {
  return normalizeAssetKeywords([asset.model, asset.variant, asset.id].filter(Boolean))
}

function normalizeColorPolicy(value: unknown): PartColorPolicy | undefined {
  return colorPolicies.includes(value as PartColorPolicy) ? (value as PartColorPolicy) : undefined
}

function normalizeColorPolicies(value: unknown): PartColorPolicy[] {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.map(normalizeColorPolicy).filter((item): item is PartColorPolicy => Boolean(item))))
}

function resolveAllowedColorPolicies(
  asset: Pick<PartAsset, "categoryId" | "brand" | "model" | "variant" | "color" | "finish" | "promptHint"> & {
    keywords?: string
    allowedColorPolicies?: PartColorPolicy[]
  },
  defaultColorPolicy: PartColorPolicy,
) {
  const normalized = normalizeColorPolicies(asset.allowedColorPolicies)
  if (isPartColorPolicyChoiceCategory(asset.categoryId) && (assetMentionsCarbon(asset) || normalized.includes("exposed_carbon"))) {
    return ["body_color", "exposed_carbon"] satisfies PartColorPolicy[]
  }
  if (normalized.length) return normalized
  return [defaultColorPolicy]
}

function inferAssetDefaultColorPolicy(asset: Pick<PartAsset, "categoryId" | "brand" | "model" | "variant" | "color" | "finish" | "promptHint"> & { keywords?: string }): PartColorPolicy {
  if (isPartColorPolicyChoiceCategory(asset.categoryId) && assetMentionsCarbon(asset)) return "body_color"
  return "part_reference_color"
}

function isPartColorPolicyChoiceCategory(categoryId: string) {
  return categoryId === "hood" || categoryId === "mirrors"
}

function assetMentionsCarbon(asset: Pick<PartAsset, "brand" | "model" | "variant" | "color" | "finish" | "promptHint"> & { keywords?: string }) {
  return carbonPattern.test([asset.brand, asset.model, asset.variant, asset.keywords, asset.color, asset.finish, asset.promptHint].join(" "))
}

function replaceAssetReferences(assetId: string, references: AssetReferenceInput[]) {
  const db = database()
  db.prepare("DELETE FROM part_asset_references WHERE asset_id = ?").run(assetId)
  const insert = db.prepare(`
    INSERT INTO part_asset_references
    (id, asset_id, url, role, view, priority, prompt_hint, upload_to_model, active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  references
    .map((reference, index) => ({
      id: String(reference.id || `${assetId}-ref-${index + 1}-${randomUUID().slice(0, 8)}`),
      url: String(reference.url || "").trim(),
      role: normalizeReferenceRole(reference.role),
      view: String(reference.view || "product").trim() || "product",
      priority: Number.isFinite(Number(reference.priority)) ? Number(reference.priority) : (index + 1) * 10,
      promptHint: String(reference.promptHint || "").trim(),
      uploadToModel: reference.uploadToModel !== false && reference.role !== "avoid_upload",
      active: reference.active !== false,
    }))
    .filter((reference) => reference.url)
    .forEach((reference) => {
      insert.run(
        reference.id,
        assetId,
        reference.url,
        reference.role,
        reference.view,
        reference.priority,
        reference.promptHint,
        reference.uploadToModel ? 1 : 0,
        reference.active ? 1 : 0,
        nowMs(),
      )
    })
}

export function getCatalog(): CatalogResponse {
  return {
    categories: categories(),
    brands: brands().filter((brand) => brand.active),
    assets: assets().filter((asset) => asset.active),
    paints: paintsSeed,
    providers: providers(),
    promptPreset: activePrompt(),
    promptTemplates: promptTemplates(),
  }
}

export function getUserById(userId: string): AuthUser | null {
  const row = database().prepare("SELECT * FROM users WHERE id = ?").get(userId) as Row | undefined
  return row ? mapAuthUser(row) : null
}

export function getUserBySessionToken(token: string): AuthUser | null {
  if (!token) return null
  const tokenHash = hashValue(token)
  const row = database()
    .prepare(`
      SELECT users.*
      FROM sessions
      JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = ? AND sessions.expires_at > ?
      LIMIT 1
    `)
    .get(tokenHash, nowMs()) as Row | undefined
  return row ? mapAuthUser(row) : null
}

export function updateUserProfile(userId: string, input: { name: string; email: string }) {
  const current = getUserById(userId)
  if (!current) throw new Error("User not found.")
  const name = input.name.trim() || current.username || current.id
  const email = input.email.trim()
  if (email && !/^[^\s@]+@[^\s@]+$/.test(email)) throw new Error("Invalid email address.")
  database().prepare("UPDATE users SET name = ?, email = ? WHERE id = ?").run(name, email, userId)
  writeAudit(userId, "auth.profile.update", { name, emailUpdated: email !== current.email })
  return getUserById(userId) as AuthUser
}

export function changeUserPassword(userId: string, input: { currentPassword: string; nextPassword: string }) {
  const row = database().prepare("SELECT * FROM users WHERE id = ? LIMIT 1").get(userId) as Row | undefined
  if (!row) throw new Error("User not found.")
  if (!verifyPassword(input.currentPassword, String(row.password_hash || ""))) {
    throw new Error("Current password is incorrect.")
  }
  assertStrongPassword(input.nextPassword)
  database().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash(input.nextPassword), userId)
  writeAudit(userId, "auth.password.change", {})
  return getUserById(userId) as AuthUser
}

export function changeUserPhone(input: { userId: string; phone: string; code: string }) {
  const current = getUserById(input.userId)
  if (!current) throw new Error("User not found.")
  const phone = normalizePhone(input.phone)
  if (!phone) throw new Error("Phone is required.")
  consumeVerificationCode({ phone, purpose: "change_phone", code: input.code })
  const duplicate = database().prepare("SELECT id FROM users WHERE phone = ? AND id <> ? LIMIT 1").get(phone, input.userId) as Row | undefined
  if (duplicate) throw new Error("Phone number is already registered.")
  database().prepare("UPDATE users SET phone = ? WHERE id = ?").run(phone, input.userId)
  writeAudit(input.userId, "auth.phone.change", { phone })
  return getUserById(input.userId) as AuthUser
}

export function createSessionToken(userId: string) {
  const token = randomBytes(32).toString("hex")
  const now = nowMs()
  database()
    .prepare("INSERT INTO sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(`sess_${crypto.randomUUID().slice(0, 8)}`, userId, hashValue(token), now + 1000 * 60 * 60 * 24 * 30, now)
  writeAudit(userId, "auth.session.created", {})
  return token
}

export function deleteSessionToken(token: string) {
  if (!token) return
  database().prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashValue(token))
}

export function createVerificationCode(input: { phone: string; purpose: string }) {
  const phone = normalizePhone(input.phone)
  const code = "123456"
  const now = nowMs()
  database()
    .prepare("INSERT INTO verification_codes (id, phone, purpose, code, expires_at, consumed_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(`vc_${crypto.randomUUID().slice(0, 8)}`, phone, input.purpose, code, now + 1000 * 60 * 10, 0, now)
  writeAudit("", "auth.code.sent", { phone, purpose: input.purpose, mock: true })
  return { phone, code, expiresAt: now + 1000 * 60 * 10 }
}

export function registerUser(input: { username: string; phone: string; password: string; code: string }) {
  const username = input.username.trim()
  const phone = normalizePhone(input.phone)
  assertStrongPassword(input.password)
  consumeVerificationCode({ phone, purpose: "register", code: input.code })
  ensureUniqueUser(username, phone)
  const now = nowMs()
  const userId = `user_${crypto.randomUUID().slice(0, 8)}`
  database()
    .prepare("INSERT INTO users (id, username, phone, password_hash, name, email, role, plan, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(userId, username, phone, passwordHash(input.password), username, `${username}@local`, "user", "free", now)
  createAccountMessage({
    id: `${userId}-welcome-v1`,
    userId,
    kind: "system",
    title: "欢迎使用 AI 改装助手",
    body: "这里会收纳站内信、充值状态、订阅成功、订阅失败和到期提醒。点击消息后才会标记为已读。",
    metadata: { source: "register" },
    createdAt: now,
  })
  writeAudit(userId, "auth.register", { username, phone })
  return getUserById(userId) as AuthUser
}

export function loginWithPassword(input: { identifier: string; password: string }) {
  const identifier = input.identifier.trim()
  const row = database()
    .prepare("SELECT * FROM users WHERE lower(username) = lower(?) OR phone = ? LIMIT 1")
    .get(identifier, normalizePhone(identifier)) as Row | undefined
  if (!row || !verifyPassword(input.password, String(row.password_hash || ""))) {
    throw new Error("账号或密码错误。")
  }
  const user = mapAuthUser(row)
  writeAudit(user.id, "auth.login.password", { identifier })
  return user
}

export function loginWithPhoneCode(input: { phone: string; code: string; purpose?: string }) {
  const phone = normalizePhone(input.phone)
  consumeVerificationCode({ phone, purpose: input.purpose || "login", code: input.code })
  const row = database().prepare("SELECT * FROM users WHERE phone = ? LIMIT 1").get(phone) as Row | undefined
  if (!row) throw new Error("手机号未注册。")
  const user = mapAuthUser(row)
  writeAudit(user.id, "auth.login.code", { phone })
  return user
}

export function loginOrBindMockWechat(input: { openId: string; phone?: string; code?: string }) {
  const openId = input.openId.trim() || `mock_wechat_${crypto.randomUUID().slice(0, 8)}`
  const identity = database()
    .prepare("SELECT users.* FROM user_identities JOIN users ON users.id = user_identities.user_id WHERE provider = 'wechat' AND provider_user_id = ? LIMIT 1")
    .get(openId) as Row | undefined
  if (identity) return { user: mapAuthUser(identity), requiresBinding: false, openId }
  if (!input.phone || !input.code) return { user: null, requiresBinding: true, openId }
  const user = loginWithPhoneCode({ phone: input.phone, code: input.code, purpose: "wechat" })
  database()
    .prepare("INSERT INTO user_identities (id, user_id, provider, provider_user_id, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(`ident_${crypto.randomUUID().slice(0, 8)}`, user.id, "wechat", openId, nowMs())
  writeAudit(user.id, "auth.wechat.bind", { openId })
  return { user, requiresBinding: false, openId }
}

export function registerAndBindMockWechat(input: { openId: string; username: string; phone: string; password: string; code: string }) {
  const openId = input.openId.trim() || `mock_wechat_${crypto.randomUUID().slice(0, 8)}`
  const existing = database()
    .prepare("SELECT users.* FROM user_identities JOIN users ON users.id = user_identities.user_id WHERE provider = 'wechat' AND provider_user_id = ? LIMIT 1")
    .get(openId) as Row | undefined
  if (existing) return { user: mapAuthUser(existing), requiresBinding: false, openId }
  const user = registerUser({ username: input.username, phone: input.phone, password: input.password, code: input.code })
  database()
    .prepare("INSERT INTO user_identities (id, user_id, provider, provider_user_id, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(`ident_${crypto.randomUUID().slice(0, 8)}`, user.id, "wechat", openId, nowMs())
  writeAudit(user.id, "auth.wechat.register_bind", { openId })
  return { user, requiresBinding: false, openId }
}

export function getMembershipPlans() {
  return membershipPlans()
}

export function updateMembershipPlan(input: Partial<MembershipPlan> & { id: MembershipPlanId }) {
  const current = membershipPlans().find((plan) => plan.id === input.id)
  if (!current) throw new Error(`Plan not found: ${input.id}`)
  const next = { ...current, ...input, updatedAt: nowMs() }
  next.label = next.label.trim()
  next.priceCents = Math.max(0, Math.round(Number(next.priceCents) || 0))
  next.configLimit = Math.max(0, Math.round(Number(next.configLimit) || 0))
  next.chatDailyLimit = Math.max(0, Math.round(Number(next.chatDailyLimit) || 0))

  if (!next.label) throw new Error("请填写套餐名称")
  if (next.configUnlimited) {
    next.configLimit = 0
  } else if (next.configLimit <= 0) {
    throw new Error("配置模式未设置不限时，请填写大于 0 的配置生成次数")
  }

  if (!next.chatEnabled) {
    next.chatUnlimited = false
    next.chatDailyLimit = 0
  } else if (next.chatUnlimited) {
    next.chatDailyLimit = 0
  } else if (next.chatDailyLimit <= 0) {
    throw new Error("已开放对话模式且未设置不限时，请填写大于 0 的每日对话次数")
  }

  database()
    .prepare(`
      UPDATE membership_plans
      SET label = ?, price_cents = ?, config_limit = ?, chat_daily_limit = ?, config_unlimited = ?, chat_unlimited = ?, chat_enabled = ?, active = ?, sort_order = ?, updated_at = ?
      WHERE id = ?
    `)
    .run(
      next.label,
      next.priceCents,
      next.configLimit,
      next.chatDailyLimit,
      next.configUnlimited ? 1 : 0,
      next.chatUnlimited ? 1 : 0,
      next.chatEnabled ? 1 : 0,
      next.active ? 1 : 0,
      next.sortOrder,
      next.updatedAt,
      next.id,
    )
  return membershipPlans().find((plan) => plan.id === input.id) as MembershipPlan
}

export function getBillingStatus(userId: string): EntitlementStatus {
  const user = getUserById(userId)
  const planId = (user?.plan === "pro" || user?.plan === "max" ? user.plan : "free") as MembershipPlanId
  syncExpiredSubscriptions(userId)
  const activeSub = activeSubscription(userId)
  const plan = membershipPlans().find((item) => item.id === (activeSub?.planId || planId)) || membershipPlans()[0]
  const configUsed = usageFor(userId, "config", "lifetime")
  const chatDateKey = todayKey()
  const chatUsedToday = usageFor(userId, "chat", chatDateKey)
  const configAdjustment = quotaAdjustmentTotal(userId, "config", "lifetime")
  const chatAdjustment = quotaAdjustmentTotal(userId, "chat", chatDateKey)
  return {
    plan,
    subscription: activeSub,
    configUsed,
    chatUsedToday,
    configRemaining: plan.configUnlimited ? "unlimited" : Math.max(0, plan.configLimit + configAdjustment - configUsed),
    chatRemainingToday: plan.chatUnlimited ? "unlimited" : Math.max(0, plan.chatDailyLimit + chatAdjustment - chatUsedToday),
    chatEnabled: plan.chatEnabled,
  }
}

function syncExpiredSubscriptions(userId: string) {
  const now = nowMs()
  const rows = database()
    .prepare("SELECT * FROM subscriptions WHERE user_id = ? AND status = 'active' AND current_period_end <= ?")
    .all(userId, now) as Row[]
  if (!rows.length) return

  const update = database().prepare("UPDATE subscriptions SET status = 'expired', updated_at = ? WHERE id = ?")
  for (const row of rows) {
    const subscription = mapSubscription(row)
    update.run(now, subscription.id)
    createAccountMessage({
      id: `sub-expired-${subscription.id}`,
      userId,
      kind: "subscription",
      title: "订阅已过期",
      body: `${subscription.planId.toUpperCase()} 会员已到期，如需继续使用会员权益，请重新订阅。`,
      metadata: { subscriptionId: subscription.id, planId: subscription.planId },
      createdAt: now,
    })
  }
}

export function checkAndConsumeEntitlement(userId: string, mode: "config" | "chat") {
  const status = getBillingStatus(userId)
  if (mode === "chat" && !status.chatEnabled) {
    return { allowed: false, reason: "当前会员不支持对话模式，请升级会员。", status }
  }
  if (mode === "config" && status.configRemaining !== "unlimited" && status.configRemaining <= 0) {
    return { allowed: false, reason: "免费配置模式次数已用完，请升级 Pro 或 Max。", status }
  }
  if (mode === "chat" && status.chatRemainingToday !== "unlimited" && status.chatRemainingToday <= 0) {
    return { allowed: false, reason: "今日对话模式次数已用完，请升级 Max 或明天再试。", status }
  }
  incrementUsage(userId, mode, mode === "config" ? "lifetime" : todayKey())
  return { allowed: true, status: getBillingStatus(userId) }
}

export function refundEntitlementUsage(userId: string, mode: "config" | "chat") {
  decrementUsage(userId, mode, mode === "config" ? "lifetime" : todayKey())
  return getBillingStatus(userId)
}

export function adjustUserQuota(
  adminUserId: string,
  input: {
    userId: string
    mode: "config" | "chat"
    delta: number
    reason: string
    dateKey?: string
  },
) {
  const userId = String(input.userId || "").trim()
  const targetUser = getUserById(userId)
  if (!targetUser) throw new Error("User not found.")
  const mode = input.mode === "chat" ? "chat" : "config"
  const delta = Math.trunc(Number(input.delta))
  if (!Number.isFinite(delta) || delta === 0) throw new Error("Quota delta must be a non-zero integer.")
  const reason = String(input.reason || "").trim()
  if (!reason) throw new Error("Adjustment reason is required.")
  const dateKey = mode === "config" ? "lifetime" : String(input.dateKey || todayKey()).trim()
  const beforeBilling = getBillingStatus(userId)
  const beforeRemaining = quotaRemainingValue(beforeBilling, mode)
  const afterRemaining = beforeRemaining < 0 ? -1 : Math.max(0, beforeRemaining + delta)
  const id = `quota_${randomUUID().slice(0, 10)}`
  const now = nowMs()

  database()
    .prepare(`
      INSERT INTO quota_adjustments (id, user_id, admin_user_id, mode, date_key, delta, before_used, after_used, reason, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(id, userId, adminUserId, mode, dateKey, delta, beforeRemaining, afterRemaining, reason, now)

  writeAudit(adminUserId, "quota.adjust", {
    targetUserId: userId,
    mode,
    dateKey,
    delta,
    beforeRemaining,
    afterRemaining,
    reason,
  })
  createAccountMessage({
    userId,
    kind: "quota",
    title: "Quota adjusted",
    body: `${mode === "config" ? "Config" : "Chat"} quota changed by ${delta > 0 ? "+" : ""}${delta}. Reason: ${reason}`,
    metadata: { mode, dateKey, delta, beforeRemaining, afterRemaining, adminUserId },
    createdAt: now,
  })

  const row = database().prepare("SELECT * FROM quota_adjustments WHERE id = ?").get(id) as Row
  return {
    adjustment: mapQuotaAdjustment(row),
    billing: getBillingStatus(userId),
  }
}

export function accountMessages(userId: string): AccountMessage[] {
  const rows = database()
    .prepare("SELECT * FROM account_messages WHERE user_id = ? ORDER BY created_at DESC")
    .all(userId) as Row[]
  return rows.map(mapAccountMessage)
}

export function unreadAccountMessageCount(userId: string) {
  const row = database()
    .prepare("SELECT COUNT(*) AS value FROM account_messages WHERE user_id = ? AND read_at = 0")
    .get(userId) as Row | undefined
  return Number(row?.value || 0)
}

export function markAccountMessageRead(userId: string, messageId: string) {
  database()
    .prepare("UPDATE account_messages SET read_at = CASE WHEN read_at = 0 THEN ? ELSE read_at END WHERE id = ? AND user_id = ?")
    .run(nowMs(), messageId, userId)
  return accountMessages(userId)
}

export function markAllAccountMessagesRead(userId: string) {
  database().prepare("UPDATE account_messages SET read_at = ? WHERE user_id = ? AND read_at = 0").run(nowMs(), userId)
  return accountMessages(userId)
}

export function createAccountMessage(input: {
  userId: string
  kind: AccountMessageKind
  title: string
  body: string
  metadata?: Record<string, unknown>
  id?: string
  readAt?: number
  createdAt?: number
}) {
  const now = input.createdAt ?? nowMs()
  const id = input.id || `notice_${randomUUID().slice(0, 10)}`
  database()
    .prepare("INSERT OR IGNORE INTO account_messages (id, user_id, kind, title, body, metadata_json, read_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(id, input.userId, input.kind, input.title, input.body, JSON.stringify(input.metadata || {}), input.readAt || 0, now)
  return accountMessages(input.userId).find((message) => message.id === id)
}

export function createPaymentOrder(input: { userId: string; planId: MembershipPlanId; method: "wechat" | "alipay" }) {
  const plan = membershipPlans().find((item) => item.id === input.planId && item.active)
  if (!plan || plan.id === "free") throw new Error("请选择有效会员套餐。")
  const now = nowMs()
  const id = `pay_${crypto.randomUUID().slice(0, 8)}`
  const currentSubscription = activeSubscription(input.userId)
  const currentPlan = currentSubscription ? membershipPlans().find((item) => item.id === currentSubscription.planId) : undefined
  const isSwitchOrder = Boolean(currentSubscription && currentSubscription.planId !== plan.id)
  const isRenewalOrder = Boolean(currentSubscription && currentSubscription.planId === plan.id)
  database()
    .prepare("INSERT INTO payment_orders (id, user_id, plan_id, method, status, amount_cents, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
    .run(id, input.userId, plan.id, input.method, "pending", plan.priceCents, now, now)
  createAccountMessage({
    id: `pay-created-${id}`,
    userId: input.userId,
    kind: "payment",
    title: isSwitchOrder ? "订阅切换订单已创建" : isRenewalOrder ? "订阅续费订单已创建" : "充值订单已创建",
    body: isSwitchOrder
      ? `已创建从 ${currentPlan?.label || currentSubscription?.planId} 切换到 ${plan.label} 的订阅订单，金额 ¥${(plan.priceCents / 100).toFixed(2)}。支付完成后将更新会员权益。`
      : isRenewalOrder
        ? `${plan.label} 续费订单已创建，金额 ¥${(plan.priceCents / 100).toFixed(2)}。支付完成后将更新会员有效期。`
        : `${plan.label} 订阅订单已创建，金额 ¥${(plan.priceCents / 100).toFixed(2)}。请完成支付后等待系统更新权益。`,
    metadata: {
      orderId: id,
      planId: plan.id,
      previousPlanId: currentSubscription?.planId,
      method: input.method,
      amountCents: plan.priceCents,
      changeType: isSwitchOrder ? "switch" : isRenewalOrder ? "renewal" : "new",
    },
    createdAt: now,
  })
  writeAudit(input.userId, "billing.checkout.created", { orderId: id, planId: plan.id, method: input.method })
  return paymentOrders(input.userId).find((order) => order.id === id) as PaymentOrder
}

export function completeMockPayment(input: { userId: string; orderId: string }) {
  const order = paymentOrders(input.userId).find((item) => item.id === input.orderId)
  if (!order) throw new Error("支付订单不存在。")
  const now = nowMs()
  const previousSubscription = activeSubscription(input.userId)
  const previousPlan = previousSubscription ? membershipPlans().find((item) => item.id === previousSubscription.planId) : undefined
  database().prepare("UPDATE payment_orders SET status = 'paid', updated_at = ? WHERE id = ? AND user_id = ?").run(now, order.id, input.userId)
  database().prepare("UPDATE subscriptions SET status = 'canceled', updated_at = ? WHERE user_id = ? AND status = 'active'").run(now, input.userId)
  const subId = `sub_${crypto.randomUUID().slice(0, 8)}`
  database()
    .prepare("INSERT INTO subscriptions (id, user_id, plan_id, status, current_period_end, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(subId, input.userId, order.planId, "active", now + 1000 * 60 * 60 * 24 * 30, now, now)
  database().prepare("UPDATE users SET plan = ? WHERE id = ?").run(order.planId, input.userId)
  const plan = membershipPlans().find((item) => item.id === order.planId)
  createAccountMessage({
    id: `pay-success-${order.id}`,
    userId: input.userId,
    kind: "subscription",
    title: previousSubscription && previousSubscription.planId !== order.planId
      ? "订阅切换成功"
      : previousSubscription
        ? "订阅续费成功"
        : "订阅开通成功",
    body: previousSubscription && previousSubscription.planId !== order.planId
      ? `已从 ${previousPlan?.label || previousSubscription.planId} 切换为 ${plan?.label || order.planId} 会员，有效期至 ${new Date(now + 1000 * 60 * 60 * 24 * 30).toLocaleDateString("zh-CN")}。`
      : previousSubscription
        ? `${plan?.label || order.planId} 会员已续费，有效期至 ${new Date(now + 1000 * 60 * 60 * 24 * 30).toLocaleDateString("zh-CN")}。`
        : `${plan?.label || order.planId} 会员已开通，有效期至 ${new Date(now + 1000 * 60 * 60 * 24 * 30).toLocaleDateString("zh-CN")}。`,
    metadata: {
      orderId: order.id,
      planId: order.planId,
      previousPlanId: previousSubscription?.planId,
      subscriptionId: subId,
      changeType: previousSubscription && previousSubscription.planId !== order.planId ? "switch" : previousSubscription ? "renewal" : "new",
    },
    createdAt: now,
  })
  writeAudit(input.userId, "billing.mock_paid", { orderId: order.id, planId: order.planId })
  return getBillingStatus(input.userId)
}

export function getActiveProvider() {
  return providers().find((provider) => provider.active) || providers().find((provider) => provider.id === "mock") || providers()[0]
}

export function createVehicleUpload(input: { userId?: string; fileName: string; url: string; mime: string; size: number }) {
  const uploadId = `upload_${crypto.randomUUID().slice(0, 8)}`
  database()
    .prepare("INSERT INTO vehicle_uploads (id, user_id, file_name, url, mime, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(uploadId, input.userId || DEMO_USER_ID, input.fileName, input.url, input.mime, input.size, nowMs())
  return { id: uploadId, url: input.url }
}

export function createGeneration(input: {
  userId?: string
  mode?: GenerationMode
  provider: ProviderId
  vehicleUploadId: string
  sourceImageUrl: string
  resultImageUrl?: string
  paintId: string
  stance: number
  selections: SelectionMap
  selectionOptions?: PartSelectionOptions
  standardJson?: GenerationStandardJson
  workflowId?: string
  promptVersion?: string
  promptSummary: string
  promptHidden: string
  resultCheck?: ResultCheckResult
  retryCount?: number
  failureReason?: string
  status?: GenerationJob["status"]
  costCents?: number
  badCaseTags?: string[]
  usageUnits?: number
}) {
  const generationId = `gen_${crypto.randomUUID().slice(0, 8)}`
  const units = input.usageUnits ?? (input.provider === "mock" ? 1 : 4)
  const costCents = input.costCents ?? (input.provider === "mock" ? 0 : 90)
  const status = input.status ?? (input.failureReason ? "failed" : "succeeded")
  const resultImageUrl = status === "failed" ? input.resultImageUrl ?? "" : input.resultImageUrl ?? input.sourceImageUrl
  const now = nowMs()
  database()
    .prepare(`
      INSERT INTO generation_jobs
      (id, user_id, vehicle_upload_id, mode, provider, paint_id, stance, selections_json, selection_options_json, standard_json, workflow_id, prompt_version, prompt_summary, prompt_hidden, result_check_json, retry_count, failure_reason, cost_cents, bad_case_tags_json, status, result_image_url, usage_units, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      generationId,
      input.userId || DEMO_USER_ID,
      input.vehicleUploadId,
      input.mode || "config",
      input.provider,
      input.paintId,
      input.stance,
      JSON.stringify(input.selections),
      JSON.stringify(input.selectionOptions ?? {}),
      JSON.stringify(input.standardJson ?? null),
      input.workflowId ?? "",
      input.promptVersion ?? "",
      input.promptSummary,
      input.promptHidden,
      input.resultCheck ? JSON.stringify(input.resultCheck) : "",
      input.retryCount ?? 0,
      input.failureReason ?? "",
      costCents,
      JSON.stringify(input.badCaseTags ?? []),
      status,
      resultImageUrl,
      units,
      now,
    )
  database()
    .prepare("INSERT INTO usage_ledger (id, user_id, generation_id, provider, usage_units, cost_cents, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(`usage_${crypto.randomUUID().slice(0, 8)}`, input.userId || DEMO_USER_ID, generationId, input.provider, units, costCents, now)
  if (input.resultCheck && !input.resultCheck.passed) {
    createBadCase({
      generationId,
      userId: input.userId || DEMO_USER_ID,
      mode: input.mode || "config",
      badCaseType: input.resultCheck.badCaseTags[0] || "quality_check_failed",
      summary: input.resultCheck.summary,
      standardJson: input.standardJson ?? null,
      resultCheck: input.resultCheck,
    })
  }
  return getGeneration(generationId)
}

export function getGeneration(id: string): GenerationJob {
  const row = database()
    .prepare(`
      SELECT generation_jobs.*, vehicle_uploads.url AS source_image_url
      FROM generation_jobs
      JOIN vehicle_uploads ON vehicle_uploads.id = generation_jobs.vehicle_upload_id
      WHERE generation_jobs.id = ?
    `)
    .get(id)
  if (!row) throw new Error(`Generation not found: ${id}`)
  return mapGeneration(row as Row)
}

export function listUserGenerations(userId: string, limit = 80): GenerationJob[] {
  const rows = database()
    .prepare(`
      SELECT generation_jobs.*, vehicle_uploads.url AS source_image_url
      FROM generation_jobs
      JOIN vehicle_uploads ON vehicle_uploads.id = generation_jobs.vehicle_upload_id
      WHERE generation_jobs.user_id = ?
        AND generation_jobs.status = 'succeeded'
        AND generation_jobs.result_image_url != ''
        AND generation_jobs.mode = 'config'
      ORDER BY generation_jobs.created_at DESC
      LIMIT ?
    `)
    .all(userId, limit) as Row[]
  return rows.map(mapGeneration)
}

export function findGenerationByResultImageUrl(resultImageUrl: string, userId = DEMO_USER_ID): GenerationJob | null {
  const url = resultImageUrl.trim()
  if (!url) return null
  const row = database()
    .prepare(`
      SELECT generation_jobs.*, vehicle_uploads.url AS source_image_url
      FROM generation_jobs
      JOIN vehicle_uploads ON vehicle_uploads.id = generation_jobs.vehicle_upload_id
      WHERE generation_jobs.user_id = ?
        AND generation_jobs.status = 'succeeded'
        AND generation_jobs.result_image_url = ?
      ORDER BY generation_jobs.created_at DESC
      LIMIT 1
    `)
    .get(userId, url) as Row | undefined
  return row ? mapGeneration(row) : null
}

export function saveGarage(generationId: string, userId = DEMO_USER_ID) {
  const job = database()
    .prepare("SELECT status, result_image_url FROM generation_jobs WHERE id = ? AND user_id = ? LIMIT 1")
    .get(generationId, userId) as Row | undefined
  if (!job) throw new Error(`Generation not found: ${generationId}`)
  if (String(job.status) !== "succeeded" || !String(job.result_image_url || "")) {
    throw new Error("Only successful generations can be saved.")
  }
  database()
    .prepare("INSERT INTO garage_items (id, user_id, generation_id, created_at) VALUES (?, ?, ?, ?)")
    .run(`garage_${crypto.randomUUID().slice(0, 8)}`, userId, generationId, nowMs())
  const row = database().prepare("SELECT COUNT(*) AS count FROM garage_items WHERE user_id = ?").get(userId) as Row
  return { garageCount: Number(row.count) }
}

export function deleteGeneration(generationId: string, userId = DEMO_USER_ID) {
  const existing = database()
    .prepare("SELECT id, vehicle_upload_id FROM generation_jobs WHERE id = ? AND user_id = ? LIMIT 1")
    .get(generationId, userId) as Row | undefined
  if (!existing) throw new Error(`Generation not found: ${generationId}`)
  database().prepare("DELETE FROM garage_items WHERE generation_id = ? AND user_id = ?").run(generationId, userId)
  database().prepare("DELETE FROM usage_ledger WHERE generation_id = ? AND user_id = ?").run(generationId, userId)
  database().prepare("DELETE FROM generation_jobs WHERE id = ? AND user_id = ?").run(generationId, userId)
  const uploadId = String(existing.vehicle_upload_id || "")
  const uploadInUse = uploadId ? scalarWithParam("SELECT COUNT(*) AS value FROM generation_jobs WHERE vehicle_upload_id = ?", uploadId) : 0
  if (uploadId && uploadInUse === 0) {
    database().prepare("DELETE FROM vehicle_uploads WHERE id = ? AND user_id = ?").run(uploadId, userId)
  }
  writeAudit(userId, "generation.delete", { generationId })
  return { ok: true }
}

export function createBadCase(input: {
  generationId: string
  userId: string
  mode: GenerationMode
  badCaseType: string
  summary: string
  standardJson: GenerationStandardJson | null
  resultCheck: ResultCheckResult | null
}) {
  const id = `bad_${crypto.randomUUID().slice(0, 8)}`
  database()
    .prepare(`
      INSERT INTO generation_bad_cases
      (id, generation_id, user_id, mode, bad_case_type, summary, standard_json, result_check_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      id,
      input.generationId,
      input.userId,
      input.mode,
      input.badCaseType,
      input.summary,
      JSON.stringify(input.standardJson),
      input.resultCheck ? JSON.stringify(input.resultCheck) : "",
      nowMs(),
    )
  return listBadCases(1)[0]
}

export function listBadCases(limit = 50): GenerationBadCase[] {
  const rows = database()
    .prepare("SELECT * FROM generation_bad_cases ORDER BY created_at DESC LIMIT ?")
    .all(limit) as Row[]
  return rows.map(mapBadCase)
}

export function getAdminSummary(): AdminSummary {
  const usageRows = database().prepare("SELECT * FROM usage_ledger ORDER BY created_at DESC LIMIT 50").all() as Row[]
  const generationRows = database()
    .prepare(`
      SELECT generation_jobs.*, vehicle_uploads.url AS source_image_url
      FROM generation_jobs
      JOIN vehicle_uploads ON vehicle_uploads.id = generation_jobs.vehicle_upload_id
      ORDER BY generation_jobs.created_at DESC LIMIT 30
    `)
    .all() as Row[]
  const userRows = database().prepare("SELECT * FROM users ORDER BY created_at DESC").all() as Row[]
  const userById = userLabelMap(userRows)
  const quotaAdjustmentRows = database().prepare("SELECT * FROM quota_adjustments ORDER BY created_at DESC LIMIT 100").all() as Row[]
  const providerCostRows = database()
    .prepare(`
      SELECT usage_ledger.provider AS provider,
             COUNT(*) AS request_count,
             SUM(CASE WHEN generation_jobs.status = 'succeeded' THEN 1 ELSE 0 END) AS success_count,
             SUM(CASE WHEN generation_jobs.status = 'failed' THEN 1 ELSE 0 END) AS failure_count,
             COALESCE(SUM(usage_ledger.usage_units), 0) AS usage_units,
             COALESCE(SUM(usage_ledger.cost_cents), 0) AS cost_cents,
             MAX(usage_ledger.created_at) AS last_request_at
      FROM usage_ledger
      LEFT JOIN generation_jobs ON generation_jobs.id = usage_ledger.generation_id
      GROUP BY usage_ledger.provider
      ORDER BY cost_cents DESC, request_count DESC
    `)
    .all() as Row[]
  const failureRows = database()
    .prepare(`
      SELECT *
      FROM generation_jobs
      WHERE status = 'failed' OR trim(failure_reason) != ''
      ORDER BY created_at DESC
      LIMIT 100
    `)
    .all() as Row[]

  return {
    stats: {
      users: scalar("SELECT COUNT(*) AS value FROM users"),
      activeAssets: scalar("SELECT COUNT(*) AS value FROM part_assets WHERE active = 1"),
      generations: scalar("SELECT COUNT(*) AS value FROM generation_jobs"),
      failedGenerations: scalar("SELECT COUNT(*) AS value FROM generation_jobs WHERE status = 'failed' OR trim(failure_reason) != ''"),
      usageUnits: scalar("SELECT COALESCE(SUM(usage_units), 0) AS value FROM usage_ledger"),
      totalCostCents: scalar("SELECT COALESCE(SUM(cost_cents), 0) AS value FROM usage_ledger"),
    },
    categories: categories(),
    brands: brands(),
    assets: assets(),
    providers: providers(),
    prompts: prompts(),
    promptTemplates: promptTemplates(),
    workflows: workflowConfigs(),
    guardrailConfig: getGuardrailConfig(),
    chatSessions: listChatSessions(),
    plans: membershipPlans(),
    auditLogs: auditLogs(),
    badCases: listBadCases(),
    quotaAdjustments: quotaAdjustmentRows.map(mapQuotaAdjustment),
    providerCosts: providerCostRows.map((row) => ({
      provider: row.provider as ProviderId,
      requestCount: Number(row.request_count || 0),
      successCount: Number(row.success_count || 0),
      failureCount: Number(row.failure_count || 0),
      usageUnits: Number(row.usage_units || 0),
      costCents: Number(row.cost_cents || 0),
      lastRequestAt: Number(row.last_request_at || 0),
    })),
    generationFailures: failureRows.map((row) => ({
      generationId: String(row.id),
      userId: String(row.user_id),
      userLabel: userById.get(String(row.user_id)) ?? String(row.user_id),
      mode: String(row.mode || "config") as GenerationMode,
      provider: row.provider as ProviderId,
      failureReason: String(row.failure_reason || ""),
      badCaseTags: safeJson<string[]>(String(row.bad_case_tags_json || "[]"), []),
      retryCount: Number(row.retry_count || 0),
      costCents: Number(row.cost_cents || 0),
      createdAt: Number(row.created_at || 0),
    })),
    behaviorEvents: adminBehaviorEvents(userById),
    userProfiles: adminUserProfiles(userRows),
    users: userRows.map((row) => {
      const billing = getBillingStatus(String(row.id))
      return {
        id: String(row.id),
        name: String(row.name),
        username: String(row.username || ""),
        email: String(row.email),
        phone: String(row.phone || ""),
        role: String(row.role),
        plan: String(row.plan),
        configUsed: billing.configUsed,
        chatUsedToday: billing.chatUsedToday,
        configRemaining: billing.configRemaining,
        chatRemainingToday: billing.chatRemainingToday,
        createdAt: Number(row.created_at),
      }
    }),
    generations: generationRows.map(mapGeneration),
    usage: usageRows.map((row) => ({
      id: String(row.id),
      userId: String(row.user_id),
      generationId: String(row.generation_id),
      provider: row.provider as ProviderId,
      usageUnits: Number(row.usage_units),
      costCents: Number(row.cost_cents),
      createdAt: Number(row.created_at),
    })),
  }
}

function userLabelMap(userRows: Row[]) {
  const map = new Map<string, string>()
  for (const row of userRows) {
    const id = String(row.id)
    map.set(id, String(row.name || row.username || row.phone || id))
  }
  return map
}

function mapQuotaAdjustment(row: Row): AdminSummary["quotaAdjustments"][number] {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    adminUserId: String(row.admin_user_id),
    mode: String(row.mode || "config") === "chat" ? "chat" : "config",
    dateKey: String(row.date_key || ""),
    delta: Number(row.delta || 0),
    beforeUsed: Number(row.before_used || 0),
    afterUsed: Number(row.after_used || 0),
    reason: String(row.reason || ""),
    createdAt: Number(row.created_at || 0),
  }
}

function adminBehaviorEvents(userById: Map<string, string>): AdminSummary["behaviorEvents"] {
  const events: AdminSummary["behaviorEvents"] = []
  const generationRows = database()
    .prepare("SELECT id, user_id, mode, provider, status, failure_reason, created_at FROM generation_jobs ORDER BY created_at DESC LIMIT 80")
    .all() as Row[]
  for (const row of generationRows) {
    const status = String(row.status || "")
    const failureReason = String(row.failure_reason || "")
    events.push({
      id: `generation-${String(row.id)}`,
      userId: String(row.user_id),
      userLabel: userById.get(String(row.user_id)) ?? String(row.user_id),
      type: `generation.${status || "unknown"}`,
      summary: `${String(row.mode || "config")} / ${String(row.provider || "provider")} / ${status}${failureReason ? ` / ${failureReason}` : ""}`,
      createdAt: Number(row.created_at || 0),
    })
  }

  const chatRows = database()
    .prepare("SELECT id, user_id, title, updated_at FROM chat_sessions ORDER BY updated_at DESC LIMIT 50")
    .all() as Row[]
  for (const row of chatRows) {
    events.push({
      id: `chat-${String(row.id)}`,
      userId: String(row.user_id),
      userLabel: userById.get(String(row.user_id)) ?? String(row.user_id),
      type: "chat.session",
      summary: String(row.title || "Chat session"),
      createdAt: Number(row.updated_at || 0),
    })
  }

  const paymentRows = database()
    .prepare("SELECT id, user_id, plan_id, method, status, amount_cents, updated_at FROM payment_orders ORDER BY updated_at DESC LIMIT 50")
    .all() as Row[]
  for (const row of paymentRows) {
    events.push({
      id: `payment-${String(row.id)}`,
      userId: String(row.user_id),
      userLabel: userById.get(String(row.user_id)) ?? String(row.user_id),
      type: `payment.${String(row.status || "unknown")}`,
      summary: `${String(row.method || "payment")} / ${String(row.plan_id || "plan")} / ${(Number(row.amount_cents || 0) / 100).toFixed(2)}`,
      createdAt: Number(row.updated_at || 0),
    })
  }

  const auditRows = database().prepare("SELECT id, user_id, action, metadata, created_at FROM audit_logs ORDER BY created_at DESC LIMIT 80").all() as Row[]
  for (const row of auditRows) {
    events.push({
      id: `audit-${String(row.id)}`,
      userId: String(row.user_id || ""),
      userLabel: userById.get(String(row.user_id || "")) ?? String(row.user_id || "system"),
      type: `audit.${String(row.action || "unknown")}`,
      summary: String(row.metadata || "{}"),
      createdAt: Number(row.created_at || 0),
    })
  }

  return events.toSorted((a, b) => b.createdAt - a.createdAt).slice(0, 120)
}

function adminUserProfiles(userRows: Row[]): AdminSummary["userProfiles"] {
  type ProfileDraft = Omit<AdminSummary["userProfiles"][number], "topVehicles" | "topParts" | "topPartCategories" | "topPaints"> & {
    topVehicles: Map<string, number>
    topParts: Map<string, number>
    topPartCategories: Map<string, number>
    topPaints: Map<string, number>
  }

  const profiles = new Map<string, ProfileDraft>()
  for (const row of userRows) {
    const userId = String(row.id)
    profiles.set(userId, {
      userId,
      userLabel: String(row.name || row.username || row.phone || userId),
      totalGenerations: 0,
      succeededGenerations: 0,
      failedGenerations: 0,
      totalCostCents: 0,
      lastActiveAt: Number(row.created_at || 0),
      topVehicles: new Map(),
      topParts: new Map(),
      topPartCategories: new Map(),
      topPaints: new Map(),
    })
  }

  const rows = database()
    .prepare("SELECT user_id, status, cost_cents, standard_json, paint_id, created_at FROM generation_jobs ORDER BY created_at DESC LIMIT 2000")
    .all() as Row[]
  for (const row of rows) {
    const userId = String(row.user_id)
    let profile = profiles.get(userId)
    if (!profile) {
      profile = {
        userId,
        userLabel: userId,
        totalGenerations: 0,
        succeededGenerations: 0,
        failedGenerations: 0,
        totalCostCents: 0,
        lastActiveAt: 0,
        topVehicles: new Map(),
        topParts: new Map(),
        topPartCategories: new Map(),
        topPaints: new Map(),
      }
      profiles.set(userId, profile)
    }

    const createdAt = Number(row.created_at || 0)
    const status = String(row.status || "")
    const standard = safeJson<GenerationStandardJson | null>(String(row.standard_json || "null"), null)
    profile.totalGenerations += 1
    profile.succeededGenerations += status === "succeeded" ? 1 : 0
    profile.failedGenerations += status === "failed" ? 1 : 0
    profile.totalCostCents += Number(row.cost_cents || 0)
    profile.lastActiveAt = Math.max(profile.lastActiveAt, createdAt)

    bumpCount(profile.topVehicles, standard?.vehicle?.model)
    bumpCount(profile.topPaints, standard?.paint?.target || String(row.paint_id || ""))
    for (const part of standard?.parts || []) {
      bumpCount(profile.topPartCategories, part.categoryLabel || part.category)
      bumpCount(profile.topParts, [part.brand, part.model, part.variant].filter(Boolean).join(" "))
    }
  }

  return [...profiles.values()]
    .map((profile) => ({
      ...profile,
      topVehicles: topCountEntries(profile.topVehicles),
      topParts: topCountEntries(profile.topParts),
      topPartCategories: topCountEntries(profile.topPartCategories),
      topPaints: topCountEntries(profile.topPaints),
    }))
    .toSorted((a, b) => b.lastActiveAt - a.lastActiveAt)
}

function bumpCount(map: Map<string, number>, label: unknown) {
  const clean = String(label || "").trim()
  if (!clean || clean === "keep_original") return
  map.set(clean, (map.get(clean) || 0) + 1)
}

function topCountEntries(map: Map<string, number>, limit = 4) {
  return [...map.entries()]
    .toSorted((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }))
}

function quotaRemainingValue(status: EntitlementStatus, mode: "config" | "chat") {
  const value = mode === "config" ? status.configRemaining : status.chatRemainingToday
  return value === "unlimited" ? -1 : value
}

type AssetReferenceInput = Partial<Omit<PartAssetReference, "assetId" | "createdAt">> & { url: string }

export function createAsset(input: Omit<PartAsset, "active" | "brandId" | "sortOrder"> & { brandId?: string; active?: boolean; sortOrder?: number; generationReferences?: AssetReferenceInput[] }) {
  const brandId = input.brandId || ensureBrand(input.categoryId, input.brand)
  const sortOrder = Number.isFinite(Number(input.sortOrder)) ? Number(input.sortOrder) : nextAssetSortOrder(input.categoryId, brandId)
  const promptTestStatus = normalizePromptTestStatus(input.promptTestStatus)
  const recommendedViews = normalizeStringArray(input.recommendedViews)
  const keywords = normalizeAssetKeywords(input.keywords)
  if (!keywords) throw new Error("配件关键字必填")
  const defaultColorPolicy = normalizeColorPolicy(input.defaultColorPolicy) ?? inferAssetDefaultColorPolicy(input)
  const allowedColorPolicies = resolveAllowedColorPolicies(input, defaultColorPolicy)
  database()
    .prepare(`
      INSERT INTO part_assets
      (id, category_id, brand_id, brand, model, variant, keywords, color, finish, image_url, image_crop, active, sort_order, prompt_hint, default_color_policy, allowed_color_policies_json, prompt_test_status, generation_ready, bad_case_notes, recommended_views_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      input.id,
      input.categoryId,
      brandId,
      input.brand,
      input.model,
      input.variant,
      keywords,
      input.color,
      input.finish,
      input.imageUrl,
      input.imageCrop ?? "",
      input.active === false ? 0 : 1,
      sortOrder,
      input.promptHint,
      defaultColorPolicy,
      JSON.stringify(allowedColorPolicies),
      promptTestStatus,
      input.generationReady ? 1 : 0,
      input.badCaseNotes ?? "",
      JSON.stringify(recommendedViews),
      nowMs(),
    )
  replaceAssetReferences(input.id, input.generationReferences ?? [])
  return assets().find((asset) => asset.id === input.id) as PartAsset
}

export function createCategory(input: Partial<PartCategory> & { labelEn: string; labelZh: string }) {
  const labelEn = input.labelEn.trim()
  const labelZh = input.labelZh.trim()
  if (!labelEn || !labelZh) throw new Error("类型中文名称和英文名称都不能为空")
  const label = labelEn
  const id = (input.id?.trim() || slug(labelEn)).toLowerCase().replace(/[^a-z0-9-]/g, "-")
  if (!id) throw new Error("类型 ID 不能为空")
  const existing = categories().find((category) => category.id === id)
  if (existing) throw new Error("该类型 ID 已存在")
  const sortOrder = Number.isFinite(Number(input.sortOrder)) ? Number(input.sortOrder) : nextSortOrder("asset_categories")
  const aliases = normalizeCategoryAliases(input.aliases ?? defaultAliasesForCategory(id))
  const chatEnabled = input.chatEnabled ?? defaultChatEnabledForCategory(id)
  const referenceHighRisk = input.referenceHighRisk ?? defaultReferenceHighRiskForCategory(id)
  database()
    .prepare("INSERT INTO asset_categories (id, label, label_en, label_zh, description, sort_order, aliases_json, chat_enabled, reference_high_risk) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
    .run(id, label, labelEn, labelZh, input.description?.trim() || "", sortOrder, JSON.stringify(aliases), chatEnabled ? 1 : 0, referenceHighRisk ? 1 : 0)
  writeAudit("", "admin.category.create", { id, labelEn, labelZh })
  return categories().find((category) => category.id === id) as PartCategory
}

export function updateCategory(id: string, patch: Partial<PartCategory>) {
  const current = categories().find((category) => category.id === id)
  if (!current) throw new Error(`Category not found: ${id}`)
  const labelEn = patch.labelEn?.trim() || current.labelEn
  const labelZh = patch.labelZh?.trim() || current.labelZh
  if (!labelEn || !labelZh) throw new Error("类型中文名称和英文名称都不能为空")
  const next = {
    ...current,
    label: labelEn,
    labelEn,
    labelZh,
    description: patch.description ?? current.description,
    sortOrder: patch.sortOrder === undefined ? current.sortOrder : Number(patch.sortOrder),
    aliases: patch.aliases === undefined ? current.aliases ?? [] : normalizeCategoryAliases(patch.aliases),
    chatEnabled: patch.chatEnabled === undefined ? current.chatEnabled ?? true : Boolean(patch.chatEnabled),
    referenceHighRisk: patch.referenceHighRisk === undefined ? current.referenceHighRisk ?? false : Boolean(patch.referenceHighRisk),
  }
  database()
    .prepare("UPDATE asset_categories SET label = ?, label_en = ?, label_zh = ?, description = ?, sort_order = ?, aliases_json = ?, chat_enabled = ?, reference_high_risk = ? WHERE id = ?")
    .run(
      next.label,
      next.labelEn,
      next.labelZh,
      next.description,
      Number.isFinite(next.sortOrder) ? next.sortOrder : current.sortOrder,
      JSON.stringify(next.aliases),
      next.chatEnabled ? 1 : 0,
      next.referenceHighRisk ? 1 : 0,
      id,
    )
  writeAudit("", "admin.category.update", { id, labelEn: next.labelEn, labelZh: next.labelZh })
  return categories().find((category) => category.id === id) as PartCategory
}

export function deleteCategory(id: string) {
  const brandCount = countWhere("asset_brands", "category_id", id)
  const assetCount = countWhere("part_assets", "category_id", id)
  if (brandCount + assetCount > 0) {
    throw new Error("该类型下仍有品牌或配件，请先迁移或删除后再操作")
  }
  const result = database().prepare("DELETE FROM asset_categories WHERE id = ?").run(id)
  if (!result.changes) throw new Error(`Category not found: ${id}`)
  writeAudit("", "admin.category.delete", { id })
  return { ok: true }
}

export function createBrand(input: Partial<PartBrand> & { categoryId: string; label: string }) {
  const categoryId = input.categoryId.trim()
  if (!categories().some((category) => category.id === categoryId)) throw new Error("请选择有效的配件类型")
  const label = input.label.trim()
  if (!label) throw new Error("品牌名称不能为空")
  const id = (input.id?.trim() || `${categoryId}-${slug(label)}`).toLowerCase().replace(/[^a-z0-9-]/g, "-")
  if (brands().some((brand) => brand.id === id)) throw new Error("该品牌 ID 已存在")
  const sortOrder = Number.isFinite(Number(input.sortOrder)) ? Number(input.sortOrder) : nextSortOrder("asset_brands", categoryId)
  database()
    .prepare("INSERT INTO asset_brands (id, category_id, label, sort_order, active) VALUES (?, ?, ?, ?, ?)")
    .run(id, categoryId, label, sortOrder, input.active === false ? 0 : 1)
  writeAudit("", "admin.brand.create", { id, categoryId, label })
  return brands().find((brand) => brand.id === id) as PartBrand
}

export function updateBrand(id: string, patch: Partial<PartBrand>) {
  const current = brands().find((brand) => brand.id === id)
  if (!current) throw new Error(`Brand not found: ${id}`)
  const nextCategoryId = patch.categoryId?.trim() || current.categoryId
  if (!categories().some((category) => category.id === nextCategoryId)) throw new Error("请选择有效的配件类型")
  const linkedAssets = countWhere("part_assets", "brand_id", id)
  if (linkedAssets > 0 && nextCategoryId !== current.categoryId) {
    throw new Error("该品牌下已有配件，不能直接切换类型")
  }
  const nextLabel = patch.label?.trim() || current.label
  const nextSortOrder = patch.sortOrder === undefined ? current.sortOrder : Number(patch.sortOrder)
  const nextActive = patch.active === undefined ? current.active : Boolean(patch.active)
  database()
    .prepare("UPDATE asset_brands SET category_id = ?, label = ?, sort_order = ?, active = ? WHERE id = ?")
    .run(nextCategoryId, nextLabel, Number.isFinite(nextSortOrder) ? nextSortOrder : current.sortOrder, nextActive ? 1 : 0, id)
  database().prepare("UPDATE part_assets SET brand = ? WHERE brand_id = ?").run(nextLabel, id)
  writeAudit("", "admin.brand.update", { id, categoryId: nextCategoryId, label: nextLabel, active: nextActive })
  return brands().find((brand) => brand.id === id) as PartBrand
}

export function deleteBrand(id: string) {
  const linkedAssets = countWhere("part_assets", "brand_id", id)
  if (linkedAssets > 0) {
    database().prepare("UPDATE asset_brands SET active = 0 WHERE id = ?").run(id)
    writeAudit("", "admin.brand.disable", { id, linkedAssets })
    return { ok: true, disabled: true }
  }
  const result = database().prepare("DELETE FROM asset_brands WHERE id = ?").run(id)
  if (!result.changes) throw new Error(`Brand not found: ${id}`)
  writeAudit("", "admin.brand.delete", { id })
  return { ok: true, disabled: false }
}

export function reorderCategories(orderedIds: string[]) {
  const ids = orderedIds.filter(Boolean)
  const currentIds = categories().map((category) => category.id)
  assertSameOrderSet(ids, currentIds, "Invalid category order")
  applySortOrder("asset_categories", ids)
  writeAudit("", "admin.category.reorder", { ids })
  return categories()
}

export function reorderBrands(categoryId: string, orderedIds: string[]) {
  const ids = orderedIds.filter(Boolean)
  const currentIds = brands().filter((brand) => brand.categoryId === categoryId).map((brand) => brand.id)
  assertSameOrderSet(ids, currentIds, "Invalid brand order")
  applySortOrder("asset_brands", ids)
  writeAudit("", "admin.brand.reorder", { categoryId, ids })
  return brands().filter((brand) => brand.categoryId === categoryId)
}

export function reorderAssets(categoryId: string, brandId: string, orderedIds: string[]) {
  const ids = orderedIds.filter(Boolean)
  const currentIds = assets()
    .filter((asset) => asset.categoryId === categoryId && (!brandId || asset.brandId === brandId))
    .map((asset) => asset.id)
  assertSameOrderSet(ids, currentIds, "Invalid asset order")
  applySortOrder("part_assets", ids)
  writeAudit("", "admin.asset.reorder", { categoryId, brandId, ids })
  return assets().filter((asset) => asset.categoryId === categoryId && (!brandId || asset.brandId === brandId))
}

export function updateAsset(id: string, patch: Partial<PartAsset>) {
  const current = assets().find((asset) => asset.id === id)
  if (!current) throw new Error(`Asset not found: ${id}`)
  const next = { ...current, ...patch }
  const brandId = next.brandId || ensureBrand(next.categoryId, next.brand)
  const promptTestStatus = normalizePromptTestStatus(next.promptTestStatus)
  const recommendedViews = normalizeStringArray(next.recommendedViews)
  const keywords = normalizeAssetKeywords(next.keywords)
  if (!keywords) throw new Error("配件关键字必填")
  const defaultColorPolicy = normalizeColorPolicy(next.defaultColorPolicy) ?? inferAssetDefaultColorPolicy(next)
  const allowedColorPolicies = resolveAllowedColorPolicies(next, defaultColorPolicy)
  database()
    .prepare(`
      UPDATE part_assets
      SET category_id = ?, brand_id = ?, brand = ?, model = ?, variant = ?, keywords = ?, color = ?, finish = ?, image_url = ?, image_crop = ?, active = ?, sort_order = ?, prompt_hint = ?, default_color_policy = ?, allowed_color_policies_json = ?, prompt_test_status = ?, generation_ready = ?, bad_case_notes = ?, recommended_views_json = ?
      WHERE id = ?
    `)
    .run(
      next.categoryId,
      brandId,
      next.brand,
      next.model,
      next.variant,
      keywords,
      next.color,
      next.finish,
      next.imageUrl,
      next.imageCrop ?? "",
      next.active ? 1 : 0,
      Number.isFinite(Number(next.sortOrder)) ? Number(next.sortOrder) : current.sortOrder,
      next.promptHint,
      defaultColorPolicy,
      JSON.stringify(allowedColorPolicies),
      promptTestStatus,
      next.generationReady ? 1 : 0,
      next.badCaseNotes ?? "",
      JSON.stringify(recommendedViews),
      id,
    )
  if (patch.generationReferences) {
    replaceAssetReferences(id, patch.generationReferences as AssetReferenceInput[])
  }
  return assets().find((asset) => asset.id === id) as PartAsset
}

export function updateProvider(input: { id?: ProviderId; label?: string; baseUrl?: string; modelName?: string; capabilities?: ProviderConfig["capabilities"]; enabled?: boolean; active?: boolean; apiKey?: string }) {
  const providerId = input.id || `provider_${crypto.randomUUID().slice(0, 8)}`
  const stored = database().prepare("SELECT id FROM provider_configs WHERE id = ? LIMIT 1").get(providerId) as Row | undefined
  const current = providers().find((provider) => provider.id === providerId)
  const isNew = !stored
  const baseProvider: ProviderConfig = current ?? {
    id: providerId,
    label: input.label || "新建模型 API",
    baseUrl: "",
    modelName: "",
    capabilities: input.capabilities?.length ? input.capabilities : ["image_generation"],
    enabled: Boolean(input.enabled),
    active: false,
    hasApiKey: false,
    maskedKey: "",
    updatedAt: nowMs(),
  }
  const apiKey = input.apiKey ?? ""
  const masked = apiKey ? maskKey(apiKey) : baseProvider.maskedKey
  const cipher = apiKey ? encryptSecret(apiKey) : null
  const nextActive = input.active ?? (input.enabled === false ? false : baseProvider.active)
  const nextEnabled = input.active === true ? true : input.enabled ?? baseProvider.enabled
  if (input.active === true) {
    database().prepare("UPDATE provider_configs SET active = 0").run()
  }
  if (isNew) {
    database()
      .prepare(`
        INSERT INTO provider_configs
        (id, label, base_url, model_name, capabilities_json, enabled, active, api_key_cipher, api_key_masked, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        providerId,
        input.label ?? baseProvider.label,
        input.baseUrl ?? baseProvider.baseUrl,
        input.modelName ?? baseProvider.modelName,
        JSON.stringify(input.capabilities?.length ? input.capabilities : baseProvider.capabilities),
        nextEnabled ? 1 : 0,
        nextActive ? 1 : 0,
        cipher ?? "",
        masked,
        nowMs(),
      )
  } else {
    database()
      .prepare(`
        UPDATE provider_configs
        SET label = ?, base_url = ?, model_name = ?, capabilities_json = ?, enabled = ?, active = ?, api_key_cipher = COALESCE(?, api_key_cipher), api_key_masked = ?, updated_at = ?
        WHERE id = ?
      `)
      .run(
        input.label ?? baseProvider.label,
        input.baseUrl ?? baseProvider.baseUrl,
        input.modelName ?? baseProvider.modelName,
        JSON.stringify(input.capabilities?.length ? input.capabilities : baseProvider.capabilities),
        nextEnabled ? 1 : 0,
        nextActive ? 1 : 0,
        cipher,
        masked,
        nowMs(),
        providerId,
      )
  }
  database().prepare("UPDATE provider_configs SET active = 1, enabled = 1 WHERE id = 'mock' AND NOT EXISTS (SELECT 1 FROM provider_configs WHERE active = 1)").run()
  return providers().find((provider) => provider.id === providerId) as ProviderConfig
}

export function getProviderApiKey(providerId: ProviderId) {
  const row = database().prepare("SELECT api_key_cipher FROM provider_configs WHERE id = ? LIMIT 1").get(providerId) as Row | undefined
  const cipher = String(row?.api_key_cipher || "")
  if (!cipher) return ""
  return decryptSecret(cipher)
}

export function createPrompt(input: { title: string; version: string; body: string; negativePrompt: string; active: boolean }) {
  const promptId = `preset_${crypto.randomUUID().slice(0, 8)}`
  if (input.active) database().prepare("UPDATE prompt_presets SET active = 0").run()
  database()
    .prepare("INSERT INTO prompt_presets (id, title, version, body, negative_prompt, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .run(promptId, input.title, input.version, input.body, input.negativePrompt, input.active ? 1 : 0, nowMs())
  return prompts().find((prompt) => prompt.id === promptId) as PromptPreset
}

export function listPromptTemplates(scope?: PromptTemplateScope) {
  const templates = promptTemplates()
  return scope ? templates.filter((template) => template.scope === scope) : templates
}

export function createPromptTemplate(input: {
  scope: PromptTemplateScope
  title: string
  body: string
  assetId?: string
  combinationKey?: string
  active?: boolean
  sortOrder?: number
}) {
  const id = `tpl_${crypto.randomUUID().slice(0, 10)}`
  const now = nowMs()
  database()
    .prepare(`
      INSERT INTO prompt_templates
      (id, scope, title, body, asset_id, combination_key, active, sort_order, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(id, input.scope, input.title.trim() || "未命名 Prompt", input.body, input.assetId ?? "", input.combinationKey ?? "", input.active === false ? 0 : 1, input.sortOrder ?? 0, now)
  return promptTemplates().find((template) => template.id === id) as PromptTemplate
}

export function updatePromptTemplate(id: string, patch: Partial<Omit<PromptTemplate, "id" | "updatedAt">>) {
  const current = promptTemplates().find((template) => template.id === id)
  if (!current) throw new Error(`Prompt template not found: ${id}`)
  const next = { ...current, ...patch, updatedAt: nowMs() }
  database()
    .prepare(`
      UPDATE prompt_templates
      SET scope = ?, title = ?, body = ?, asset_id = ?, combination_key = ?, active = ?, sort_order = ?, updated_at = ?
      WHERE id = ?
    `)
    .run(next.scope, next.title.trim() || "未命名 Prompt", next.body, next.assetId ?? "", next.combinationKey ?? "", next.active ? 1 : 0, next.sortOrder, next.updatedAt, id)
  return promptTemplates().find((template) => template.id === id) as PromptTemplate
}

export function deletePromptTemplate(id: string) {
  database().prepare("DELETE FROM prompt_templates WHERE id = ?").run(id)
  return { ok: true }
}

export function getGuardrailConfig(): GuardrailConfig {
  const row = database().prepare("SELECT * FROM guardrail_configs WHERE id = 'default'").get() as Row | undefined
  if (!row) return guardrailSeed
  return mapGuardrailConfig(row)
}

export function updateGuardrailConfig(input: Partial<Omit<GuardrailConfig, "id" | "updatedAt">>) {
  const current = getGuardrailConfig()
  const next = { ...current, ...input, updatedAt: nowMs() }
  database()
    .prepare(`
      UPDATE guardrail_configs
      SET sop = ?, allowed_description = ?, blocked_terms = ?, recommended_prompts = ?, mock_mode = ?, mock_fail_uploads = ?, provider = ?, updated_at = ?
      WHERE id = 'default'
    `)
    .run(
      next.sop,
      next.allowedDescription,
      next.blockedTerms,
      next.recommendedPrompts,
      next.mockMode ? 1 : 0,
      next.mockFailUploads ? 1 : 0,
      next.provider,
      next.updatedAt,
    )
  return getGuardrailConfig()
}

export function listWorkflowConfigs(): WorkflowConfig[] {
  return workflowConfigs()
}

export function getWorkflowConfig(mode: GenerationMode): WorkflowConfig {
  return getWorkflowConfigByMode(mode)
}

export function getWorkflowConfigByMode(mode: WorkflowMode): WorkflowConfig {
  const configured = workflowConfigs()
  return configured.find((workflow) => workflow.mode === mode && workflow.enabled) || configured.find((workflow) => workflow.mode === mode) || workflowSeed.find((workflow) => workflow.mode === mode) || workflowSeed[0]
}

export function updateWorkflowConfig(id: string, patch: Partial<Omit<WorkflowConfig, "id" | "updatedAt">>) {
  const current = workflowConfigs().find((workflow) => workflow.id === id)
  if (!current) throw new Error(`Workflow not found: ${id}`)
  const next: WorkflowConfig = {
    ...current,
    ...patch,
    promptTemplateIds: Array.isArray(patch.promptTemplateIds) ? patch.promptTemplateIds : current.promptTemplateIds,
    nodes: Array.isArray(patch.nodes) ? patch.nodes : current.nodes,
    edges: Array.isArray(patch.edges) ? patch.edges : current.edges,
    maxRetries: Number.isFinite(Number(patch.maxRetries)) ? Math.max(0, Math.min(3, Number(patch.maxRetries))) : current.maxRetries,
    updatedAt: nowMs(),
  }
  database()
    .prepare(`
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
    .run(
      next.id,
      next.mode,
      next.title,
      next.enabled ? 1 : 0,
      next.vehicleCheckEnabled ? 1 : 0,
      next.partCheckEnabled ? 1 : 0,
      next.allowFollowUp ? 1 : 0,
      JSON.stringify(next.promptTemplateIds),
      next.providerId,
      next.fallbackProviderId,
      next.resultCheckEnabled ? 1 : 0,
      next.autoRetryEnabled ? 1 : 0,
      next.maxRetries,
      JSON.stringify(next.nodes),
      JSON.stringify(next.edges),
      next.updatedAt,
    )
  writeAudit("", "admin.workflow.update", { id, mode: next.mode })
  return workflowConfigs().find((workflow) => workflow.id === id) as WorkflowConfig
}

export function createChatSession(title = "New Chat", userId = DEMO_USER_ID): ChatSession {
  const now = nowMs()
  const id = `chat_${crypto.randomUUID().slice(0, 8)}`
  database()
    .prepare("INSERT INTO chat_sessions (id, user_id, title, pinned, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, userId, title, 0, now, now)
  return listChatSessions(userId).find((session) => session.id === id) as ChatSession
}

export function listChatSessions(userId = DEMO_USER_ID): ChatSession[] {
  const rows = database()
    .prepare(`
      SELECT
        chat_sessions.*,
        COUNT(chat_messages.id) AS message_count,
        COALESCE(MAX(chat_messages.content), '') AS preview
      FROM chat_sessions
      LEFT JOIN chat_messages ON chat_messages.session_id = chat_sessions.id
      WHERE chat_sessions.user_id = ?
      GROUP BY chat_sessions.id
      ORDER BY chat_sessions.pinned DESC, chat_sessions.updated_at DESC
    `)
    .all(userId) as Row[]
  return rows.map(mapChatSession)
}

export function getChatMessages(sessionId: string, userId = DEMO_USER_ID): ChatMessage[] {
  ensureChatSession(sessionId, userId)
  const rows = database()
    .prepare("SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at ASC")
    .all(sessionId) as Row[]
  const attachmentsByMessage = chatAttachmentsFor(rows.map((row) => String(row.id)))
  return rows.map((row) => mapChatMessage(row, attachmentsByMessage.get(String(row.id)) ?? []))
}

export function updateChatSession(input: { id: string; userId?: string; pinned?: boolean; title?: string }) {
  const userId = input.userId || DEMO_USER_ID
  const current = ensureChatSession(input.id, userId)
  database()
    .prepare("UPDATE chat_sessions SET title = ?, pinned = ?, updated_at = ? WHERE id = ? AND user_id = ?")
    .run(input.title ?? current.title, (input.pinned ?? current.pinned) ? 1 : 0, nowMs(), input.id, userId)
  return listChatSessions(userId).find((session) => session.id === input.id) as ChatSession
}

export function deleteChatSession(sessionId: string, userId = DEMO_USER_ID) {
  ensureChatSession(sessionId, userId)
  const rows = database().prepare("SELECT id FROM chat_messages WHERE session_id = ?").all(sessionId) as Row[]
  rows.forEach((row) => {
    database().prepare("DELETE FROM chat_attachments WHERE message_id = ?").run(String(row.id))
  })
  database().prepare("DELETE FROM chat_messages WHERE session_id = ?").run(sessionId)
  database().prepare("DELETE FROM chat_sessions WHERE id = ? AND user_id = ?").run(sessionId, userId)
  writeAudit(userId, "chat.session.delete", { sessionId })
  return { ok: true }
}

export function createChatExchange(input: {
  userId?: string
  sessionId?: string
  text: string
  contextMode?: "latest" | "original"
  vehicleAttachment?: Omit<ChatAttachment, "id" | "messageId" | "createdAt" | "type">
  partAttachments: Array<Omit<ChatAttachment, "id" | "messageId" | "createdAt" | "type">>
  guardrail: GuardrailResult
  resultImageUrl: string
  assistantContent?: string
  standardJson?: GenerationStandardJson
}) {
  const userId = input.userId || DEMO_USER_ID
  const session = input.sessionId ? ensureChatSession(input.sessionId, userId) : createChatSession("New Chat", userId)
  const now = nowMs()
  const userMessageId = `msg_${crypto.randomUUID().slice(0, 8)}`
  const assistantMessageId = `msg_${crypto.randomUUID().slice(0, 8)}`
  const status = input.guardrail.allowed ? "allowed" : "blocked"

  database()
    .prepare(`
      INSERT INTO chat_messages
      (id, session_id, role, content, result_image_url, guardrail_status, guardrail_reason, context_mode, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(userMessageId, session.id, "user", input.text, "", status, input.guardrail.reason, input.contextMode || "latest", now)

  if (input.vehicleAttachment) {
    insertChatAttachment(userMessageId, "vehicle", input.vehicleAttachment)
  }
  input.partAttachments.forEach((attachment) => insertChatAttachment(userMessageId, "part", attachment))

  if (input.guardrail.allowed || input.assistantContent) {
    database()
      .prepare(`
        INSERT INTO chat_messages
        (id, session_id, role, content, result_image_url, guardrail_status, guardrail_reason, context_mode, standard_json, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        assistantMessageId,
        session.id,
        "assistant",
        input.assistantContent || "已根据你的车辆和改装需求生成演示效果图。",
        input.resultImageUrl,
        "allowed",
        input.guardrail.reason,
        input.contextMode || "latest",
        input.standardJson ? JSON.stringify(input.standardJson) : "{}",
        now + 1,
      )
    if (input.resultImageUrl) {
      insertChatAttachment(assistantMessageId, "result", {
        url: input.resultImageUrl,
        fileName: "fixed-m3-render.png",
        mime: "image/png",
        size: 0,
      })
    }
  }

  const title = titleFromText(input.text)
  database()
    .prepare("UPDATE chat_sessions SET title = CASE WHEN title = 'New Chat' THEN ? ELSE title END, updated_at = ? WHERE id = ?")
    .run(title, now + 1, session.id)

  return {
    session: listChatSessions(userId).find((item) => item.id === session.id) as ChatSession,
    messages: getChatMessages(session.id, userId),
  }
}

type Row = Record<string, unknown>

function seedCategory(category: PartCategory, row?: Row): PartCategory {
  return {
    ...category,
    label: category.labelEn || category.label,
    labelEn: category.labelEn || category.label,
    labelZh: category.labelZh || category.label,
    sortOrder: Number.isFinite(Number(row?.sort_order)) ? Number(row?.sort_order) : category.sortOrder,
    aliases: normalizeCategoryAliases(category.aliases ?? defaultAliasesForCategory(category.id)),
    chatEnabled: category.chatEnabled ?? defaultChatEnabledForCategory(category.id),
    referenceHighRisk: category.referenceHighRisk ?? defaultReferenceHighRiskForCategory(category.id),
  }
}

function mapCategoryRow(row: Row): PartCategory {
  const id = String(row.id)
  return {
    id,
    label: String(row.label_en || row.label),
    labelEn: String(row.label_en || row.label),
    labelZh: String(row.label_zh || row.label),
    description: String(row.description),
    sortOrder: Number(row.sort_order),
    aliases: normalizeCategoryAliases(safeJson<string[]>(String(row.aliases_json || "[]"), [])),
    chatEnabled: row.chat_enabled === undefined ? true : Number(row.chat_enabled) !== 0,
    referenceHighRisk: row.reference_high_risk === undefined ? defaultReferenceHighRiskForCategory(id) : Number(row.reference_high_risk) !== 0,
  }
}

function seedBrand(brand: PartBrand, row?: Row): PartBrand {
  return {
    ...brand,
    sortOrder: Number.isFinite(Number(row?.sort_order)) ? Number(row?.sort_order) : brand.sortOrder,
    active: row ? Boolean(row.active) : brand.active,
  }
}

function mapBrandRow(row: Row): PartBrand {
  return {
    id: String(row.id),
    categoryId: String(row.category_id),
    label: String(row.label),
    sortOrder: Number(row.sort_order),
    active: Boolean(row.active),
  }
}

function seedAsset(asset: PartAsset, row?: Row): PartAsset {
  const defaultColorPolicy = normalizeColorPolicy(asset.defaultColorPolicy) ?? inferAssetDefaultColorPolicy(asset)
  const allowedColorPolicies = resolveAllowedColorPolicies(asset, defaultColorPolicy)
  return {
    ...asset,
    keywords: normalizeAssetKeywords(asset.keywords || defaultAssetKeywords(asset)),
    imageCrop: asset.imageCrop ?? "",
    active: row ? Boolean(row.active) : asset.active,
    sortOrder: Number.isFinite(Number(row?.sort_order)) ? Number(row?.sort_order) : asset.sortOrder,
    defaultColorPolicy,
    allowedColorPolicies,
    generationReferences: (asset.generationReferences ?? []).map((reference, index) => ({
      ...reference,
      id: reference.id || `${asset.id}-seed-ref-${index + 1}`,
      assetId: asset.id,
      role: normalizeReferenceRole(reference.role),
      view: reference.view || "product",
      priority: Number.isFinite(Number(reference.priority)) ? Number(reference.priority) : index + 1,
      promptHint: reference.promptHint || "",
      uploadToModel: reference.uploadToModel !== false && reference.role !== "avoid_upload",
      active: reference.active !== false,
      createdAt: reference.createdAt || 0,
    })),
    promptTestStatus: row ? normalizePromptTestStatus(row.prompt_test_status) : asset.promptTestStatus ?? "untested",
    generationReady: row ? Boolean(row.generation_ready) : asset.generationReady ?? false,
    badCaseNotes: row ? String(row.bad_case_notes ?? "") : asset.badCaseNotes ?? "",
    recommendedViews: row ? safeJson<string[]>(String(row.recommended_views_json || "[]"), asset.recommendedViews ?? []) : asset.recommendedViews ?? [],
  }
}

function mapAssetRow(row: Row, references: Map<string, PartAssetReference[]>): PartAsset {
  const base = {
    id: String(row.id),
    categoryId: String(row.category_id),
    brand: String(row.brand),
    model: String(row.model),
    variant: String(row.variant),
    keywords: normalizeAssetKeywords(String(row.keywords || "")) || defaultAssetKeywords({
      id: String(row.id),
      brand: String(row.brand),
      model: String(row.model),
      variant: String(row.variant),
    }),
    color: String(row.color),
    finish: String(row.finish),
    promptHint: String(row.prompt_hint),
  }
  const defaultColorPolicy = normalizeColorPolicy(row.default_color_policy) ?? inferAssetDefaultColorPolicy(base)
  return {
    ...base,
    brandId: String(row.brand_id || ensureBrand(String(row.category_id), String(row.brand))),
    imageUrl: String(row.image_url),
    imageCrop: String(row.image_crop ?? ""),
    active: Boolean(row.active),
    sortOrder: Number(row.sort_order || 0),
    defaultColorPolicy,
    allowedColorPolicies: resolveAllowedColorPolicies(
      { ...base, allowedColorPolicies: safeJson<PartColorPolicy[]>(String(row.allowed_color_policies_json || "[]"), []) },
      defaultColorPolicy,
    ),
    generationReferences: references.get(String(row.id)) ?? [],
    promptTestStatus: normalizePromptTestStatus(row.prompt_test_status),
    generationReady: Boolean(row.generation_ready),
    badCaseNotes: String(row.bad_case_notes ?? ""),
    recommendedViews: safeJson<string[]>(String(row.recommended_views_json || "[]"), []),
  }
}

function mapProviderRow(row?: Row, fallback?: ProviderConfig): ProviderConfig {
  if (!row) return fallback as ProviderConfig
  return {
    id: row.id as ProviderId,
    label: String(row.label || fallback?.label || ""),
    baseUrl: String(row.base_url || fallback?.baseUrl || ""),
    modelName: String(row.model_name || fallback?.modelName || ""),
    capabilities: safeJson<ProviderConfig["capabilities"]>(String(row.capabilities_json || ""), fallback?.capabilities ?? ["image_generation"]),
    enabled: Boolean(row.enabled),
    active: Boolean(row.active),
    hasApiKey: Boolean(row.api_key_masked),
    maskedKey: String(row.api_key_masked ?? ""),
    updatedAt: Number(row.updated_at || fallback?.updatedAt || 0),
  }
}

function mapPromptPresetRow(row: Row): PromptPreset {
  return {
    id: String(row.id),
    title: String(row.title),
    version: String(row.version),
    body: String(row.body),
    negativePrompt: String(row.negative_prompt),
    active: Boolean(row.active),
    createdAt: Number(row.created_at),
  }
}

function mapPromptTemplateRow(row: Row): PromptTemplate {
  return {
    id: String(row.id),
    scope: row.scope as PromptTemplateScope,
    title: String(row.title),
    body: String(row.body),
    assetId: String(row.asset_id || ""),
    combinationKey: String(row.combination_key || ""),
    active: Boolean(row.active),
    sortOrder: Number(row.sort_order || 0),
    updatedAt: Number(row.updated_at),
  }
}

function mergeWorkflowOverride(seed: WorkflowConfig, row?: Row): WorkflowConfig {
  if (!row) return seed
  const override = mapWorkflowConfig(row)
  const overrideNodes = new Map(override.nodes.map((node) => [node.id, node]))
  const nodes = seed.nodes.map((seedNode) => {
    const source = overrideNodes.get(seedNode.id)
    if (!source) return seedNode
    return {
      ...seedNode,
      enabled: source.enabled,
      providerId: workflowProviderOverride(source.providerId, seedNode.providerId),
      fallbackProviderId: workflowFallbackProviderOverride(source.fallbackProviderId, seedNode.fallbackProviderId),
      promptTemplateId: source.promptTemplateId || seedNode.promptTemplateId,
      failureStrategy: source.failureStrategy || seedNode.failureStrategy,
      maxRetries: Number.isFinite(Number(source.maxRetries)) ? Math.max(0, Number(source.maxRetries)) : seedNode.maxRetries,
      config: { ...seedNode.config, ...(source.config ?? {}) },
    }
  })
  return {
    ...seed,
    enabled: override.enabled,
    vehicleCheckEnabled: override.vehicleCheckEnabled,
    partCheckEnabled: override.partCheckEnabled,
    allowFollowUp: override.allowFollowUp,
    promptTemplateIds: Array.from(new Set([...seed.promptTemplateIds, ...override.promptTemplateIds])),
    providerId: workflowProviderOverride(override.providerId, seed.providerId),
    fallbackProviderId: workflowFallbackProviderOverride(override.fallbackProviderId, seed.fallbackProviderId),
    resultCheckEnabled: override.resultCheckEnabled,
    autoRetryEnabled: override.autoRetryEnabled,
    maxRetries: Number.isFinite(Number(override.maxRetries)) ? override.maxRetries : seed.maxRetries,
    nodes,
    edges: seed.edges,
    updatedAt: override.updatedAt,
  }
}

function workflowProviderOverride(value: ProviderId | "", fallback: ProviderId | ""): ProviderId | "" {
  if (!value) return fallback
  if (value !== fallback && (value === "mock" || value === "mock-vision" || value === "mock-llm")) return fallback
  return value
}

function workflowFallbackProviderOverride(value: ProviderId | "", fallback: ProviderId | ""): ProviderId | "" {
  if (!value) return fallback
  if (value === "mock" && !fallback) return fallback
  return value
}

function categories() {
  const rows = database().prepare("SELECT * FROM asset_categories ORDER BY sort_order ASC").all() as Row[]
  const rowById = new Map(rows.map((row) => [String(row.id), row]))
  return [
    ...categoriesSeed.map((category) => seedCategory(category, rowById.get(category.id))),
    ...rows.filter((row) => !systemCategoryIds.has(String(row.id))).map(mapCategoryRow),
  ].toSorted((a, b) => a.sortOrder - b.sortOrder)
}

function brands(): PartBrand[] {
  const rows = database().prepare("SELECT * FROM asset_brands ORDER BY category_id ASC, sort_order ASC, label ASC").all() as Row[]
  const rowById = new Map(rows.map((row) => [String(row.id), row]))
  return [
    ...brandsSeed.map((brand) => seedBrand(brand, rowById.get(brand.id))),
    ...rows.filter((row) => !systemBrandIds.has(String(row.id))).map(mapBrandRow),
  ].toSorted((a, b) => a.categoryId.localeCompare(b.categoryId) || a.sortOrder - b.sortOrder || a.label.localeCompare(b.label))
}

function assets(): PartAsset[] {
  const rows = database().prepare("SELECT * FROM part_assets ORDER BY category_id ASC, brand_id ASC, sort_order ASC, created_at ASC").all() as Row[]
  const rowById = new Map(rows.map((row) => [String(row.id), row]))
  const references = assetReferencesByAssetId()
  return [
    ...assetsSeed.map((asset) => seedAsset(asset, rowById.get(asset.id))),
    ...rows.filter((row) => !systemAssetIds.has(String(row.id))).map((row) => mapAssetRow(row, references)),
  ].toSorted((a, b) => a.categoryId.localeCompare(b.categoryId) || a.brandId.localeCompare(b.brandId) || a.sortOrder - b.sortOrder)
}

function assetReferencesByAssetId(): Map<string, PartAssetReference[]> {
  const rows = database()
    .prepare("SELECT * FROM part_asset_references ORDER BY asset_id ASC, priority ASC, created_at ASC")
    .all() as Row[]
  const references = new Map<string, PartAssetReference[]>()
  rows.forEach((row) => {
    const assetId = String(row.asset_id)
    const item: PartAssetReference = {
      id: String(row.id),
      assetId,
      url: String(row.url),
      role: normalizeReferenceRole(row.role),
      view: String(row.view || "product"),
      priority: Number(row.priority || 0),
      promptHint: String(row.prompt_hint || ""),
      uploadToModel: Boolean(row.upload_to_model),
      active: Boolean(row.active),
      createdAt: Number(row.created_at || 0),
    }
    references.set(assetId, [...(references.get(assetId) ?? []), item])
  })
  return references
}

function providers(): ProviderConfig[] {
  const rows = database().prepare("SELECT * FROM provider_configs ORDER BY id ASC").all() as Row[]
  const rowById = new Map(rows.map((row) => [String(row.id), row]))
  const hasDbActiveProvider = rows.some((row) => Boolean(row.active))
  return [
    ...providerSeed.map((provider) => mapProviderRow(rowById.get(provider.id), hasDbActiveProvider && !rowById.has(provider.id) ? { ...provider, active: false } : provider)),
    ...rows.filter((row) => !systemProviderIds.has(String(row.id))).map((row) => mapProviderRow(row)),
  ].toSorted((a, b) => a.id.localeCompare(b.id))
}

function prompts(): PromptPreset[] {
  const rows = database().prepare("SELECT * FROM prompt_presets ORDER BY created_at DESC").all() as Row[]
  const customPrompts = rows.filter((row) => String(row.id) !== promptSeed.id).map(mapPromptPresetRow)
  return [
    { ...promptSeed, active: !customPrompts.some((prompt) => prompt.active) },
    ...customPrompts,
  ].toSorted((a, b) => Number(b.active) - Number(a.active) || b.createdAt - a.createdAt)
}

function activePrompt() {
  return prompts().find((prompt) => prompt.active) ?? promptSeed
}

function promptTemplates(): PromptTemplate[] {
  const rows = database().prepare("SELECT * FROM prompt_templates ORDER BY scope ASC, sort_order ASC, updated_at DESC").all() as Row[]
  return [
    ...promptTemplateSeed.map((template) => ({ ...template, updatedAt: 0 })),
    ...rows.filter((row) => !systemPromptTemplateIds.has(String(row.id))).map(mapPromptTemplateRow),
  ].toSorted((a, b) => a.scope.localeCompare(b.scope) || a.sortOrder - b.sortOrder || b.updatedAt - a.updatedAt)
}

function workflowConfigs(): WorkflowConfig[] {
  const rows = database().prepare("SELECT * FROM workflow_configs ORDER BY mode ASC, updated_at DESC").all() as Row[]
  const rowById = new Map(rows.map((row) => [String(row.id), row]))
  const systemWorkflows = workflowSeed.map((workflow) => mergeWorkflowOverride(workflow, rowById.get(workflow.id)))
  const customWorkflows = rows.filter((row) => !systemWorkflowIds.has(String(row.id))).map(mapWorkflowConfig)
  return normalizeWorkflowConfigs([...systemWorkflows, ...customWorkflows])
}

function normalizeWorkflowConfigs(workflows: WorkflowConfig[]) {
  return workflows
    .map((workflow) => (workflow.mode === "chat" ? normalizeChatWorkflowConfig(workflow, workflows) : workflow))
    .map(normalizeWorkflowDisplayCopy)
}

const legacyWorkflowTitleCopy: Record<string, string> = {
  "图片识别 / 输入检测工作流": "图片识别 / 输入检测 Workflow",
  "配置模式生图工作流": "配置模式生图 Workflow",
  "对话模式生图工作流": "对话模式生图 Workflow",
}

const legacyWorkflowNodeLabelCopy: Record<string, string> = {
  Start: "开始",
  "Input validation": "输入校验",
  "Vehicle detection": "车辆识别",
  "Part reference detection": "配件识别",
  "Build JSON": "标准 JSON 组装",
  "Prompt Builder": "提示词组装",
  "Prompt 组装": "提示词组装",
  "Image generation": "生图 / 修图",
  "Result check": "结果检查",
  "Repair retry": "修复重试",
  "Save record": "保存记录",
  End: "结束",
  "LLM 兜底解析": "大模型兜底解析",
}

const legacyWorkflowNodeDescriptionCopy: Record<string, string> = {
  "Validate vehicle image and request scope.": "校验车辆图片、上传内容和识别范围。",
  "Identify the source vehicle and camera view.": "识别原车车型、车身姿态和拍摄视角。",
  "Identify uploaded part reference category and usable views.": "识别上传配件参考图的类别、可用视角和关键视觉特征。",
  "Build standard JSON from configuration selections.": "根据配置选择组装标准 JSON。",
  "Build Effective Prompt v1 from base, config, category, part, combo, and negative templates.": "从基础、配置、分类、配件、组合和负面模板组装最终生图提示词。",
  "Render the configured vehicle edit.": "调用图像模型生成配置好的车辆改装效果。",
  "Check that selected parts appeared and unselected parts stayed unchanged.": "检查已选配件是否出现，未选择区域是否保持不变。",
  "Create one repair prompt if the result misses selected modifications.": "当结果缺少已选改装项时，生成一次修复提示词。",
  "调用视觉 provider 识别原车和相机视角。若画布已有识别结果可复用；Chat Mode 不把识别车型当成最终身份。": "调用视觉模型识别原车和相机视角。若画布已有识别结果可复用；对话模式不把识别车型当成最终身份。",
  "调用视觉 provider 识别上传配件参考图的类别和视觉特征；识别结果仍会回到本地规则校验。": "调用视觉模型识别上传配件参考图的类别和视觉特征；识别结果仍会回到本地规则校验。",
  "本地组装 Chat Mode 的 Effective Prompt v1，并应用保护项、参考图分配和 provider 预算。": "本地组装对话模式的最终生图提示词，并应用保护项、参考图分配和模型预算。",
  "调用图像生成 provider 执行车辆改装效果生成。fallback provider 会按自身参考图预算重新选择上传图片。": "调用图像生成模型执行车辆改装效果生成。备用模型会按自身参考图预算重新选择上传图片。",
  "mock/local 只做本地轻量检查：是否有结果图、是否有可见修改需求。切换真实 vision provider 后，才会对比原图和结果图检查颜色、配件、车高和保护项。": "本地模拟只做轻量检查：是否有结果图、是否有可见修改需求。切换真实视觉模型后，才会对比原图和结果图检查颜色、配件、车高和保护项。",
}

function normalizeWorkflowDisplayCopy(workflow: WorkflowConfig): WorkflowConfig {
  return {
    ...workflow,
    title: legacyWorkflowTitleCopy[workflow.title] ?? workflow.title,
    nodes: workflow.nodes.map((node) => ({
      ...node,
      label: legacyWorkflowNodeLabelCopy[node.label] ?? node.label,
      description: legacyWorkflowNodeDescriptionCopy[node.description] ?? node.description,
    })),
  }
}

function normalizeChatWorkflowConfig(workflow: WorkflowConfig, workflows: WorkflowConfig[]): WorkflowConfig {
  const seed = workflowSeed.find((item) => item.mode === "chat")
  if (!seed) return workflow

  const recognitionWorkflow = workflows.find((item) => item.mode === "recognition")
  const recognitionNodesByType = new Map((recognitionWorkflow?.nodes ?? []).map((node) => [node.type, node]))
  const currentNodesById = new Map(workflow.nodes.map((node) => [node.id, node]))
  const mergedNodes = seed.nodes.map((seedNode) => {
    const existing = currentNodesById.get(seedNode.id)
    const recognitionSource =
      !existing && (seedNode.type === "vehicle_detection" || seedNode.type === "part_detection")
        ? recognitionNodesByType.get(seedNode.type)
        : undefined
    const source = existing ?? recognitionSource
    return {
      ...seedNode,
      enabled: source?.enabled ?? seedNode.enabled,
      providerId: source?.providerId || seedNode.providerId,
      fallbackProviderId: source?.fallbackProviderId || seedNode.fallbackProviderId,
      promptTemplateId: source?.promptTemplateId || seedNode.promptTemplateId,
      failureStrategy: source?.failureStrategy || seedNode.failureStrategy,
      maxRetries: Number.isFinite(Number(source?.maxRetries)) ? Math.max(0, Number(source?.maxRetries)) : seedNode.maxRetries,
      config: { ...seedNode.config, ...(source?.config ?? {}) },
    }
  })

  return {
    ...workflow,
    promptTemplateIds: Array.from(new Set([...seed.promptTemplateIds, ...workflow.promptTemplateIds])),
    vehicleCheckEnabled: mergedNodes.some((node) => node.type === "vehicle_detection" && node.enabled),
    partCheckEnabled: mergedNodes.some((node) => node.type === "part_detection" && node.enabled),
    allowFollowUp: mergedNodes.some((node) => node.type === "follow_up_gate" && node.enabled),
    resultCheckEnabled: mergedNodes.some((node) => node.type === "result_check" && node.enabled),
    autoRetryEnabled: mergedNodes.some((node) => node.type === "retry" && node.enabled && node.config?.qualityFailurePolicy === "repair_once"),
    maxRetries: mergedNodes.find((node) => node.type === "retry")?.maxRetries ?? workflow.maxRetries,
    nodes: mergedNodes,
    edges: seed.edges,
  }
}

function membershipPlans(): MembershipPlan[] {
  const rows = database().prepare("SELECT * FROM membership_plans ORDER BY sort_order ASC").all() as Row[]
  return rows.map((row) => ({
    id: row.id as MembershipPlanId,
    label: String(row.label),
    priceCents: Number(row.price_cents),
    configLimit: Number(row.config_limit),
    chatDailyLimit: Number(row.chat_daily_limit),
    configUnlimited: Boolean(row.config_unlimited),
    chatUnlimited: Boolean(row.chat_unlimited),
    chatEnabled: Boolean(row.chat_enabled),
    active: Boolean(row.active),
    sortOrder: Number(row.sort_order),
    updatedAt: Number(row.updated_at),
  }))
}

function activeSubscription(userId: string): Subscription | undefined {
  const row = database()
    .prepare("SELECT * FROM subscriptions WHERE user_id = ? AND status = 'active' AND current_period_end > ? ORDER BY updated_at DESC LIMIT 1")
    .get(userId, nowMs()) as Row | undefined
  return row ? mapSubscription(row) : undefined
}

function paymentOrders(userId: string): PaymentOrder[] {
  const rows = database().prepare("SELECT * FROM payment_orders WHERE user_id = ? ORDER BY created_at DESC").all(userId) as Row[]
  return rows.map((row) => ({
    id: String(row.id),
    userId: String(row.user_id),
    planId: row.plan_id as MembershipPlanId,
    method: row.method as PaymentOrder["method"],
    status: row.status as PaymentOrder["status"],
    amountCents: Number(row.amount_cents),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  }))
}

function mapWorkflowConfig(row: Row): WorkflowConfig {
  return {
    id: String(row.id),
    mode: String(row.mode || "config") as WorkflowConfig["mode"],
    title: String(row.title),
    enabled: Boolean(row.enabled),
    vehicleCheckEnabled: Boolean(row.vehicle_check_enabled),
    partCheckEnabled: Boolean(row.part_check_enabled),
    allowFollowUp: Boolean(row.allow_follow_up),
    promptTemplateIds: safeJson<string[]>(String(row.prompt_template_ids_json || "[]"), []),
    providerId: String(row.provider_id || "mock") as ProviderId,
    fallbackProviderId: String(row.fallback_provider_id || "") as WorkflowConfig["fallbackProviderId"],
    resultCheckEnabled: Boolean(row.result_check_enabled),
    autoRetryEnabled: Boolean(row.auto_retry_enabled),
    maxRetries: Number(row.max_retries || 0),
    nodes: safeJson<WorkflowConfig["nodes"]>(String(row.nodes_json || "[]"), []),
    edges: safeJson<WorkflowConfig["edges"]>(String(row.edges_json || "[]"), []),
    updatedAt: Number(row.updated_at),
  }
}

function mapBadCase(row: Row): GenerationBadCase {
  return {
    id: String(row.id),
    generationId: String(row.generation_id),
    userId: String(row.user_id),
    mode: String(row.mode || "config") as GenerationMode,
    badCaseType: String(row.bad_case_type),
    summary: String(row.summary),
    standardJson: safeJson<GenerationStandardJson | null>(String(row.standard_json || "null"), null),
    resultCheck: safeJson<ResultCheckResult | null>(String(row.result_check_json || "null"), null),
    createdAt: Number(row.created_at),
  }
}

function mapSubscription(row: Row): Subscription {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    planId: row.plan_id as MembershipPlanId,
    status: row.status as Subscription["status"],
    currentPeriodEnd: Number(row.current_period_end),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  }
}

function mapAccountMessage(row: Row): AccountMessage {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    kind: String(row.kind || "system") as AccountMessageKind,
    title: String(row.title || ""),
    body: String(row.body || ""),
    metadata: safeJson<Record<string, unknown>>(String(row.metadata_json || "{}"), {}),
    readAt: Number(row.read_at || 0),
    createdAt: Number(row.created_at || 0),
  }
}

function mapGuardrailConfig(row: Row): GuardrailConfig {
  return {
    id: "default",
    sop: String(row.sop),
    allowedDescription: String(row.allowed_description),
    blockedTerms: String(row.blocked_terms),
    recommendedPrompts: String(row.recommended_prompts || guardrailSeed.recommendedPrompts),
    mockMode: Boolean(row.mock_mode),
    mockFailUploads: Boolean(row.mock_fail_uploads),
    provider: String(row.provider || "mock") as GuardrailConfig["provider"],
    updatedAt: Number(row.updated_at),
  }
}

function ensureBrand(categoryId: string, label: string) {
  const cleanLabel = label.trim() || "Custom"
  const existing = database()
    .prepare("SELECT id FROM asset_brands WHERE category_id = ? AND lower(label) = lower(?) LIMIT 1")
    .get(categoryId, cleanLabel) as Row | undefined
  if (existing) return String(existing.id)
  const id = `${categoryId}-${slug(cleanLabel)}`
  const row = database().prepare("SELECT COALESCE(MAX(sort_order), 0) + 10 AS sort_order FROM asset_brands WHERE category_id = ?").get(categoryId) as Row
  database()
    .prepare("INSERT OR IGNORE INTO asset_brands (id, category_id, label, sort_order, active) VALUES (?, ?, ?, ?, ?)")
    .run(id, categoryId, cleanLabel, Number(row.sort_order || 10), 1)
  return id
}

function ensureChatSession(sessionId: string, userId = DEMO_USER_ID): ChatSession {
  const session = listChatSessions(userId).find((item) => item.id === sessionId)
  if (!session) throw new Error(`Chat session not found: ${sessionId}`)
  return session
}

function insertChatAttachment(
  messageId: string,
  type: ChatAttachment["type"],
  attachment: Omit<ChatAttachment, "id" | "messageId" | "createdAt" | "type">,
) {
  database()
    .prepare(`
      INSERT INTO chat_attachments
      (id, message_id, type, url, file_name, mime, size, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      `att_${crypto.randomUUID().slice(0, 8)}`,
      messageId,
      type,
      attachment.url,
      attachment.fileName,
      attachment.mime,
      attachment.size,
      nowMs(),
    )
}

function chatAttachmentsFor(messageIds: string[]) {
  const map = new Map<string, ChatAttachment[]>()
  if (!messageIds.length) return map
  const placeholders = messageIds.map(() => "?").join(",")
  const rows = database()
    .prepare(`SELECT * FROM chat_attachments WHERE message_id IN (${placeholders}) ORDER BY created_at ASC`)
    .all(...messageIds) as Row[]
  rows.forEach((row) => {
    const attachment = mapChatAttachment(row)
    const items = map.get(attachment.messageId) ?? []
    items.push(attachment)
    map.set(attachment.messageId, items)
  })
  return map
}

function mapChatSession(row: Row): ChatSession {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    title: String(row.title),
    pinned: Boolean(row.pinned),
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
    messageCount: Number(row.message_count || 0),
    preview: String(row.preview || ""),
  }
}

function mapChatMessage(row: Row, attachments: ChatAttachment[]): ChatMessage {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    role: row.role as ChatMessage["role"],
    content: String(row.content),
    resultImageUrl: String(row.result_image_url || ""),
    guardrailStatus: row.guardrail_status as ChatMessage["guardrailStatus"],
    guardrailReason: String(row.guardrail_reason || ""),
    contextMode: String(row.context_mode || "latest") as ChatMessage["contextMode"],
    standardJson: safeJson<GenerationStandardJson | null>(String(row.standard_json || "null"), null),
    createdAt: Number(row.created_at),
    attachments,
  }
}

function mapChatAttachment(row: Row): ChatAttachment {
  return {
    id: String(row.id),
    messageId: String(row.message_id),
    type: row.type as ChatAttachment["type"],
    url: String(row.url),
    fileName: String(row.file_name),
    mime: String(row.mime),
    size: Number(row.size),
    createdAt: Number(row.created_at),
  }
}

function safeJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function normalizeCategoryAliases(value: unknown) {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\n,，、;；]/)
      : []
  const seen = new Set<string>()
  return raw
    .map((item) => String(item || "").trim())
    .filter((item) => {
      const key = item.toLowerCase()
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
}

function mapGeneration(row: Row): GenerationJob {
  return {
    id: String(row.id),
    status: row.status as GenerationJob["status"],
    mode: String(row.mode || "config") as GenerationMode,
    userId: String(row.user_id),
    provider: row.provider as ProviderId,
    vehicleUploadId: String(row.vehicle_upload_id),
    sourceImageUrl: String(row.source_image_url),
    resultImageUrl: String(row.result_image_url),
    paintId: String(row.paint_id),
    stance: Number(row.stance),
    selections: safeJson<SelectionMap>(String(row.selections_json || "{}"), {}),
    selectionOptions: safeJson<PartSelectionOptions>(String(row.selection_options_json || "{}"), {}),
    standardJson: safeJson<GenerationStandardJson | null>(String(row.standard_json || "null"), null),
    workflowId: String(row.workflow_id || ""),
    promptVersion: String(row.prompt_version || ""),
    promptSummary: String(row.prompt_summary),
    promptHidden: String(row.prompt_hidden),
    resultCheck: safeJson<ResultCheckResult | null>(String(row.result_check_json || "null"), null),
    retryCount: Number(row.retry_count || 0),
    failureReason: String(row.failure_reason || ""),
    costCents: Number(row.cost_cents || 0),
    badCaseTags: safeJson<string[]>(String(row.bad_case_tags_json || "[]"), []),
    usageUnits: Number(row.usage_units),
    createdAt: Number(row.created_at),
  }
}

function mapAuthUser(row: Row): AuthUser {
  return {
    id: String(row.id),
    username: String(row.username || row.id),
    name: String(row.name || row.username || row.id),
    email: String(row.email || ""),
    phone: String(row.phone || ""),
    role: String(row.role || "user") as AuthUser["role"],
    plan: String(row.plan || "free") as AuthUser["plan"],
    createdAt: Number(row.created_at || 0),
  }
}

function auditLogs(): AuditLog[] {
  const rows = database().prepare("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100").all() as Row[]
  return rows.map((row) => ({
    id: String(row.id),
    userId: String(row.user_id || ""),
    action: String(row.action),
    metadata: String(row.metadata || "{}"),
    createdAt: Number(row.created_at),
  }))
}

function writeAudit(userId: string, action: string, metadata: Record<string, unknown>) {
  database()
    .prepare("INSERT INTO audit_logs (id, user_id, action, metadata, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(`audit_${crypto.randomUUID().slice(0, 8)}`, userId, action, JSON.stringify(metadata), nowMs())
}

function assertSameOrderSet(nextIds: string[], currentIds: string[], message: string) {
  if (nextIds.length !== currentIds.length) throw new Error(message)
  const current = new Set(currentIds)
  if (nextIds.some((id) => !current.has(id))) throw new Error(message)
}

function applySortOrder(table: "asset_categories" | "asset_brands" | "part_assets", orderedIds: string[]) {
  const conn = database()
  const statement = conn.prepare(`UPDATE ${table} SET sort_order = ? WHERE id = ?`)
  conn.exec("BEGIN")
  try {
    orderedIds.forEach((id, index) => statement.run((index + 1) * 10, id))
    conn.exec("COMMIT")
  } catch (error) {
    conn.exec("ROLLBACK")
    throw error
  }
}

function countWhere(table: "asset_brands" | "part_assets", column: "category_id" | "brand_id", value: string) {
  const row = database().prepare(`SELECT COUNT(*) AS value FROM ${table} WHERE ${column} = ?`).get(value) as Row
  return Number(row.value || 0)
}

function nextSortOrder(table: "asset_categories" | "asset_brands", categoryId?: string) {
  const row = categoryId
    ? (database().prepare(`SELECT COALESCE(MAX(sort_order), 0) + 10 AS value FROM ${table} WHERE category_id = ?`).get(categoryId) as Row)
    : (database().prepare(`SELECT COALESCE(MAX(sort_order), 0) + 10 AS value FROM ${table}`).get() as Row)
  return Number(row.value || 10)
}

function nextAssetSortOrder(categoryId: string, brandId: string) {
  const row = database()
    .prepare("SELECT COALESCE(MAX(sort_order), 0) + 10 AS value FROM part_assets WHERE category_id = ? AND brand_id = ?")
    .get(categoryId, brandId) as Row
  return Number(row.value || 10)
}

function usageFor(userId: string, mode: "config" | "chat", dateKey: string) {
  const row = database().prepare("SELECT used FROM entitlement_usage WHERE user_id = ? AND mode = ? AND date_key = ?").get(userId, mode, dateKey) as Row | undefined
  return Number(row?.used || 0)
}

function quotaAdjustmentTotal(userId: string, mode: "config" | "chat", dateKey: string) {
  const row = database()
    .prepare("SELECT COALESCE(SUM(delta), 0) AS value FROM quota_adjustments WHERE user_id = ? AND mode = ? AND date_key = ?")
    .get(userId, mode, dateKey) as Row | undefined
  return Number(row?.value || 0)
}

function incrementUsage(userId: string, mode: "config" | "chat", dateKey: string) {
  const id = `usage_ent_${crypto.randomUUID().slice(0, 8)}`
  const now = nowMs()
  database()
    .prepare(`
      INSERT INTO entitlement_usage (id, user_id, mode, date_key, used, updated_at)
      VALUES (?, ?, ?, ?, 1, ?)
      ON CONFLICT(user_id, mode, date_key) DO UPDATE SET used = used + 1, updated_at = excluded.updated_at
    `)
    .run(id, userId, mode, dateKey, now)
}

function decrementUsage(userId: string, mode: "config" | "chat", dateKey: string) {
  const now = nowMs()
  database()
    .prepare(`
      UPDATE entitlement_usage
      SET used = CASE WHEN used > 0 THEN used - 1 ELSE 0 END, updated_at = ?
      WHERE user_id = ? AND mode = ? AND date_key = ?
    `)
    .run(now, userId, mode, dateKey)
}

function todayKey() {
  return new Date().toISOString().slice(0, 10)
}

function scalar(sql: string) {
  const row = database().prepare(sql).get() as Row
  return Number(row.value)
}

function scalarWithParam(sql: string, value: string) {
  const row = database().prepare(sql).get(value) as Row
  return Number(row.value)
}

function titleFromText(text: string) {
  const clean = text.replace(/\s+/g, " ").trim()
  if (!clean) return "New Chat"
  return clean.length > 20 ? `${clean.slice(0, 20)}...` : clean
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || `brand-${crypto.randomUUID().slice(0, 6)}`
}

function nowMs() {
  return Date.now()
}

function normalizePhone(value: string) {
  const raw = value.trim().replace(/\s+/g, "")
  if (!raw) return ""
  if (raw.startsWith("+")) return raw
  return raw.startsWith("86") ? `+${raw}` : `+86${raw}`
}

function assertStrongPassword(value: string) {
  if (value.length < 8 || !/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/[^A-Za-z0-9]/.test(value)) {
    throw new Error("密码不少于8位，且必须包含大小写字母和特殊符号。")
  }
}

function ensureUniqueUser(username: string, phone: string) {
  const row = database()
    .prepare("SELECT id FROM users WHERE lower(username) = lower(?) OR phone = ? LIMIT 1")
    .get(username, phone) as Row | undefined
  if (row) throw new Error("用户名或手机号已注册。")
}

function consumeVerificationCode(input: { phone: string; purpose: string; code: string }) {
  const row = database()
    .prepare(`
      SELECT * FROM verification_codes
      WHERE phone = ? AND purpose = ? AND code = ? AND consumed_at = 0 AND expires_at > ?
      ORDER BY created_at DESC LIMIT 1
    `)
    .get(input.phone, input.purpose, input.code, nowMs()) as Row | undefined
  if (!row) throw new Error("验证码无效或已过期。")
  database().prepare("UPDATE verification_codes SET consumed_at = ? WHERE id = ?").run(nowMs(), String(row.id))
}

function passwordHash(password: string) {
  const salt = randomBytes(8).toString("hex")
  return `${salt}:${hashValue(`${salt}:${password}`)}`
}

function verifyPassword(password: string, stored: string) {
  const [salt, digest] = stored.split(":")
  if (!salt || !digest) return false
  const next = hashValue(`${salt}:${password}`)
  const a = Buffer.from(digest)
  const b = Buffer.from(next)
  return a.length === b.length && timingSafeEqual(a, b)
}

function hashValue(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

function maskKey(value: string) {
  if (value.length <= 8) return "****"
  return `${value.slice(0, 4)}...${value.slice(-4)}`
}

function providerSecretKey() {
  const secret = process.env.CAR_MOD_SECRET || process.env.AUTH_SECRET || "car-mod-effect-studio-local-dev-secret"
  return createHash("sha256").update(secret).digest()
}

function encryptSecret(value: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv("aes-256-gcm", providerSecretKey(), iv)
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`
}

function decryptSecret(value: string) {
  if (!value.startsWith("v1:")) return ""
  try {
    const [, ivValue, tagValue, encryptedValue] = value.split(":")
    if (!ivValue || !tagValue || !encryptedValue) return ""
    const decipher = createDecipheriv("aes-256-gcm", providerSecretKey(), Buffer.from(ivValue, "base64"))
    decipher.setAuthTag(Buffer.from(tagValue, "base64"))
    return Buffer.concat([decipher.update(Buffer.from(encryptedValue, "base64")), decipher.final()]).toString("utf8")
  } catch {
    return ""
  }
}
