import path from "node:path"
import { loadTsModule } from "./ts-module-loader.mjs"
import { PROJECT_CONFIG_SCHEMA_VERSION, defaultDbPath, parseArgs, stableStringify, writeJson } from "./project-config-utils.mjs"

const args = parseArgs()
const dbPath = path.resolve(String(args.db || defaultDbPath()))
process.chdir(path.resolve(dbPath, "..", ".."))

const db = loadTsModule("lib/server/db.ts")
const summary = db.getAdminSummary()
const config = projectConfigFromAdminSummary(summary, dbPath)

if (args.out) {
  const outPath = path.resolve(String(args.out))
  writeJson(outPath, config)
  console.log(`Exported project config to ${outPath}`)
} else {
  console.log(stableStringify(config))
}

function projectConfigFromAdminSummary(summary, dbPath) {
  const promptPresets = summary.prompts.map((prompt) => ({
    id: prompt.id,
    title: prompt.title,
    version: prompt.version,
    body: prompt.body,
    negativePrompt: prompt.negativePrompt,
    active: prompt.active,
    createdAt: prompt.createdAt,
  }))
  const providers = summary.providers.map((provider) => ({
    id: provider.id,
    label: provider.label,
    baseUrl: provider.baseUrl,
    modelName: provider.modelName,
    capabilities: provider.capabilities,
    enabled: provider.enabled,
    active: provider.active,
    hasStoredKey: provider.hasApiKey,
    updatedAt: provider.updatedAt,
  }))
  const assets = summary.assets.map((asset) => ({
    id: asset.id,
    categoryId: asset.categoryId,
    brandId: asset.brandId,
    brand: asset.brand,
    model: asset.model,
    variant: asset.variant,
    keywords: asset.keywords || "",
    color: asset.color,
    finish: asset.finish,
    imageUrl: asset.imageUrl,
    imageCrop: asset.imageCrop || "",
    active: asset.active,
    sortOrder: asset.sortOrder,
    promptHint: asset.promptHint,
    defaultColorPolicy: asset.defaultColorPolicy || "part_reference_color",
    allowedColorPolicies: asset.allowedColorPolicies || [],
    promptTestStatus: asset.promptTestStatus || "untested",
    generationReady: Boolean(asset.generationReady),
    badCaseNotes: asset.badCaseNotes || "",
    recommendedViews: asset.recommendedViews || [],
  }))
  const references = summary.assets.flatMap((asset) => asset.generationReferences || []).map((reference) => ({
    id: reference.id,
    assetId: reference.assetId,
    url: reference.url,
    role: reference.role,
    view: reference.view,
    priority: reference.priority,
    promptHint: reference.promptHint,
    uploadToModel: reference.uploadToModel,
    active: reference.active,
    createdAt: reference.createdAt,
  }))
  const workflows = summary.workflows.map((workflow) => ({
    id: workflow.id,
    mode: workflow.mode,
    title: workflow.title,
    enabled: workflow.enabled,
    vehicleCheckEnabled: workflow.vehicleCheckEnabled,
    partCheckEnabled: workflow.partCheckEnabled,
    allowFollowUp: workflow.allowFollowUp,
    promptTemplateIds: workflow.promptTemplateIds,
    providerId: workflow.providerId,
    fallbackProviderId: workflow.fallbackProviderId,
    resultCheckEnabled: workflow.resultCheckEnabled,
    autoRetryEnabled: workflow.autoRetryEnabled,
    maxRetries: workflow.maxRetries,
    nodes: workflow.nodes,
    edges: workflow.edges,
    updatedAt: workflow.updatedAt,
  }))
  return {
    schemaVersion: PROJECT_CONFIG_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    source: {
      dbPath: path.relative(process.cwd(), dbPath).replace(/\\/g, "/"),
      view: "getAdminSummary",
    },
    active: {
      promptPresetId: promptPresets.find((item) => item.active)?.id ?? "",
      promptPresetVersion: promptPresets.find((item) => item.active)?.version ?? "",
      providerId: providers.find((item) => item.active)?.id ?? "",
      workflows: Object.fromEntries(workflows.filter((item) => item.enabled).map((item) => [item.mode, item.id])),
    },
    promptPresets,
    promptTemplates: summary.promptTemplates,
    providers,
    workflows,
    categories: summary.categories,
    brands: summary.brands,
    assets,
    references,
    guardrails: [summary.guardrailConfig],
    membershipPlans: summary.plans,
  }
}
