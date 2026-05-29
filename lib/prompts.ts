import { assetsSeed, paintsSeed } from "./catalog"
import type { PaintOption, PartAsset, PromptPreset, PromptTemplate, SelectionMap } from "./types"

export function stanceLabel(value: number): string {
  if (value <= 24) return "原厂车高"
  if (value <= 49) return "轻微降低车身"
  if (value <= 74) return "齐平姿态，车身降低，轮胎与轮拱间隙更紧凑"
  return "激进低趴姿态，轮毂齐平，展示车姿高度"
}

export function selectedAssetsFromMap(selections: SelectionMap, assets: PartAsset[] = assetsSeed): PartAsset[] {
  const byId = new Map(assets.map((asset) => [asset.id, asset]))
  return Object.values(selections)
    .map((id) => byId.get(id))
    .filter((asset): asset is PartAsset => Boolean(asset))
}

export function paintFromId(id: string, paints: PaintOption[] = paintsSeed): PaintOption {
  return paints.find((paint) => paint.id === id) ?? paints[0]
}

export function buildHiddenPrompt(options: {
  preset: PromptPreset
  templates?: PromptTemplate[]
  selections: SelectionMap
  assets: PartAsset[]
  paint: PaintOption
  stance: number
  vehicleNote: string
}) {
  const selectedAssets = selectedAssetsFromMap(options.selections, options.assets)
  const activeTemplates = (options.templates ?? []).filter((template) => template.active)
  const configBase = activeTemplates.filter((template) => template.scope === "config_base").sort((a, b) => a.sortOrder - b.sortOrder)
  const negativeTemplates = activeTemplates.filter((template) => template.scope === "negative").sort((a, b) => a.sortOrder - b.sortOrder)
  const selectedIds = new Set(selectedAssets.map((asset) => asset.id))
  const selectedCategories = new Set(selectedAssets.map((asset) => asset.categoryId))
  const partLines = selectedAssets.map((asset) => {
    const template = activeTemplates
      .filter((item) => item.scope === "part" && item.assetId === asset.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)[0]
    return `- ${asset.brand} ${asset.model} ${asset.variant}: ${template?.body || asset.promptHint}`
  })
  const comboLines = activeTemplates
    .filter((template) => template.scope === "combo" && comboMatches(template.combinationKey, selectedIds, selectedCategories))
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((template) => `- ${template.title}: ${template.body}`)
  const note = options.vehicleNote.trim() || "用户上传的车辆照片"
  const paintInstruction =
    options.paint.id === "factory" ? "保持原厂车身颜色不变。" : `车身颜色指令：${options.paint.prompt}。`
  const stanceInstruction = `车高姿态指令：${stanceLabel(options.stance)}。`

  const prompt = [
    configBase.length ? configBase.map((template) => template.body).join("\n") : options.preset.body,
    `车辆说明：${note}。`,
    paintInstruction,
    stanceInstruction,
    partLines.length ? `已选配件：\n${partLines.join("\n")}` : "没有选择实体改装配件。",
    comboLines.length ? `组合规则：\n${comboLines.join("\n")}` : "",
    `负面约束：${negativeTemplates.length ? negativeTemplates.map((template) => template.body).join("\n") : options.preset.negativePrompt}`,
  ].join("\n\n")

  const summaryParts = selectedAssets.map((asset) => `${asset.brand} ${asset.model} ${asset.variant}`)
  const summary = [
    options.paint.label,
    stanceLabel(options.stance),
    summaryParts.length ? summaryParts.join(" / ") : "未选择配件",
  ].join(" · ")

  return { prompt, summary }
}

function comboMatches(value: string, selectedIds: Set<string>, selectedCategories: Set<string>) {
  const tokens = value
    .split(/[,\n]/)
    .map((token) => token.trim())
    .filter(Boolean)
  if (!tokens.length) return false
  return tokens.every((token) => selectedIds.has(token) || selectedCategories.has(token))
}
