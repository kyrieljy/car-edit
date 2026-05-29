import fs from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"
import vm from "node:vm"
import { DatabaseSync } from "node:sqlite"
import ts from "typescript"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const now = Date.now()
const tsModuleCache = new Map()

function readUtf8(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8")
}

function loadTsModule(relativePath) {
  const absolutePath = path.join(root, relativePath)
  const cacheKey = path.normalize(absolutePath)
  const cached = tsModuleCache.get(cacheKey)
  if (cached) return cached.exports

  const module = { exports: {} }
  tsModuleCache.set(cacheKey, module)

  const baseRequire = createRequire(absolutePath)
  const localRequire = (specifier) => {
    if (specifier.startsWith(".")) {
      const resolvedBase = path.resolve(path.dirname(absolutePath), specifier)
      const candidates = [`${resolvedBase}.ts`, `${resolvedBase}.tsx`, path.join(resolvedBase, "index.ts")]
      const candidate = candidates.find((filePath) => fs.existsSync(filePath))
      if (candidate) return loadTsModule(path.relative(root, candidate))
    }
    return baseRequire(specifier)
  }

  const source = fs.readFileSync(absolutePath, "utf8")
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText

  const sandbox = {
    exports: module.exports,
    module,
    require: localRequire,
  }
  vm.runInNewContext(output, sandbox, { filename: path.relative(root, absolutePath) })
  return module.exports
}

function loadCatalogSeeds() {
  return loadTsModule("lib/catalog.ts")
}

function findFunction(sourceFile, name) {
  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name?.text === name) {
      return statement
    }
  }
  throw new Error(`Function not found: ${name}`)
}

function walk(node, visitor) {
  visitor(node)
  node.forEachChild((child) => walk(child, visitor))
}

function literalValue(node, context) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
  if (ts.isNumericLiteral(node)) return Number(node.text)
  if (node.kind === ts.SyntaxKind.TrueKeyword) return true
  if (node.kind === ts.SyntaxKind.FalseKeyword) return false
  if (ts.isArrayLiteralExpression(node)) {
    return node.elements.map((element) => literalValue(element, context))
  }
  if (ts.isPropertyAccessExpression(node)) {
    const objectName = ts.isIdentifier(node.expression) ? node.expression.text : ""
    if (objectName && context[objectName]) return context[objectName][node.name.text]
  }
  throw new Error(`Unsupported seed expression: ${node.getText()}`)
}

function getGenerationPromptRows(sourceFile) {
  const rows = []
  const fn = findFunction(sourceFile, "seedGenerationPromptPack")

  walk(fn, (node) => {
    if (!ts.isVariableDeclaration(node)) return
    if (!ts.isIdentifier(node.name) || node.name.text !== "prompts") return
    if (!node.initializer || !ts.isArrayLiteralExpression(node.initializer)) return

    for (const element of node.initializer.elements) {
      const row = literalValue(element, {})
      if (!Array.isArray(row) || row.length !== 7) {
        throw new Error("Invalid prompt row in seedGenerationPromptPack")
      }
      rows.push(row)
    }
  })

  return rows
}

function getDirectPromptRows(sourceFile, context) {
  const rows = []
  const fn = findFunction(sourceFile, "seedPromptTemplates")

  walk(fn, (node) => {
    if (!ts.isCallExpression(node)) return
    if (!ts.isPropertyAccessExpression(node.expression)) return
    if (node.expression.name.text !== "run") return
    if (!ts.isIdentifier(node.expression.expression) || node.expression.expression.text !== "statement") return
    if (node.arguments.length !== 9) return

    const firstArg = node.arguments[0]
    if (!ts.isStringLiteral(firstArg) || !firstArg.text.startsWith("tpl_")) return

    rows.push(node.arguments.slice(0, 8).map((argument) => literalValue(argument, context)))
  })

  return rows
}

function promptRowsFromSeeds() {
  const catalog = loadCatalogSeeds()
  const rows = catalog.promptTemplateSeed.map((template) => [
    template.id,
    template.scope,
    template.title,
    template.body,
    template.assetId,
    template.combinationKey,
    template.active ? 1 : 0,
    template.sortOrder,
  ])

  catalog.assetsSeed.forEach((asset, index) => {
    rows.push([
      `tpl_part_${asset.id}`,
      "part",
      `${asset.brand} ${asset.model} ${asset.variant}`,
      asset.promptHint,
      asset.id,
      "",
      asset.active ? 1 : 0,
      (index + 1) * 10,
    ])
  })

  catalog.guardrailSeed.recommendedPrompts
    .split(/\r?\n/)
    .map((prompt) => prompt.trim())
    .filter(Boolean)
    .forEach((prompt, index) => {
      rows.push([
        `tpl_chat_rec_${index + 1}`,
        "chat_recommendation",
        `运营推荐示例 ${index + 1}`,
        prompt,
        "",
        "",
        1,
        (index + 1) * 10,
      ])
    })

  return { catalog, rows }
}

function applyPromptPack() {
  const { catalog, rows } = promptRowsFromSeeds()
  const db = new DatabaseSync(path.join(root, "data/car_mod_effect.sqlite"))

  const upsertPreset = db.prepare(`
    INSERT INTO prompt_presets (id, title, version, body, negative_prompt, active, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      version = excluded.version,
      body = excluded.body,
      negative_prompt = excluded.negative_prompt,
      active = excluded.active
  `)

  const upsertTemplate = db.prepare(`
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

  const partAssetColumns = new Set(db.prepare("PRAGMA table_info(part_assets)").all().map((column) => column.name))
  const updateAssetHint =
    partAssetColumns.has("default_color_policy") && partAssetColumns.has("allowed_color_policies_json")
      ? db.prepare("UPDATE part_assets SET prompt_hint = ?, default_color_policy = ?, allowed_color_policies_json = ? WHERE id = ?")
      : db.prepare("UPDATE part_assets SET prompt_hint = ? WHERE id = ?")

  db.exec("BEGIN")
  try {
    const promptSeed = catalog.promptSeed
    const presetResult = upsertPreset.run(
      promptSeed.id,
      promptSeed.title,
      promptSeed.version,
      promptSeed.body,
      promptSeed.negativePrompt,
      promptSeed.active ? 1 : 0,
      promptSeed.createdAt || now,
    )

    let templatesApplied = 0
    for (const row of rows) {
      const [id, scope, title, body, assetId, combinationKey, active, sortOrder] = row
      const result = upsertTemplate.run(id, scope, title, body, assetId, combinationKey, active, sortOrder, now)
      templatesApplied += Number(result.changes ?? 0)
    }

    let assetHintsUpdated = 0
    const missingAssetHints = []
    for (const asset of catalog.assetsSeed) {
      const result =
        partAssetColumns.has("default_color_policy") && partAssetColumns.has("allowed_color_policies_json")
          ? updateAssetHint.run(asset.promptHint, asset.defaultColorPolicy || "part_reference_color", JSON.stringify(asset.allowedColorPolicies || []), asset.id)
          : updateAssetHint.run(asset.promptHint, asset.id)
      const changes = Number(result.changes ?? 0)
      assetHintsUpdated += changes
      if (changes === 0) missingAssetHints.push(asset.id)
    }

    db.exec("COMMIT")
    return {
      preset: promptSeed.id,
      presetApplied: Number(presetResult.changes ?? 0),
      templates: rows.length,
      templatesApplied,
      assetHints: catalog.assetsSeed.length,
      assetHintsUpdated,
      missingAssetHints,
    }
  } catch (error) {
    db.exec("ROLLBACK")
    throw error
  } finally {
    db.close()
  }
}

console.log(JSON.stringify(applyPromptPack(), null, 2))
