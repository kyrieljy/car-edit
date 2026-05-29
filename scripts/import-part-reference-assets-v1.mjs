import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { DatabaseSync } from "node:sqlite"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const sourceManifestPath = path.join(root, "docs", "batch-inputs", "part-references", "multi-ref-v1", "manifest.json")
const publicRoot = path.join(root, "public", "assets", "parts", "references", "multi-ref-v1")
const publishedManifestPath = path.join(root, "data", "part-reference-manifest.v1.json")
const dbPath = path.join(root, "data", "car_mod_effect.sqlite")

const validRoles = new Set(["shape_reference", "material_reference", "color_reference", "install_context", "full_part_reference", "avoid_upload"])

function slug(input) {
  return String(input)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[-\s]+/g, "-")
}

function roleFor(reference) {
  const role = String(reference.role || "")
  if (validRoles.has(role)) return role
  if (role.includes("color")) return "color_reference"
  if (role.includes("install")) return "install_context"
  if (role.includes("material") || role.includes("full")) return "full_part_reference"
  return "shape_reference"
}

function shouldUpload(reference) {
  const assetId = String(reference.assetId)
  const fileName = String(reference.fileName)
  if (String(reference.status) !== "downloaded") return false
  if (assetId === "3m-2080-s261-satin-dark-gray" && fileName.startsWith("03-")) return false
  if (assetId === "vland-f80-smoked-tail-lights" && !/^0[12]-/.test(fileName)) return false
  if (assetId === "ap-racing-yellow" && fileName.startsWith("02-")) return false
  return true
}

function hintFor(reference, normalizedRole, uploadToModel) {
  const assetId = String(reference.assetId)
  const role = String(reference.role || "")
  const common = "Use only the referenced part. Do not inherit donor vehicle body color, wheels, plates, background, text, watermark, lighting graphic, or unrelated objects."
  if (!uploadToModel) return "Catalog/reference-only image. Do not upload to image generation by default."
  if (assetId.startsWith("bbs-lmr") || assetId === "test-bbs-lmr-reference-case") {
    if (role === "shape_sibling_finish") {
      return "Use only BBS LM-R geometry, spoke layout, rim lip depth, and fitment. Do not inherit this sibling finish color; selected finish comes from the priority 1 exact reference."
    }
    if (String(reference.fileName).includes("lineup")) {
      return "Use only LM-R installed stance and wheel scale context. Do not copy the donor car, paint, background, or wheel finish."
    }
    return "Exact selected BBS LM-R finish and shape reference. Preserve the selected wheel finish, spoke geometry, polished lip, and center-cap proportions."
  }
  if (normalizedRole === "install_context") {
    return `Use only part placement, scale, and attachment contour on the vehicle. ${common}`
  }
  if (normalizedRole === "color_reference") {
    return "Use only the material color/finish. Do not render the swatch card, poster, labels, background, or other sample colors."
  }
  if (assetId === "ap-racing-yellow") {
    return "Low-confidence AP Racing Pro 5000 R reference. Use only caliper family shape and machining cues; selected color should remain the configured yellow caliper color."
  }
  return common
}

function ensureBrand(db, categoryId, label) {
  const existing = db
    .prepare("SELECT id FROM asset_brands WHERE category_id = ? AND lower(label) = lower(?) LIMIT 1")
    .get(categoryId, label)
  if (existing?.id) return String(existing.id)

  const baseId = `${categoryId}-${slug(label)}`
  let id = baseId
  let suffix = 2
  while (db.prepare("SELECT id FROM asset_brands WHERE id = ?").get(id)) {
    id = `${baseId}-${suffix}`
    suffix += 1
  }
  const sortRow = db
    .prepare("SELECT COALESCE(MAX(sort_order), 0) + 10 AS sort_order FROM asset_brands WHERE category_id = ?")
    .get(categoryId)
  db.prepare("INSERT INTO asset_brands (id, category_id, label, sort_order, active) VALUES (?, ?, ?, ?, 1)").run(
    id,
    categoryId,
    label,
    Number(sortRow?.sort_order ?? 10),
  )
  return id
}

function ensureKiesSpoilerAsset(db) {
  const id = "f82-m4-kies-carbon-trunk-lip-spoiler"
  if (db.prepare("SELECT id FROM part_assets WHERE id = ?").get(id)) return
  const brandId = ensureBrand(db, "rear-wing", "Kies Motorsports")
  const sortRow = db
    .prepare("SELECT COALESCE(MAX(sort_order), 0) + 10 AS sort_order FROM part_assets WHERE category_id = ?")
    .get("rear-wing")
  db.prepare(`
    INSERT INTO part_assets
      (id, category_id, brand_id, brand, model, variant, keywords, color, finish, image_url, image_crop, active, sort_order, prompt_hint, prompt_test_status, generation_ready, bad_case_notes, recommended_views_json, created_at)
    VALUES
      (?, 'rear-wing', ?, 'Kies Motorsports', 'Performance Inspired Carbon Fiber Trunk Spoiler', 'F82 M4', 'Kies Carbon Trunk Lip Spoiler, F82 M4 Carbon Trunk Lip Spoiler', 'carbon fiber black', 'gloss carbon fiber', ?, '', 1, ?, ?, 'untested', 0, '', '["rear_three_quarter","rear"]', ?)
  `).run(
    id,
    brandId,
    "/assets/parts/test-cases/f82-m4-kies-carbon-trunk-lip-spoiler.jpg",
    Number(sortRow?.sort_order ?? 10),
    "Low-profile F82 M4 trunk lip spoiler. Keep it as a thin continuous carbon lip on the trunk edge; do not create a GT wing or change the vehicle body.",
    Date.now(),
  )
}

const sourceManifest = JSON.parse(await readFile(sourceManifestPath, "utf8"))
const downloaded = sourceManifest.references.filter((reference) => reference.status === "downloaded")
const published = []

for (const reference of downloaded) {
  const sourcePath = path.join(root, reference.localPath)
  const targetPath = path.join(publicRoot, reference.assetId, reference.fileName)
  await mkdir(path.dirname(targetPath), { recursive: true })
  await copyFile(sourcePath, targetPath)

  const normalizedRole = roleFor(reference)
  const uploadToModel = shouldUpload(reference)
  const publicUrl = `/assets/parts/references/multi-ref-v1/${reference.assetId}/${reference.fileName}`
  published.push({
    ...reference,
    url: publicUrl,
    publicPath: path.relative(root, targetPath).replaceAll(path.sep, "/"),
    role: uploadToModel ? normalizedRole : "avoid_upload",
    promptHint: hintFor(reference, normalizedRole, uploadToModel),
    uploadToModel,
    active: true,
  })
}

const db = new DatabaseSync(dbPath)
ensureKiesSpoilerAsset(db)

const assetIds = [...new Set(published.map((reference) => reference.assetId))]
const deleteRefs = db.prepare("DELETE FROM part_asset_references WHERE asset_id = ?")
const insertRef = db.prepare(`
  INSERT INTO part_asset_references
    (id, asset_id, url, role, view, priority, prompt_hint, upload_to_model, active, created_at)
  VALUES
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`)

for (const assetId of assetIds) {
  deleteRefs.run(assetId)
}

const now = Date.now()
for (const reference of published) {
  insertRef.run(
    `${reference.assetId}-multi-ref-v1-${String(reference.priority).padStart(2, "0")}-${slug(reference.fileName).slice(0, 32)}`,
    reference.assetId,
    reference.url,
    reference.role,
    reference.view,
    Number(reference.priority),
    reference.promptHint,
    reference.uploadToModel ? 1 : 0,
    reference.active ? 1 : 0,
    now,
  )
}

db.close()

const grouped = Object.fromEntries(
  assetIds.sort().map((assetId) => {
    const items = published.filter((reference) => reference.assetId === assetId)
    return [
      assetId,
      {
        total: items.length,
        uploadToModel: items.filter((reference) => reference.uploadToModel).length,
        avoidUpload: items.filter((reference) => !reference.uploadToModel).length,
      },
    ]
  }),
)

await writeFile(
  publishedManifestPath,
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      sourceManifest: path.relative(root, sourceManifestPath).replaceAll(path.sep, "/"),
      publicRoot: "public/assets/parts/references/multi-ref-v1",
      grouped,
      references: published,
    },
    null,
    2,
  )}\n`,
)

console.log(`Published ${published.length} references to ${path.relative(root, publicRoot)}`)
console.log(`Imported references for ${assetIds.length} assets`)
console.log(`Wrote ${path.relative(root, publishedManifestPath)}`)
console.log(JSON.stringify(grouped, null, 2))
