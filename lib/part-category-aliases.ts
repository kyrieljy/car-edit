export type PartCategoryAliasSource = {
  id: string
  label?: string
  labelEn?: string
  labelZh?: string
  description?: string
  aliases?: string[]
  chatEnabled?: boolean
  referenceHighRisk?: boolean
}

type BuiltinPartCategoryConfig = PartCategoryAliasSource & {
  aliases: string[]
  chatEnabled: boolean
  referenceHighRisk: boolean
}

export const builtinPartCategoryConfigs: BuiltinPartCategoryConfig[] = [
  {
    id: "wheels",
    aliases: ["wheel", "wheels", "rim", "rims", "alloy", "alloy wheels", "forged wheels", "wheelset", "bbs", "lm-r", "lmr", "轮毂", "轮圈", "钢圈", "铝圈", "车轮", "轮子", "改圈", "换圈"],
    chatEnabled: true,
    referenceHighRisk: false,
  },
  {
    id: "calipers",
    aliases: ["caliper", "calipers", "brake", "brakes", "brake caliper", "brake calipers", "brake kit", "big brake kit", "bbk", "brembo", "ap racing", "rotor", "rotors", "卡钳", "刹车卡钳", "制动卡钳", "刹车套件", "制动套件", "大四活塞", "大六活塞", "刹车盘", "碟盘"],
    chatEnabled: true,
    referenceHighRisk: true,
  },
  {
    id: "rear-wing",
    aliases: ["rear wing", "gt wing", "wing", "spoiler", "rear spoiler", "ducktail", "duck tail", "trunk lip", "trunk spoiler", "decklid spoiler", "swan neck", "尾翼", "鸭尾", "扰流板", "后扰流", "尾箱盖扰流", "行李箱盖扰流"],
    chatEnabled: true,
    referenceHighRisk: true,
  },
  {
    id: "front-bumper",
    aliases: ["front lip", "front splitter", "splitter", "front bumper", "bumper", "front spoiler", "front aero", "front diffuser", "canard", "canards", "前唇", "前铲", "前杠", "前包围", "前保险杠", "前扰流", "前下唇", "前分流器", "风刀", "小风刀"],
    chatEnabled: true,
    referenceHighRisk: true,
  },
  {
    id: "side-skirts",
    aliases: ["side skirt", "side skirts", "skirts", "rocker", "rockers", "rocker panel", "rocker panels", "side lip", "side lips", "side blade", "side blades", "side aero", "侧裙", "侧边裙", "侧裙板", "侧包围", "边裙", "裙边", "门槛", "门槛条", "侧裙延长"],
    chatEnabled: true,
    referenceHighRisk: true,
  },
  {
    id: "diffuser",
    aliases: ["diffuser", "rear diffuser", "rear lip", "rear bumper", "rear valance", "rear aero", "扩散器", "后扩散器", "扩散板", "后扩散板", "后唇", "后下巴", "后包围", "后杠", "后保险杠", "后扰流", "尾部扩散"],
    chatEnabled: true,
    referenceHighRisk: true,
  },
  {
    id: "exhaust",
    aliases: ["exhaust", "muffler", "tailpipe", "tail pipe", "tailpipes", "tail pipes", "exhaust tip", "exhaust tips", "tips", "catback", "cat-back", "downpipe", "down pipe", "排气", "排气管", "尾嘴", "尾喉", "尾段", "中尾段", "阀门排气", "直通排气", "消音鼓"],
    chatEnabled: true,
    referenceHighRisk: true,
  },
  {
    id: "hood",
    aliases: ["hood", "bonnet", "front hood", "carbon hood", "carbon bonnet", "engine hood", "engine cover", "机盖", "引擎盖", "前机盖", "车前盖", "前盖", "发动机盖", "碳盖", "碳纤维机盖", "裸碳机盖", "前舱盖"],
    chatEnabled: true,
    referenceHighRisk: true,
  },
  {
    id: "lights",
    aliases: ["light", "lights", "headlight", "headlights", "tail light", "tail lights", "taillight", "taillights", "lamp", "lamps", "drl", "fog light", "fog lights", "light bar", "brake light", "brake lights", "车灯", "大灯", "头灯", "前灯", "尾灯", "后灯", "刹车灯", "日行灯", "雾灯", "灯膜", "灯罩", "透镜", "灯组", "改灯"],
    chatEnabled: true,
    referenceHighRisk: true,
  },
  {
    id: "wrap",
    aliases: ["wrap", "paint", "color", "colour", "vinyl", "livery", "decal", "decals", "sticker", "stickers", "ppf", "改色", "贴膜", "车衣", "车膜", "喷漆", "烤漆", "拉花", "贴纸", "涂装", "车身膜", "变色膜"],
    chatEnabled: true,
    referenceHighRisk: false,
  },
  {
    id: "mirrors",
    aliases: ["mirror", "mirrors", "side mirror", "side mirrors", "wing mirror", "wing mirrors", "mirror cap", "mirror caps", "carbon mirror", "carbon mirrors", "后视镜", "倒车镜", "反光镜", "外后视镜", "耳朵", "后视镜壳", "镜壳", "牛角镜"],
    chatEnabled: true,
    referenceHighRisk: true,
  },
  {
    id: "grille",
    aliases: ["grille", "grill", "kidney grille", "kidney", "front grille", "mesh grille", "中网", "格栅", "水箱网", "水箱护罩", "双肾", "鼻孔", "进气格栅", "进气口"],
    chatEnabled: true,
    referenceHighRisk: false,
  },
]

const builtinById = new Map(builtinPartCategoryConfigs.map((config) => [config.id, config]))

export function defaultAliasesForCategory(id: string) {
  return builtinById.get(id)?.aliases ?? []
}

export function defaultChatEnabledForCategory(id: string) {
  return builtinById.get(id)?.chatEnabled ?? true
}

export function defaultReferenceHighRiskForCategory(id: string) {
  return builtinById.get(id)?.referenceHighRisk ?? false
}

export function categoryIdsFromAliasText(value: string, categories?: PartCategoryAliasSource[]) {
  const text = normalizeAliasText(value)
  if (!text) return []
  const ids = new Set<string>()
  for (const category of categoryAliasEntries(categories)) {
    if (category.chatEnabled === false) continue
    if (category.aliases.some((alias) => aliasMatches(text, alias))) ids.add(category.id)
  }
  return Array.from(ids)
}

export function categoryIdFromAliasText(value: string, categories?: PartCategoryAliasSource[]) {
  return categoryIdsFromAliasText(value, categories)[0] || ""
}

export function normalizePartCategoryAlias(value: string, categories?: PartCategoryAliasSource[]) {
  const normalized = normalizeAliasText(value)
  if (!normalized) return "unknown"
  if (normalized === "unknown") return "unknown"
  return categoryIdFromAliasText(value, categories) || "unknown"
}

export function referenceHighRiskForCategory(id: string, categories?: PartCategoryAliasSource[]) {
  const category = categories?.find((item) => item.id === id)
  if (category?.referenceHighRisk !== undefined) return Boolean(category.referenceHighRisk)
  return defaultReferenceHighRiskForCategory(id)
}

export function categoryRecognitionList(categories?: PartCategoryAliasSource[]) {
  return categoryAliasEntries(categories)
    .filter((category) => category.chatEnabled !== false)
    .map((category) => category.id)
    .concat("unknown")
    .join(", ")
}

function categoryAliasEntries(categories?: PartCategoryAliasSource[]) {
  const source = categories?.length ? categories : builtinPartCategoryConfigs
  return source.map((category) => {
    const builtin = builtinById.get(category.id)
    const aliases = uniqueStrings([
      category.id,
      category.id.replace(/-/g, " "),
      category.id.replace(/-/g, "_"),
      category.label,
      category.labelEn,
      category.labelZh,
      ...(category.aliases ?? []),
      ...(builtin?.aliases ?? []),
    ])
    return {
      id: category.id,
      chatEnabled: category.chatEnabled ?? builtin?.chatEnabled ?? true,
      aliases,
    }
  })
}

function aliasMatches(normalizedText: string, alias: string) {
  const normalizedAlias = normalizeAliasText(alias)
  if (!normalizedAlias) return false
  if (containsCjk(normalizedAlias)) return normalizedText.includes(normalizedAlias)
  const pattern = new RegExp(`(^|[^a-z0-9])${escapeRegExp(normalizedAlias).replace(/\\ /g, "\\s+")}([^a-z0-9]|$)`, "i")
  return pattern.test(normalizedText)
}

function normalizeAliasText(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[＿_–—-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function containsCjk(value: string) {
  return /[\u3400-\u9fff]/.test(value)
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function uniqueStrings(values: Array<string | undefined>) {
  const seen = new Set<string>()
  return values
    .map((value) => String(value || "").trim())
    .filter((value) => {
      const normalized = normalizeAliasText(value)
      if (!normalized || seen.has(normalized)) return false
      seen.add(normalized)
      return true
    })
}
