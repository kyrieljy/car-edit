import crypto from "node:crypto"
import path from "node:path"
import { loadTsModule } from "./ts-module-loader.mjs"
import { loadJson, parseArgs, repoRoot, stableStringify } from "./project-config-utils.mjs"

const args = parseArgs()
const filePath = path.resolve(
  repoRoot(),
  String(args.file || "config/prompt-packs/effective-prompt-v1-2026-05-29.json"),
)

const pack = loadJson(filePath)
const catalog = loadTsModule("lib/catalog.ts")
const generationCore = loadTsModule("lib/generation-core.ts")
const errors = []
const warnings = []

if (!pack || typeof pack !== "object" || Array.isArray(pack)) {
  errors.push("prompt pack must be a JSON object")
} else {
  validateNoSecrets(pack)
  validatePreset(pack.activePromptPreset)
  validateTemplates(pack.promptTemplates)
  validateRequiredRules(pack.explicitRulesToRestore)
  validateRuntimePromptRules()
}

const result = {
  ok: errors.length === 0,
  file: path.relative(repoRoot(), filePath).replace(/\\/g, "/"),
  promptPresetId: pack?.activePromptPreset?.id || "",
  promptPresetVersion: pack?.activePromptPreset?.version || "",
  promptPresetHash: shortHash(pack?.activePromptPreset?.body || ""),
  negativePromptHash: shortHash(pack?.activePromptPreset?.negativePrompt || ""),
  templates: Array.isArray(pack?.promptTemplates) ? pack.promptTemplates.length : 0,
  errors,
  warnings,
}

console.log(stableStringify(result))
if (!result.ok) process.exit(1)

function validatePreset(preset) {
  if (!preset || typeof preset !== "object" || Array.isArray(preset)) {
    errors.push("activePromptPreset is required")
    return
  }
  const seed = catalog.promptSeed
  compare("activePromptPreset.id", preset.id, seed.id)
  compare("activePromptPreset.version", preset.version, seed.version)
  compare("activePromptPreset.bodyHash", shortHash(preset.body), shortHash(seed.body))
  compare("activePromptPreset.negativePromptHash", shortHash(preset.negativePrompt), shortHash(seed.negativePrompt))
}

function validateTemplates(templates) {
  if (!Array.isArray(templates)) {
    errors.push("promptTemplates must be an array")
    return
  }
  const seedTemplates = new Map(catalog.promptTemplateSeed.map((template) => [template.id, template]))
  const packTemplates = new Map(templates.map((template) => [template.id, template]))
  for (const seedTemplate of catalog.promptTemplateSeed) {
    const packTemplate = packTemplates.get(seedTemplate.id)
    if (!packTemplate) {
      errors.push(`missing prompt template ${seedTemplate.id}`)
      continue
    }
    compare(`promptTemplates.${seedTemplate.id}.scope`, packTemplate.scope, seedTemplate.scope)
    compare(`promptTemplates.${seedTemplate.id}.title`, packTemplate.title, seedTemplate.title)
    compare(`promptTemplates.${seedTemplate.id}.bodyHash`, shortHash(packTemplate.body), shortHash(seedTemplate.body))
    compare(`promptTemplates.${seedTemplate.id}.combinationKey`, packTemplate.combinationKey || "", seedTemplate.combinationKey || "")
  }
  for (const packTemplate of templates) {
    if (!seedTemplates.has(packTemplate.id)) warnings.push(`pack contains non-seed prompt template ${packTemplate.id}`)
  }
}

function validateRequiredRules(rules) {
  if (!rules || typeof rules !== "object" || Array.isArray(rules)) {
    errors.push("explicitRulesToRestore is required")
    return
  }
  const requiredKeys = ["vehicleModelSafety", "defaultNoStance", "stancePresets", "hoodBodyColor", "referenceRole"]
  for (const key of requiredKeys) {
    if (!(key in rules)) errors.push(`explicitRulesToRestore.${key} is required`)
  }
}

function validateRuntimePromptRules() {
  const factoryPaint = catalog.paintsSeed.find((paint) => paint.id === "factory") || catalog.paintsSeed[0]
  const standardJson = generationCore.buildConfigStandardJson({
    sourceImageUrl: "/uploads/vehicle-test.jpg",
    selections: {},
    selectionOptions: {},
    assets: catalog.assetsSeed,
    categories: catalog.categoriesSeed,
    paint: factoryPaint,
    stance: 0,
    vehicleNote: "",
  })
  compare("runtime.defaultConfigVehicleModel", standardJson.vehicle.model, "User uploaded vehicle, preserve exact identity")
  compare("runtime.defaultConfigStanceValue", standardJson.stance.value, 0)
  compare("runtime.defaultConfigStancePrompt", standardJson.stance.prompt, "")

  const promptBuild = generationCore.buildGenerationPrompt({
    spec: standardJson,
    preset: catalog.promptSeed,
    templates: catalog.promptTemplateSeed.map((template) => ({ ...template, updatedAt: 0 })),
  })
  if (promptBuild.prompt.includes("## 车身姿态")) {
    errors.push("runtime.defaultConfigPrompt must not include ## 车身姿态 when stance is not requested")
  }
}

function validateNoSecrets(value, pathParts = []) {
  if (!value || typeof value !== "object") return
  if (Array.isArray(value)) {
    value.forEach((item, index) => validateNoSecrets(item, [...pathParts, String(index)]))
    return
  }
  for (const [key, child] of Object.entries(value)) {
    const normalized = key.toLowerCase()
    const fieldPath = [...pathParts, key].join(".")
    if (normalized.includes("apikey") || normalized === "api_key" || normalized.includes("secret") || normalized === "token") {
      errors.push(`secret-like field is not allowed in prompt pack: ${fieldPath}`)
    }
    validateNoSecrets(child, [...pathParts, key])
  }
}

function compare(label, actual, expected) {
  if (actual !== expected) errors.push(`${label} mismatch: expected ${expected}, got ${actual}`)
}

function shortHash(value) {
  return crypto.createHash("sha256").update(String(value || ""), "utf8").digest("hex").slice(0, 16)
}
