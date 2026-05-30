import type {
  ChatFallbackIntent,
  ChatIntentParseResult,
  GenerationPartSpec,
  GenerationStandardJson,
  PaintFinishEffect,
  PaintGradient,
  PaintOption,
  PartAsset,
  PartCategory,
  PartColorPolicy,
  PartSelectionOptions,
  PromptPreset,
  PromptTemplate,
  ResultCheckResult,
  SelectionMap,
} from "./types"
import { categoryIdsFromAliasText } from "./part-category-aliases"

type BuildConfigSpecInput = {
  sourceImageUrl: string
  selections: SelectionMap
  selectionOptions?: PartSelectionOptions
  assets: PartAsset[]
  categories: PartCategory[]
  paint: PaintOption
  paintFinishEffect?: PaintFinishEffect
  paintGradient?: PaintGradient
  stance: number
  vehicleNote: string
  vehicleModel?: string
}

type BuildChatSpecInput = {
  sourceImageUrl: string
  text: string
  contextMode: "latest" | "original"
  partReferences: ChatPartReferenceInput[]
  categories: PartCategory[]
  assets?: PartAsset[]
  vehicleRecognition?: ChatVehicleRecognitionInput
  partColorPolicyChoices?: Record<string, PartColorPolicy>
  previousStandardJson?: GenerationStandardJson | null
  fallbackIntent?: ChatFallbackIntent
}

type ParseChatIntentInput = BuildChatSpecInput & {}

export type ChatVehicleRecognitionInput = {
  model: string
  view?: string
  confidence?: number
}

export type ChatPartReferenceInput = {
  url: string
  fileName: string
  category?: string
  categoryLabel?: string
  brand?: string
  model?: string
  variant?: string
  confidence?: number
  visualFeatures?: string[]
}

export function applyFallbackIntentToChatParseInput(input: BuildChatSpecInput, fallbackIntent: ChatFallbackIntent): BuildChatSpecInput {
  const normalized = normalizeFallbackIntentForInput(fallbackIntent, input)
  if (!normalized) return input
  const referenceCategories = new Map((normalized.uploadedReferenceCategories ?? []).map((item) => [item.fileName, item]))
  return {
    ...input,
    fallbackIntent: normalized,
    partReferences: input.partReferences.map((reference) => {
      const assigned = referenceCategories.get(reference.fileName)
      if (!assigned) return reference
      const category = input.categories.find((item) => item.id === assigned.categoryId)
      if (!category) return reference
      return {
        ...reference,
        category: category.id,
        categoryLabel: categoryLabel(category, category.id),
        confidence: Math.max(reference.confidence ?? 0, assigned.confidence),
      }
    }),
  }
}

type PromptBuildInput = {
  spec: GenerationStandardJson
  preset: PromptPreset
  templates: PromptTemplate[]
}

type TemplateScope = PromptTemplate["scope"]

const rejectedIntentTerms = [
  "portrait",
  "person",
  "people",
  "animal",
  "food",
  "house",
  "building",
  "logo",
  "weapon",
  "人像",
  "人物",
  "动物",
  "食物",
  "建筑",
]

const exposedCarbonPattern = /exposed carbon|bare carbon|visible carbon|carbon hood|carbon bonnet|裸碳|露碳|碳纤维机盖|碳纖維機蓋|碳盖|碳蓋/i
const bodyColorPattern = /body[-\s]?color|paint[-\s]?match|same[-\s]?colou?r|同色|车身同色|車身同色|喷同色|烤漆同色/i
const carbonPattern = /carbon|dry carbon|wet carbon|forged carbon|碳纤|碳纖|碳纹|碳紋|碳盖|碳蓋|裸碳|露碳/i
const explicitExposedCarbonPattern =
  /\b(?:exposed|bare|visible|raw)\s+carbon\b|\b(?:keep|leave)\s+(?:the\s+)?(?:visible\s+)?carbon\b|\u88f8\u78b3|\u9732\u78b3|\u53ef\u89c1\u78b3\u7ea4\u7ef4|\u53ef\u898b\u78b3\u7e96\u7dad|\u4fdd\u7559\u78b3\u7ea4\u7ef4|\u78b3\u7ea4\u7ef4\u7eb9\u7406/i
const MAX_GENERATION_REFERENCES_PER_PART = 4
const MIN_RECOGNIZED_PART_CONFIDENCE = 0.45
const CHAT_FALLBACK_CONFIDENCE = 0.72

type StancePresetId = "stock" | "raise" | "slight_lower" | "flush_lower" | "air_suspension"

const stancePresets: Record<StancePresetId, GenerationStandardJson["stance"]> = {
  stock: { value: 0, label: "保持原车高度", prompt: "" },
  raise: {
    value: 25,
    label: "轻微升高",
    prompt: stancePrompt(
      "相对当前原图轻微升高车身姿态：轻微增加轮胎上沿与轮拱之间的垂直间隙，同时轻微增加侧裙、前唇与地面的离地间隙。保持真实悬挂比例，不做越野升高或夸张抬高。",
    ),
  },
  slight_lower: {
    value: 50,
    label: "轻微降低",
    prompt: stancePrompt(
      "相对当前原图轻微降低车身姿态：明显减少轮胎上沿与轮拱之间的垂直间隙，让车身相对轮胎和地面更低，保持街道可行驶姿态。不要藏轮，不要让翼子板压住轮胎，不要压扁轮胎。",
    ),
  },
  flush_lower: {
    value: 70,
    label: "齐边低趴",
    prompt: stancePrompt(
      "相对当前原图降低到齐边低趴姿态：让轮胎上沿非常接近轮眉，轮拱间隙接近 0 到 1 指宽，形成 flush fitment。轮胎上沿贴近翼子板边缘但不要穿进翼子板，车轮和轮胎必须保持完整圆形。",
    ),
  },
  air_suspension: {
    value: 90,
    label: "气动避震",
    prompt: stancePrompt(
      "相对当前原图改为气动避震 aired-out stance：车身极低，轮眉轻微盖住轮胎上沿，轮胎上半部有清晰 tire tuck 藏轮效果，侧裙和前唇非常接近地面。允许翼子板视觉上轻微压过轮胎上沿，但不要切断轮胎、不要压扁轮胎、不要让轮胎穿进地面。",
    ),
  },
}

const stancePriority: StancePresetId[] = ["air_suspension", "flush_lower", "slight_lower", "raise"]

const stancePatterns: Array<{ id: Exclude<StancePresetId, "stock">; pattern: RegExp }> = [
  {
    id: "air_suspension",
    pattern:
      /\b(?:air\s*suspension|aired\s*out|bagged|slammed|tucked|tire\s*tuck|lay\s*frame)\b|气动|气动避震|气动低趴|趴地|贴地|极低|藏轮|轮胎藏进|轮眉压住|翼子板压住/i,
  },
  {
    id: "flush_lower",
    pattern: /\b(?:flush|flush\s*fitment|fender\s*to\s*lip|fender\s*lip)\b|齐边|齊邊|贴齐|貼齊|轮眉齐边|輪眉齊邊|齐平|齊平/i,
  },
  {
    id: "slight_lower",
    pattern: /\b(?:lower|lowered|lowering|drop|dropped|slightly\s*lower|lower\s+a\s+little)\b|降低|降车身|低一点|低一點|低一些|低一点点|低一點點|低一点兒|低趴/i,
  },
  {
    id: "raise",
    pattern: /\b(?:raise|raised|lift|lifted|higher|increase\s+ride\s*height)\b|升高|抬高|加高|提高车身|提高車身|车身高一点|車身高一點/i,
  },
]

const stanceKeepPattern = /不升高|不要升高|别升高|別升高|不降低|不要降低|别降低|別降低|无需降低|無需降低|保持.{0,6}(车高|車高|高度|姿态|姿態)|原车高度|原車高度|原厂高度|原廠高度|\b(?:keep|preserve|stock|factory)\s+(?:ride\s*)?height\b/i

function stancePrompt(description: string) {
  return [
    description,
    "硬约束：只改变悬挂高度、轮拱间隙、车身相对轮胎和地面的高度关系；不要缩放、拉伸、裁切、平移或重画整辆车；不要移动地面、轮胎接地点、背景、相机角度、车牌、灯、玻璃、轮毂尺寸或轮胎外径；保持车轮圆形、轮胎接地阴影和原图透视真实。",
  ].join(" ")
}

function stancePresetFromValue(value: number): GenerationStandardJson["stance"] {
  const normalized = clampNumber(value, 0, 100)
  if (normalized <= 0) return stanceFromId("stock")
  if (normalized <= 30) return stanceFromId("raise")
  if (normalized <= 55) return stanceFromId("slight_lower")
  if (normalized <= 80) return stanceFromId("flush_lower")
  return stanceFromId("air_suspension")
}

function stanceFromId(id: StancePresetId): GenerationStandardJson["stance"] {
  return { ...stancePresets[id] }
}

function stancePresetIdFromText(text: string): StancePresetId | null {
  if (stanceKeepPattern.test(text)) return null
  const matched = new Set<StancePresetId>()
  for (const item of stancePatterns) {
    if (item.pattern.test(text)) matched.add(item.id)
  }
  return stancePriority.find((id) => matched.has(id)) ?? null
}

function hasStanceDirectionConflict(text: string) {
  if (stanceKeepPattern.test(text)) return false
  const hasRaise = stancePatterns.some((item) => item.id === "raise" && item.pattern.test(text))
  const hasLower = stancePatterns.some((item) => item.id !== "raise" && item.pattern.test(text))
  return hasRaise && hasLower
}

export function hasChatStanceRequestText(text: string) {
  return Boolean(stancePresetIdFromText(text))
}

export function buildGenerationPrompt(input: PromptBuildInput) {
  const activeTemplates = input.templates.filter((template) => template.active)
  const modeScope: TemplateScope = input.spec.mode === "config" ? "config_mode" : "chat_mode"
  const templateBlocks = [
    ...templatesForScope(activeTemplates, "base"),
    ...templatesForScope(activeTemplates, modeScope),
    ...(input.spec.mode === "config" ? templatesForScope(activeTemplates, "config_base") : []),
  ]
  const negative = uniqueTextBlocks([input.preset.negativePrompt, ...templatesByScope(activeTemplates, "negative")]).join("\n")
  const comboTemplates = activeTemplates
    .filter((template) => template.scope === "combo" && comboMatches(template.combinationKey, input.spec))
    .sort((a, b) => a.sortOrder - b.sortOrder)
  const partBlocks = input.spec.parts.map((part, index) => partPromptBlock(part, index, activeTemplates))
  const noPartInstruction =
    input.spec.parts.length === 0
      ? "没有选择配件替换。只执行已请求的车身颜色或车高姿态变化，不要凭空新增外观配件。"
      : ""
  const stanceInstruction = input.spec.stance.prompt.trim()
  const selectedOnlyGuard = input.spec.mode === "config" ? configSelectedOnlyGuard(input.spec) : ""

  const prompt = [
    "# Effective Prompt v1 中文有效版",
    "请对第一张上传的原车照片做真实照片局部编辑。第一张上传图片是唯一原车画布；后续上传图片全部是配件参考图，只能参考已选配件的形状、材质和安装关系，绝对不要继承参考图里的其它车辆、背景、光线、相机角度、轮毂、贴纸或未选择部件。",
    templateBlocks.length ? `## 模板层\n${templateBlocks.map((template) => `### ${template.title}\n${template.body}`).join("\n\n")}` : input.preset.body,
    `## 原车画布\n${JSON.stringify(input.spec.vehicle, null, 2)}`,
    `## 车身颜色\n- 动作: ${input.spec.paint.action}\n- 目标: ${input.spec.paint.target}\n- 指令: ${input.spec.paint.prompt}`,
    stanceInstruction ? `## 车身姿态\n- 数值: ${input.spec.stance.value}\n- 标签: ${input.spec.stance.label}\n- 指令: ${stanceInstruction}` : "",
    partBlocks.length ? `## 已选配件\n${partBlocks.join("\n\n")}` : `## 已选配件\n- ${noPartInstruction}`,
    selectedOnlyGuard,
    comboTemplates.length ? `## 组合规则\n${comboTemplates.map((template) => `- ${template.title}: ${template.body}`).join("\n")}` : "",
    `## 用户请求\n${input.spec.style.userText || "配置模式请求。"}`,
    [
      "## 保留规则",
      "- 必须保留第一张原图中的同一辆车、同一车型、同一车身比例、同一相机角度、同一裁切、同一光照方向、同一反射、同一背景和车牌区域形状。",
      "- 只修改标准 JSON 中已选择的类别。所有未选择配件、轮毂、贴纸、车窗、车门、后视镜、饰条和未选择钣金区域都保持原图。",
      "- 配件比例、透视、遮挡、接触阴影和反光必须符合第一张原车视角。",
      "- 如果某个配件在第一张原车视角中不可见，不要为了展示它而改变相机角度、扩展画面或重画车身另一侧。",
    ].join("\n"),
    `## 负向约束\n${negative}`,
  ]
    .filter(Boolean)
    .join("\n\n")

  const usedTemplateIds = activeTemplates
    .filter((template) => template.body && prompt.includes(template.body))
    .map((template) => template.id)

  return {
    prompt,
    negativePrompt: negative,
    promptVersion: usedTemplateIds.length ? usedTemplateIds.join(",") : input.preset.id,
    summary: summarizeSpec(input.spec),
    usedTemplateIds,
  }
}

function configSelectedOnlyGuard(spec: GenerationStandardJson) {
  const selectedCategories = new Set(spec.parts.map((part) => part.category))
  const selectedList = selectedCategories.size ? Array.from(selectedCategories).join(", ") : "无"
  const editScopes = [
    spec.paint.action === "change" ? "车身钣金漆面颜色/表面效果" : "",
    spec.stance.prompt.trim() ? "车身高度姿态" : "",
    selectedCategories.size ? `已选配件类别: ${selectedList}` : "",
  ].filter(Boolean)
  const lockLines = [
    selectedCategories.has("wheels")
      ? "- wheels 已选时，只允许替换轮毂本体外观、轮毂中心、轮辐/轮唇和与轮毂直接相关的可见刹车盘遮挡关系；不要修改车身、车门、玻璃、灯、前后包围、侧裙、机盖、后视镜或背景。"
      : "- wheels 未选：四个原车轮毂、轮胎、刹车盘透视和接地阴影必须保持原图。",
    selectedCategories.has("mirrors")
      ? "- mirrors 已选时，只修改标准 JSON 指定的后视镜/镜壳区域，仍要保留原后视镜安装位置、角度和镜片关系。"
      : "- mirrors 未选：后视镜、耳朵、镜壳、镜片颜色、形状、材质、反射和车门连接结构必须保持原图；禁止变黑、禁止碳纤维化、禁止裸碳、禁止换成运动/牛角镜。",
    selectedCategories.has("hood")
      ? "- hood 已选时，只修改机盖表面和标准 JSON 指定的机盖材质/造型，保留周边钣金缝隙。"
      : "- hood 未选：机盖、机盖缝隙、雨刷和前挡风玻璃关系必须保持原图；不要套用碳纤维或裸碳材质。",
    selectedCategories.has("calipers")
      ? "- calipers 已选时，只在轮辐后方加入或修改卡钳，不能覆盖轮毂主体。"
      : "- calipers 未选：刹车卡钳和刹车盘不要新增醒目颜色或改造。",
    "- 未选择尾翼、前唇/前包围、侧裙、扩散器、排气、灯膜、中网、贴纸、车窗、车门、车顶、饰条和任何未列入 JSON parts 的区域都必须保持原图。",
    "- 不要因为配件参考图、常见改装审美、黑化风格或碳纤维联想而修改未选择部件。",
  ]

  return [
    "## 配置模式编辑白名单",
    `- 本次允许编辑范围：${editScopes.length ? editScopes.join("；") : "无实体配件，仅按 paint/stance 字段执行"}`,
    "- 标准 JSON parts 没有列出的类别就是锁定区域，必须按第一张原车图保留。",
    ...lockLines,
  ].join("\n")
}

export function buildConfigStandardJson(input: BuildConfigSpecInput): GenerationStandardJson {
  const selectedAssets = Object.values(input.selections)
    .map((id) => input.assets.find((asset) => asset.id === id))
    .filter((asset): asset is PartAsset => Boolean(asset))

  const parts = selectedAssets.map((asset) => {
    const category = input.categories.find((item) => item.id === asset.categoryId)
    const referenceImages = assetGenerationReferences(asset)
    const primaryReference = referenceImages[0]?.url || asset.imageUrl
    const colorPolicy = resolveAssetColorPolicy(asset, input.selectionOptions?.[asset.categoryId]?.colorPolicy)
    return {
      category: asset.categoryId,
      categoryLabel: categoryLabel(category, asset.categoryId),
      source: "asset_library",
      assetId: asset.id,
      brand: asset.brand,
      model: asset.model,
      variant: asset.variant,
      color: asset.color,
      finish: asset.finish,
      colorPolicy,
      colorPolicyPrompt: colorPolicyInstruction(colorPolicy, categoryLabel(category, asset.categoryId), asset.categoryId),
      referenceImageUrl: primaryReference,
      referenceImages,
      instruction: asset.promptHint,
    } satisfies GenerationPartSpec
  })

  const configPaint = buildConfigPaint(input.paint, input.paintFinishEffect ?? "gloss", input.paintGradient)
  const configStance = configStanceFromValue(input.stance)
  const vehicleModel = input.vehicleModel?.trim() || input.vehicleNote.trim() || "User uploaded vehicle, preserve exact identity"
  return {
    mode: "config",
    vehicle: {
      model: vehicleModel,
      view: "前 45 度",
      sourceImageUrl: input.sourceImageUrl,
      confidence: 0.86,
    },
    paint: configPaint,
    stance: configStance,
    parts,
    style: {
      keywords: ["真实照片局部编辑", "汽车改装效果图", "OEM-plus"],
      userText: input.vehicleNote,
      contextMode: "original",
    },
    constraints: defaultConstraints(),
  }
}

function buildConfigPaint(paint: PaintOption, finishEffect: PaintFinishEffect, gradient?: PaintGradient): GenerationStandardJson["paint"] {
  if (finishEffect === "gradient") {
    const resolvedGradient = gradient ?? { fromHex: "#006DFF", toHex: "#7A2CFF", direction: "front_to_rear" as const }
    return {
      action: "change",
      target: `Gradient ${resolvedGradient.fromHex} \u2192 ${resolvedGradient.toHex}`,
      prompt: buildGradientPaintInstruction(resolvedGradient),
      finishEffect: "gradient",
      finishLabel: "渐变",
      gradient: resolvedGradient,
    }
  }

  const finishLabel = paintFinishEffectLabel(finishEffect)
  if (finishEffect === "gloss") {
    const paintAction = paint.id === "factory" ? "keep_original" : "change"
    return {
      action: paintAction,
      target: paint.label,
      prompt:
        paintAction === "keep_original"
          ? "保持原车车身漆面颜色、色相、光泽、反射和钣金面连续性，除非已选配件的 colorPolicy 明确要求局部材质变化。"
          : paint.prompt,
      finishEffect: "gloss",
      finishLabel,
    }
  }

  const target = paint.id === "factory" ? `原车颜色 · ${finishLabel}` : `${paint.label} · ${finishLabel}`
  const baseInstruction =
    paint.id === "factory"
      ? "保持原车车身颜色和色相，只改变车身钣金漆面的表面效果。"
      : paint.prompt
  return {
    action: "change",
    target,
    prompt: [
      baseInstruction,
      paintFinishEffectInstruction(finishEffect),
      "该表面效果只作用于车身钣金漆面，不要改变玻璃、灯、轮毂、轮胎、车牌、黑色塑料饰条、碳纤维件、进气格栅、尾翼或扰流板、地面、附近车辆或背景。",
    ].join(" "),
    finishEffect,
    finishLabel,
  }
}

function paintFinishEffectLabel(effect: PaintFinishEffect) {
  const labels: Record<PaintFinishEffect, string> = {
    gloss: "亮面",
    metallic: "金属",
    matte: "哑光",
    satin: "缎面",
    pearl: "珠光",
    chrome: "电镀",
    gradient: "渐变",
  }
  return labels[effect]
}

function paintFinishEffectInstruction(effect: PaintFinishEffect) {
  const instructions: Record<Exclude<PaintFinishEffect, "gloss" | "gradient">, string> = {
    metallic: "表面效果：细金属颗粒漆，保留真实高光、清漆反射和环境光照，不要变成纯镜面。",
    matte: "表面效果：哑光漆，低反射、柔和高光，避免镜面反射或过强清漆高光。",
    satin: "表面效果：缎面漆，半哑半亮，介于哑光和亮面之间，保留柔和环境反射。",
    pearl: "表面效果：珠光漆，带细腻珠光/云母层次，随光线有轻微色泽变化但保持真实车漆。",
    chrome: "表面效果：电镀镜面金属车漆，形成清晰金属反射，但只作用于车身钣金，不要把整车或背景重画成金属雕塑。",
  }
  return effect === "gloss" || effect === "gradient" ? "" : instructions[effect]
}

function buildGradientPaintInstruction(gradient: PaintGradient) {
  return [
    `Change only the vehicle body paint to a smooth front-to-rear gradient from ${gradient.fromHex} / RGB(${rgbTextFromHexColor(gradient.fromHex)}) at the front to ${gradient.toHex} / RGB(${rgbTextFromHexColor(gradient.toHex)}) at the rear.`,
    "Blend the two colors continuously across the body panels while preserving panel gaps, highlights, shadows, and realistic clearcoat reflections.",
    "Preserve the source vehicle identity, body shape, headlights, glass, wheels, tires, license plate shape, black plastic trim, carbon fiber parts, grille, rear wing or spoiler, camera angle, lighting, and background.",
    "Do not tint glass, lights, wheels, tires, license plate, black plastic trim, carbon fiber parts, grille, rear wing or spoiler, ground, nearby cars, or the background with the requested gradient colors.",
  ].join(" ")
}

function rgbTextFromHexColor(hex: string) {
  const value = hex.replace("#", "")
  const r = Number.parseInt(value.slice(0, 2), 16)
  const g = Number.parseInt(value.slice(2, 4), 16)
  const b = Number.parseInt(value.slice(4, 6), 16)
  return `${r},${g},${b}`
}

function configStanceFromValue(value: number): GenerationStandardJson["stance"] {
  return stancePresetFromValue(value)
}

function legacyConfigStanceFromValue(value: number): GenerationStandardJson["stance"] {
  const normalized = clampNumber(value, 0, 100)
  if (normalized <= 0) {
    return { value: 0, label: "保持原车高度", prompt: "" }
  }
  if (normalized <= 30) {
    return {
      value: 25,
      label: "轻微升高",
      prompt:
        "相对当前原图轻微升高车身姿态：略微增加轮胎与轮拱之间的垂直间隙，保持车辆比例、轮胎圆形、接地点、背景、相机角度和真实悬挂结构不变，不要缩放整车或移动地面。",
    }
  }
  if (normalized <= 55) {
    return {
      value: 50,
      label: "轻微降低",
      prompt:
        "相对当前原图轻微降低车身姿态：适度减少轮胎与轮拱之间的垂直间隙，让车身相对轮胎和地面更低，同时保持轮胎圆形、接地点、背景、相机角度、车身比例和钣金结构不变。",
    }
  }
  if (normalized <= 80) {
    return {
      value: 70,
      label: "齐边低趴",
      prompt:
        "相对当前原图降低到齐边低趴姿态：明显减少轮胎与轮拱间隙，让轮胎上沿更贴近轮拱，但不要压扁轮胎、不要改变轮毂尺寸、不要移动接地点、不要缩放整车或改变画布/相机角度。",
    }
  }
  return {
    value: 90,
    label: "极低",
    prompt:
      "相对当前原图改为极低车身姿态：将轮拱间隙压到很小，呈现贴地低趴效果；必须保持轮胎圆形、轮毂比例、接地点、背景、车身几何、画布裁切和相机角度不变，避免车身变形或整车被整体缩放。",
  }
}

export function parseChatIntent(input: ParseChatIntentInput): ChatIntentParseResult {
  const text = input.text.trim()
  const lower = text.toLowerCase()
  if (rejectedIntentTerms.some((term) => lower.includes(term.toLowerCase()))) {
    return {
      status: "rejected",
      reason: "The request is outside the supported car modification scope.",
      missingFields: [],
      confidence: 0.92,
      normalizedText: text,
    }
  }

  if (hasStanceDirectionConflict(text)) {
    return {
      status: "needs_followup",
      followUpQuestion: "请确认车身高度要升高，还是降低 / 齐边 / 气动低趴。",
      missingFields: ["stance_preset"],
      confidence: 0.74,
      normalizedText: text,
    }
  }

  const requestedCategories = inferRequestedCategories(input).filter((category) => category.id !== "wrap")
  const category = requestedCategories[0]
  const paint = inferEffectivePaint(input)
  const stance = inferEffectiveStance(input)
  const explicitCatalogParts = exactCatalogPartsFromChat(input)
  const hasPaintIntent = paint.action === "change"
  const hasStanceIntent = hasEffectiveStanceRequest(input)
  const hasModificationIntent = Boolean(category || hasPaintIntent || hasStanceIntent || input.partReferences.length || explicitCatalogParts.length || fallbackHasActionableIntent(input))

  if (!text && input.partReferences.length === 0) {
    return {
      status: "needs_followup",
      followUpQuestion: "Please describe the car modification you want, or upload a part reference image.",
      missingFields: ["modification_request"],
      confidence: 0.82,
      normalizedText: text,
    }
  }

  const mirrorCorrection = inferMirrorColorCorrection(text, input.previousStandardJson)
  if (mirrorCorrection.detected && !mirrorCorrection.target) {
    return {
      status: "needs_followup",
      followUpQuestion:
        "\u8bf7\u8bf4\u660e\u8981\u628a\u540e\u89c6\u955c\u5916\u58f3\u4fee\u6b63\u6210\u4ec0\u4e48\u989c\u8272\uff0c\u4f8b\u5982\u7c89\u8272\u3001\u519b\u7eff\u8272\u6216\u9ed1\u8272\u3002",
      missingFields: ["paint_color"],
      confidence: 0.74,
      normalizedText: text,
    }
  }

  const caliperColorChange = inferCaliperColorChange(text)
  if (caliperColorChange.detected && !caliperColorChange.target) {
    return {
      status: "needs_followup",
      followUpQuestion:
        "\u8bf7\u8bf4\u660e\u8981\u628a\u5239\u8f66\u5361\u94b3\u6539\u6210\u4ec0\u4e48\u989c\u8272\uff0c\u4f8b\u5982\u7ea2\u8272\u3001\u6a59\u8272\u3001\u9ec4\u8272\u6216\u91d1\u5c5e\u7eff\u3002",
      missingFields: ["paint_color"],
      confidence: 0.74,
      normalizedText: text,
    }
  }

  if (isVaguePaintCorrection(text)) {
    return {
      status: "needs_followup",
      followUpQuestion:
        "\u8bf7\u8bf4\u660e\u66f4\u5177\u4f53\u7684\u76ee\u6807\u989c\u8272\uff0c\u4f8b\u5982\u519b\u7eff\u8272\u3001\u58a8\u7eff\u8272\u3001\u68ee\u6797\u7eff\uff0c\u6216\u4e0a\u4f20\u989c\u8272\u53c2\u8003\u56fe\u3002",
      missingFields: ["paint_color"],
      confidence: 0.74,
      normalizedText: text,
    }
  }

  if (caliperColorChange.detected && caliperColorChange.target) {
    const standardJson = buildChatStandardJson({
      sourceImageUrl: input.sourceImageUrl,
      text,
      contextMode: input.contextMode,
      partReferences: input.partReferences,
      categories: input.categories,
      assets: input.assets,
      vehicleRecognition: input.vehicleRecognition,
      partColorPolicyChoices: input.partColorPolicyChoices,
      previousStandardJson: input.previousStandardJson,
      fallbackIntent: input.fallbackIntent,
    })
    return {
      status: "ready",
      standardJson,
      missingFields: [],
      confidence: 0.88,
      normalizedText: text,
    }
  }

  if (mirrorCorrection.detected && mirrorCorrection.target) {
    const standardJson = buildChatStandardJson({
      sourceImageUrl: input.sourceImageUrl,
      text,
      contextMode: "latest",
      partReferences: input.partReferences,
      categories: input.categories,
      assets: input.assets,
      vehicleRecognition: input.vehicleRecognition,
      partColorPolicyChoices: input.partColorPolicyChoices,
      previousStandardJson: input.previousStandardJson,
      fallbackIntent: input.fallbackIntent,
    })
    return {
      status: "ready",
      standardJson,
      missingFields: [],
      confidence: 0.88,
      normalizedText: text,
    }
  }

  if (!hasModificationIntent) {
    return {
      status: "needs_followup",
      followUpQuestion: "Which part or style should be modified? For example: hood, front lip, wheels, side skirts, diffuser, exhaust, lights, or body color.",
      missingFields: ["part_category"],
      confidence: 0.76,
      normalizedText: text,
    }
  }

  const referencesWithCategory = input.partReferences.filter((reference) => recognizedReferenceCategory(reference, input.categories, text))
  if (input.partReferences.length > 0 && referencesWithCategory.length === 0 && !category && !hasPaintIntent && !hasStanceIntent) {
    return {
      status: "needs_followup",
      followUpQuestion: "What car part do these uploaded references represent? Please name the category, such as hood, trunk lip, diffuser, or side skirt.",
      missingFields: ["uploaded_part_category"],
      confidence: 0.7,
      normalizedText: text,
    }
  }

  const uploadedCategoryIds = new Set(
    referencesWithCategory.map((reference) => recognizedReferenceCategory(reference, input.categories, text)?.id).filter((id): id is string => Boolean(id)),
  )
  const missingRequestedCategories = requestedCategories
    .filter((requested) => !uploadedCategoryIds.has(requested.id))
    .filter((requested) => !exactCatalogPartFromChat(input, requested))
  if (missingRequestedCategories.length) {
    const labels = missingRequestedCategories.map((item) => categoryLabel(item, item.id)).join(" / ")
    return {
      status: "needs_followup",
      followUpQuestion: `Please upload clear reference image(s) for: ${labels}. If you know the exact brand/model, include it too; if it matches the internal catalog, that catalog part will be used automatically. Otherwise the uploaded image will be used as the reference.`,
      missingFields: missingRequestedCategories.map((item) => `part_reference:${item.id}`),
      confidence: 0.72,
      normalizedText: text,
    }
  }

  const pendingColorPolicyCategories = pendingPartColorPolicyCategories(input, referencesWithCategory)
  if (pendingColorPolicyCategories.length) {
    return {
      status: "needs_followup",
      followUpQuestion: pendingColorPolicyCategories.map((categoryId) => partColorPolicyQuestion(categoryId)).join("\n"),
      missingFields: pendingColorPolicyCategories.map((categoryId) => `part_color_policy:${categoryId}`),
      confidence: 0.76,
      normalizedText: text,
    }
  }

  const standardJson = buildChatStandardJson({
    sourceImageUrl: input.sourceImageUrl,
    text,
    contextMode: input.contextMode,
    partReferences: input.partReferences,
    categories: input.categories,
    assets: input.assets,
    vehicleRecognition: input.vehicleRecognition,
    partColorPolicyChoices: input.partColorPolicyChoices,
    previousStandardJson: input.previousStandardJson,
    fallbackIntent: input.fallbackIntent,
  })
  return {
    status: "ready",
    standardJson,
    missingFields: [],
    confidence: 0.86,
    normalizedText: text,
  }
}

export function buildChatStandardJson(input: BuildChatSpecInput): GenerationStandardJson {
  const mirrorCorrection = inferMirrorColorCorrection(input.text, input.previousStandardJson)
  if (mirrorCorrection.detected && mirrorCorrection.target) {
    return buildMirrorColorCorrectionStandardJson(input, mirrorCorrection.target)
  }
  const caliperColorChange = inferCaliperColorChange(input.text)
  if (caliperColorChange.detected && caliperColorChange.target) {
    return buildCaliperColorRepaintStandardJson(input, caliperColorChange.target)
  }
  const inferredCategories = inferRequestedCategories(input).filter((category) => category.id !== "wrap")
  const groupedReferences = groupChatPartReferences(input.partReferences, input.categories, input.text)
  const uploadedParts = groupedReferences.map((group, index) => {
    const category = group.category
    const categoryId = category.id
    const firstReference = group.references[0]
    const label = categoryLabel(category, firstReference?.categoryLabel || "uploaded reference")
    const colorPolicy = inferPartColorPolicy(input.text, categoryId, input.partColorPolicyChoices?.[categoryId])
    const references = group.references.map((reference, referenceIndex) => ({
      url: reference.url,
      role: referenceIndex === 0 ? ("full_part_reference" as const) : chatReferenceRole(referenceIndex),
      view: referenceIndex === 0 ? "primary uploaded reference" : "uploaded reference",
      promptHint: reference.visualFeatures?.length
        ? `Uploaded ${label} reference. Visual features: ${reference.visualFeatures.join(", ")}. Use only for this part group.`
        : `Uploaded ${label} reference. Use only for this part group shape, material, proportion, and install relation.`,
      priority: referenceIndex + 1,
      uploadToModel: true,
    }))
    const primary = references[0]
    return {
      category: categoryId,
      categoryLabel: label,
      source: "uploaded_reference",
      assetId: "",
      brand: firstReference?.brand || "",
      model: firstReference?.model || "",
      variant: firstReference?.variant || `uploaded reference group ${index + 1}`,
      color: "",
      finish: "",
      colorPolicy,
      colorPolicyPrompt: colorPolicyInstruction(colorPolicy, label, categoryId),
      referenceImageUrl: primary?.url || "",
      referenceImages: references,
      instruction: `Install the uploaded ${label} reference group onto the matching area of the source vehicle. Modify only this selected part category and preserve all unrelated original details.`,
    } satisfies GenerationPartSpec
  })
  const uploadedCategoryIds = new Set(uploadedParts.map((part) => part.category))
  const catalogParts = inferredCategories
    .filter((category) => !uploadedCategoryIds.has(category.id))
    .map((category) => exactCatalogPartFromChat(input, category))
    .filter((part): part is GenerationPartSpec => Boolean(part))
  const explicitCatalogParts = exactCatalogPartsFromChat(input).filter(
    (part) => !uploadedCategoryIds.has(part.category) && !catalogParts.some((catalogPart) => catalogPart.assetId === part.assetId),
  )
  const parts = [...uploadedParts, ...catalogParts, ...explicitCatalogParts]

  return {
    mode: "chat",
    vehicle: {
      model: "User uploaded vehicle, preserve exact identity",
      view: input.vehicleRecognition?.view || "front three-quarter",
      sourceImageUrl: input.sourceImageUrl,
      confidence: input.vehicleRecognition?.confidence ?? 0.78,
    },
    paint: inferEffectivePaint(input),
    stance: hasEffectiveStanceRequest(input) ? inferEffectiveStance(input) : defaultChatStance(),
    parts,
    style: {
      keywords: extractStyleKeywords(input.text),
      userText: input.text,
      contextMode: input.contextMode,
    },
    constraints: defaultConstraints(),
  }
}

function buildMirrorColorCorrectionStandardJson(input: BuildChatSpecInput, target: string): GenerationStandardJson {
  const category = input.categories.find((item) => item.id === "mirrors")
  const label = categoryLabel(category, "mirrors")
  return {
    mode: "chat",
    vehicle: {
      model: "User uploaded vehicle, preserve exact identity",
      view: input.vehicleRecognition?.view || "front three-quarter",
      sourceImageUrl: input.sourceImageUrl,
      confidence: input.vehicleRecognition?.confidence ?? 0.78,
    },
    paint: keepOriginalPaint(),
    stance: defaultChatStance(),
    parts: [
      {
        category: "mirrors",
        categoryLabel: label,
        source: "free_text",
        assetId: "",
        brand: "",
        model: "",
        variant: "mirror color correction",
        color: target,
        finish: "",
        colorPolicy: "body_color",
        colorPolicyPrompt: `Repaint only the mirror caps or mirror housings to ${target}. Preserve mirror glass, mirror shape, mounting base, seams, door panel, window glass, reflections, and every unrelated part.`,
        referenceImageUrl: "",
        referenceImages: [],
        instruction: `Local correction: repaint only the side mirror caps or mirror housings to ${target}. Keep the rest of the latest image unchanged, including body panels, wheels, lights, glass, background, camera angle, and lighting.`,
      },
    ],
    style: {
      keywords: ["result_correction", "mirror_color_correction"],
      userText: input.text,
      contextMode: "latest",
    },
    constraints: defaultConstraints(),
  }
}

function buildCaliperColorRepaintStandardJson(input: BuildChatSpecInput, target: string): GenerationStandardJson {
  const category = input.categories.find((item) => item.id === "calipers")
  const label = categoryLabel(category, "calipers")
  return {
    mode: "chat",
    vehicle: {
      model: "User uploaded vehicle, preserve exact identity",
      view: input.vehicleRecognition?.view || "front three-quarter",
      sourceImageUrl: input.sourceImageUrl,
      confidence: input.vehicleRecognition?.confidence ?? 0.78,
    },
    paint: keepOriginalPaint(),
    stance: defaultChatStance(),
    parts: [
      {
        category: "calipers",
        categoryLabel: label,
        source: "free_text",
        assetId: "",
        brand: "",
        model: "",
        variant: "caliper color repaint",
        color: target,
        finish: "",
        colorPolicy: "part_reference_color",
        colorPolicyPrompt: `Repaint only the visible brake calipers to ${target}. Preserve brake discs, wheels, tires, wheel spokes, body paint, glass, lights, background, camera angle, and lighting.`,
        referenceImageUrl: "",
        referenceImages: [],
        instruction: `Local edit: change only the visible brake caliper color to ${target}. Keep the calipers behind the wheel spokes and attached to the brake discs with realistic occlusion, scale, shadow, and reflections. Do not add a new brake kit, change wheel design, recolor wheels, or alter the vehicle body paint.`,
      },
    ],
    style: {
      keywords: ["caliper_color_repaint", "local_part_repaint"],
      userText: input.text,
      contextMode: input.contextMode,
    },
    constraints: defaultConstraints(),
  }
}

export function evaluateGenerationResult(
  spec: GenerationStandardJson,
  resultImageUrl: string,
  options: { resultCheckPrompt?: string } = {},
): ResultCheckResult {
  const missingElements: string[] = []
  if (!resultImageUrl) missingElements.push("result image")
  if (spec.parts.length === 0 && spec.paint.action === "keep_original" && !spec.stance.prompt.trim()) {
    missingElements.push("visible modification")
  }
  const passed = missingElements.length === 0
  const resultCheckPrompt = options.resultCheckPrompt?.trim()
  const retryPrompt = passed
    ? ""
    : [
        resultCheckPrompt ? `结果检查指引：${resultCheckPrompt}` : "",
        `缺失元素：${missingElements.join(", ")}`,
        "只修复缺失的已选改装项，同时保留原车画布、相机角度、光照、背景、车牌区域和所有未选择部件。",
      ]
        .filter(Boolean)
        .join("\n")
  return {
    passed,
    score: passed ? 0.92 : 0.48,
    missingElements,
    wrongElements: [],
    badCaseTags: passed ? [] : ["missing_core_element"],
    retryPrompt,
    summary: passed ? "模拟结果检查通过。" : "模拟结果检查发现必选改装项缺失。",
  }
}

export function buildRepairPrompt(prompt: string, check: ResultCheckResult, options: { retryPromptTemplate?: string } = {}) {
  if (check.passed) return prompt
  const retryPromptTemplate = options.retryPromptTemplate?.trim()
  return [
    prompt,
    "## 修复重试",
    retryPromptTemplate || "只修复失败的已选改装项。不要改变原车身份、背景、相机角度、光照或任何未选择部件。",
    check.retryPrompt,
    "使用同一张第一上传原车图作为唯一画布，输出一张修正后的真实照片风格结果。",
  ].join("\n\n")
}

export function summarizeSpec(spec: GenerationStandardJson) {
  const parts = spec.parts.map((part) => {
    const name = part.source === "asset_library" ? `${part.brand} ${part.model} ${part.variant}`.trim() : `${part.categoryLabel} ${part.source}`
    return part.colorPolicy === "exposed_carbon" ? `${name} (exposed carbon)` : name
  })
  const stanceSummary = spec.stance.prompt.trim() ? spec.stance.label : "车身高度不变"
  return [spec.mode, spec.vehicle.model, spec.paint.target, stanceSummary, parts.length ? parts.join(" / ") : "no part"].join(" | ")
}

export const buildGenerationPromptLegacy = buildGenerationPrompt
export const evaluateGenerationResultLegacy = evaluateGenerationResult
export const buildRepairPromptLegacy = buildRepairPrompt

function partPromptBlock(part: GenerationPartSpec, index: number, templates: PromptTemplate[]) {
  const categoryTemplates = templates
    .filter((template) => template.scope === "category" && template.combinationKey === part.category)
    .sort((a, b) => a.sortOrder - b.sortOrder)
  const partTemplates = templates
    .filter((template) => template.scope === "part" && template.assetId && template.assetId === part.assetId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
  const referenceLines = (part.referenceImages?.length
    ? [...part.referenceImages].sort((a, b) => a.priority - b.priority)
    : part.referenceImageUrl
      ? [{ url: part.referenceImageUrl, role: "full_part_reference", view: "unknown", promptHint: "", priority: 10, uploadToModel: true }]
      : []
  )
    .map(
      (reference, referenceIndex) =>
        `${referenceIndex + 1}. ${reference.url} | 角色=${reference.role} | 视角=${reference.view} | 上传给模型=${reference.uploadToModel !== false}${reference.promptHint ? ` | 提示=${reference.promptHint}` : ""}`,
    )
    .join("\n")

  return [
    `### ${index + 1}. ${part.categoryLabel} (${part.category})`,
    `- 来源: ${part.source}`,
    part.source === "asset_library" ? `- 资产: ${[part.brand, part.model, part.variant].filter(Boolean).join(" ")}` : `- 参考图: ${part.referenceImageUrl}`,
    part.color ? `- 目录颜色: ${part.color}` : "",
    part.finish ? `- 材质/表面: ${part.finish}` : "",
    `- colorPolicy: ${part.colorPolicy}`,
    `- colorPolicyPrompt: ${part.colorPolicyPrompt}`,
    `- 指令: ${part.instruction}`,
    referenceLines ? `- 配件参考图:\n${referenceLines}` : "",
    categoryTemplates.length ? `- 分类模板:\n${categoryTemplates.map((template) => template.body).join("\n")}` : "",
    partTemplates.length ? `- 配件模板:\n${partTemplates.map((template) => template.body).join("\n")}` : "",
  ]
    .filter(Boolean)
    .join("\n")
}

function exactCatalogPartFromChat(input: BuildChatSpecInput, category: PartCategory): GenerationPartSpec | null {
  const asset = input.assets
    ?.filter((item) => item.categoryId === category.id && item.active)
    .sort((a, b) => Number(b.generationReady) - Number(a.generationReady) || a.sortOrder - b.sortOrder)
    .find((item) => assetMatchesUserText(item, input.text))
  if (!asset) return null
  const referenceImages = assetGenerationReferences(asset)
  const requestedPolicy = inferPartColorPolicy(input.text, category.id, input.partColorPolicyChoices?.[category.id])
  const colorPolicy = resolveAssetColorPolicy(asset, requestedPolicy)
  return {
    category: asset.categoryId,
    categoryLabel: categoryLabel(category, asset.categoryId),
    source: "asset_library",
    assetId: asset.id,
    brand: asset.brand,
    model: asset.model,
    variant: asset.variant,
    color: asset.color,
    finish: asset.finish,
    colorPolicy,
    colorPolicyPrompt: colorPolicyInstruction(colorPolicy, categoryLabel(category, asset.categoryId), asset.categoryId),
    referenceImageUrl: referenceImages[0]?.url || asset.imageUrl,
    referenceImages,
    instruction: asset.promptHint || `按用户请求安装 ${categoryLabel(category, asset.categoryId)}，只修改对应配件区域。`,
  }
}

function exactCatalogPartsFromChat(input: BuildChatSpecInput): GenerationPartSpec[] {
  const matches = new Map<string, GenerationPartSpec>()
  input.assets
    ?.filter((asset) => asset.active)
    .sort((a, b) => Number(b.generationReady) - Number(a.generationReady) || a.sortOrder - b.sortOrder)
    .forEach((asset) => {
      if (!assetMatchesUserText(asset, input.text)) return
      const category = input.categories.find((item) => item.id === asset.categoryId)
      if (!category || matches.has(asset.id)) return
      const part = exactCatalogPartFromChat(input, category)
      if (part?.assetId === asset.id) matches.set(asset.id, part)
    })
  return Array.from(matches.values())
}

function groupChatPartReferences(references: ChatPartReferenceInput[], categories: PartCategory[], text: string) {
  const groups = new Map<string, { category: PartCategory; references: ChatPartReferenceInput[] }>()
  references.forEach((reference) => {
    const category = recognizedReferenceCategory(reference, categories, text)
    if (!category) return
    const group = groups.get(category.id) ?? { category, references: [] }
    group.references.push(reference)
    groups.set(category.id, group)
  })
  return Array.from(groups.values())
}

function recognizedReferenceCategory(reference: ChatPartReferenceInput, categories: PartCategory[], text: string) {
  const categoryId = cleanCategoryId(reference.category)
  const direct = categoryId ? categories.find((category) => category.id === categoryId) : undefined
  if (direct && (reference.confidence === undefined || reference.confidence >= MIN_RECOGNIZED_PART_CONFIDENCE)) return direct
  const inferred = inferCategory(
    [
      text,
      reference.fileName,
      reference.categoryLabel,
      reference.brand,
      reference.model,
      reference.variant,
      ...(reference.visualFeatures ?? []),
    ]
      .filter(Boolean)
      .join(" "),
    categories,
  )
  return inferred
}

function cleanCategoryId(value: string | undefined) {
  const normalized = String(value || "").trim()
  if (!normalized || normalized === "unknown" || normalized === "uploaded-reference" || normalized === "uploaded_reference") return ""
  return normalized
}

function normalizeFallbackIntentForInput(intent: ChatFallbackIntent | undefined, input: BuildChatSpecInput): ChatFallbackIntent | undefined {
  if (!intent || intent.confidence < CHAT_FALLBACK_CONFIDENCE) return undefined
  const validCategoryIds = new Set(input.categories.map((category) => category.id))
  const validFileNames = new Set(input.partReferences.map((reference) => reference.fileName))
  const paint =
    intent.paint?.action === "change" && intent.paint.confidence >= CHAT_FALLBACK_CONFIDENCE && intent.paint.target.trim()
      ? { action: "change" as const, target: intent.paint.target.trim(), confidence: clampNumber(intent.paint.confidence, 0, 1) }
      : undefined
  const stance =
    intent.stance && intent.stance.confidence >= CHAT_FALLBACK_CONFIDENCE
      ? {
          value: clampNumber(Number(intent.stance.value), 0, 100),
          label: String(intent.stance.label || "").trim(),
          confidence: clampNumber(intent.stance.confidence, 0, 1),
        }
      : undefined
  const requestedCategories = uniqueFallbackCategoryItems(intent.requestedCategories, validCategoryIds)
  const uploadedReferenceCategories = (intent.uploadedReferenceCategories ?? [])
    .filter((item) => item.confidence >= CHAT_FALLBACK_CONFIDENCE && validCategoryIds.has(item.categoryId) && validFileNames.has(item.fileName))
    .map((item) => ({ fileName: item.fileName, categoryId: item.categoryId, confidence: clampNumber(item.confidence, 0, 1) }))
  const hasModificationIntent = Boolean(intent.hasModificationIntent && (paint || stance || requestedCategories.length || uploadedReferenceCategories.length))
  if (!hasModificationIntent) return undefined
  return {
    hasModificationIntent,
    ...(paint ? { paint } : {}),
    ...(stance ? { stance } : {}),
    ...(requestedCategories.length ? { requestedCategories } : {}),
    ...(uploadedReferenceCategories.length ? { uploadedReferenceCategories } : {}),
    clarificationQuestion: String(intent.clarificationQuestion || "").trim(),
    reason: String(intent.reason || "").trim(),
    confidence: clampNumber(intent.confidence, 0, 1),
  }
}

function uniqueFallbackCategoryItems(items: ChatFallbackIntent["requestedCategories"] | undefined, validCategoryIds: Set<string>) {
  const seen = new Set<string>()
  return (items ?? [])
    .filter((item) => item.confidence >= CHAT_FALLBACK_CONFIDENCE && validCategoryIds.has(item.categoryId))
    .filter((item) => {
      if (seen.has(item.categoryId)) return false
      seen.add(item.categoryId)
      return true
    })
    .map((item) => ({ categoryId: item.categoryId, confidence: clampNumber(item.confidence, 0, 1) }))
}

function validFallbackIntent(intent: ChatFallbackIntent | undefined) {
  return intent && intent.confidence >= CHAT_FALLBACK_CONFIDENCE && intent.hasModificationIntent ? intent : undefined
}

function fallbackHasActionableIntent(input: BuildChatSpecInput) {
  const fallback = validFallbackIntent(input.fallbackIntent)
  return Boolean(
    fallback &&
      ((fallback.paint?.confidence ?? 0) >= CHAT_FALLBACK_CONFIDENCE ||
        (fallback.stance?.confidence ?? 0) >= CHAT_FALLBACK_CONFIDENCE ||
        (fallback.requestedCategories ?? []).some((item) => item.confidence >= CHAT_FALLBACK_CONFIDENCE) ||
        (fallback.uploadedReferenceCategories ?? []).some((item) => item.confidence >= CHAT_FALLBACK_CONFIDENCE)),
  )
}

function clampNumber(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, value))
}

function chatReferenceRole(index: number): NonNullable<GenerationPartSpec["referenceImages"]>[number]["role"] {
  const roles: Array<NonNullable<GenerationPartSpec["referenceImages"]>[number]["role"]> = ["shape_reference", "install_context", "material_reference", "color_reference"]
  return roles[(index - 1) % roles.length]
}

function partColorPolicySpecified(text: string) {
  return explicitExposedCarbonPattern.test(text) || bodyColorPattern.test(text)
}

function isPartColorPolicyChoiceCategory(categoryId: string) {
  return categoryId === "hood" || categoryId === "mirrors"
}

function pendingPartColorPolicyCategories(input: ParseChatIntentInput, referencesWithCategory: ChatPartReferenceInput[]) {
  if (partColorPolicySpecified(input.text)) return []
  const confirmed = input.partColorPolicyChoices ?? {}
  const pending = new Set<string>()
  referencesWithCategory
    .map((reference) => ({ reference, category: recognizedReferenceCategory(reference, input.categories, input.text) }))
    .forEach((item) => {
      if (item.category && isPartColorPolicyChoiceCategory(item.category.id) && !confirmed[item.category.id] && uploadedReferenceMentionsCarbon(item.reference)) {
        pending.add(item.category.id)
      }
    })

  input.assets
    ?.filter((asset) => asset.active && assetMatchesUserText(asset, input.text))
    .sort((a, b) => Number(b.generationReady) - Number(a.generationReady) || a.sortOrder - b.sortOrder)
    .forEach((asset) => {
      if (isPartColorPolicyChoiceCategory(asset.categoryId) && !confirmed[asset.categoryId] && assetSupportsCarbonColorPolicy(asset)) {
        pending.add(asset.categoryId)
      }
    })
  return Array.from(pending)
}

function partColorPolicyQuestion(categoryId: string) {
  if (categoryId === "mirrors") {
    return "Please confirm whether the mirror caps should match the body color or stay exposed carbon."
  }
  return "Please confirm whether the hood should match the body color or stay exposed carbon."
}

function uploadedReferenceMentionsCarbon(reference: ChatPartReferenceInput) {
  return carbonPattern.test(
    [
      reference.fileName,
      reference.categoryLabel,
      reference.brand,
      reference.model,
      reference.variant,
      ...(reference.visualFeatures ?? []),
    ]
      .filter(Boolean)
      .join(" "),
  )
}

function assetMatchesUserText(asset: PartAsset, text: string) {
  const lower = normalizeSearchText(text)
  if (!lower) return false
  const compactLower = lower.replace(/\s+/g, "")
  const keywords = [
    ...assetKeywordList(asset.keywords),
    asset.model,
    asset.variant,
    `${asset.model} ${asset.variant}`.trim(),
  ].filter(Boolean)
  if (
    keywords.some((keyword) => {
      const normalized = normalizeSearchText(keyword)
      if (!normalized || normalized.length < 3) return false
      return lower.includes(normalized) || compactLower.includes(normalized.replace(/\s+/g, ""))
    })
  ) {
    return true
  }
  return false
}

function assetKeywordList(value: string | undefined) {
  return String(value || "")
    .split(/[\n,，、;；]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

function normalizeSearchText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, " ").replace(/\s+/g, " ").trim()
}

function assetGenerationReferences(asset: PartAsset): NonNullable<GenerationPartSpec["referenceImages"]> {
  const seenUrls = new Set<string>()
  const references = (asset.generationReferences ?? [])
    .filter((reference) => reference.active && reference.uploadToModel && reference.role !== "avoid_upload" && reference.url)
    .sort((a, b) => a.priority - b.priority || referenceRoleRank(b.role) - referenceRoleRank(a.role))
    .filter((reference) => {
      if (seenUrls.has(reference.url)) return false
      seenUrls.add(reference.url)
      return true
    })
    .slice(0, MAX_GENERATION_REFERENCES_PER_PART)
    .map((reference) => ({
      url: reference.url,
      role: reference.role,
      view: reference.view,
      promptHint: reference.promptHint,
      priority: reference.priority,
      uploadToModel: reference.uploadToModel,
    }))
  if (references.length) return references
  if (!asset.imageUrl) return []
  return [
    {
      url: asset.imageUrl,
      role: "full_part_reference",
      view: "display",
      promptHint: "这只是配件参考图，只参考配件形状和材质，不继承捐赠车辆或场景。",
      priority: 10,
      uploadToModel: true,
    },
  ]
}

function referenceRoleRank(role: string) {
  if (role === "shape_reference") return 6
  if (role === "install_context") return 5
  if (role === "material_reference") return 4
  if (role === "detail_reference") return 3
  if (role === "full_part_reference") return 2
  if (role === "avoid_upload") return 0
  return 1
}

function resolveAssetColorPolicy(asset: PartAsset, requested: PartColorPolicy | undefined): PartColorPolicy {
  const allowed = allowedColorPoliciesForAsset(asset)
  if (requested && allowed.includes(requested)) return requested
  const defaultPolicy = asset.defaultColorPolicy || inferredDefaultColorPolicy(asset)
  return allowed.includes(defaultPolicy) ? defaultPolicy : allowed[0] || "part_reference_color"
}

function allowedColorPoliciesForAsset(asset: PartAsset): PartColorPolicy[] {
  if (assetSupportsCarbonColorPolicy(asset)) return ["body_color", "exposed_carbon"]
  if (asset.allowedColorPolicies?.length) return asset.allowedColorPolicies
  return [asset.defaultColorPolicy || inferredDefaultColorPolicy(asset)]
}

function inferredDefaultColorPolicy(asset: PartAsset): PartColorPolicy {
  if (isPartColorPolicyChoiceCategory(asset.categoryId) && assetMentionsCarbon(asset)) return "body_color"
  return "part_reference_color"
}

function assetSupportsCarbonColorPolicy(asset: PartAsset) {
  return isPartColorPolicyChoiceCategory(asset.categoryId) && (assetMentionsCarbon(asset) || asset.allowedColorPolicies?.includes("exposed_carbon"))
}

function assetMentionsCarbon(asset: PartAsset) {
  return carbonPattern.test([asset.brand, asset.model, asset.variant, asset.keywords, asset.color, asset.finish, asset.promptHint].join(" "))
}

function inferPartColorPolicy(text: string, categoryId: string, confirmed?: PartColorPolicy): PartColorPolicy {
  if (confirmed === "body_color" || confirmed === "exposed_carbon") return confirmed
  if (isPartColorPolicyChoiceCategory(categoryId)) {
    if (explicitExposedCarbonPattern.test(text)) return "exposed_carbon"
    if (bodyColorPattern.test(text)) return "body_color"
    return "body_color"
  }
  return "part_reference_color"
}

function colorPolicyInstruction(policy: PartColorPolicy, categoryLabelText: string, categoryId = "") {
  if (policy === "body_color" && categoryId === "mirrors") {
    return "Paint-match only the mirror caps or mirror housings to the source vehicle body color. Preserve the mirror glass, mirror shape, mounting base, seam lines, door panel, window glass, reflections, and camera angle."
  }
  if (policy === "exposed_carbon" && categoryId === "mirrors") {
    return "Use exposed carbon fiber only on the mirror caps or mirror housings. Do not change mirror glass, mirror geometry, mounting base, door panel, window glass, or unrelated body panels."
  }
  if (policy === "body_color" && categoryId === "hood") {
    return "Paint-match only the hood panel to the source vehicle body color. Preserve the exact hood boundary, front edge, rear edge, left/right panel gaps, headlight relationship, windshield edge, and body shape."
  }
  if (policy === "exposed_carbon" && categoryId === "hood") {
    return "Use exposed carbon fiber only on the hood panel. Do not spread carbon texture to roof, trunk, doors, bumpers, mirrors, wheels, lights, windshield, or unrelated body panels."
  }
  if (policy === "body_color") {
    return `${categoryLabelText} 必须喷成第一张原车相同车身颜色。不要在这个部件上显示裸露碳纤维纹理或黑色碳纤维材质。`
  }
  if (policy === "exposed_carbon") {
    return `只在 ${categoryLabelText} 上显示可见裸露碳纤维纹理。不要把碳纤维纹理扩散到车顶、后备箱、保险杠、后视镜、车门、轮毂或任何未选择部件。`
  }
  return `${categoryLabelText} 只参考已选配件参考图的颜色和材质；不要继承参考图中捐赠车辆的车漆或无关颜色。`
}

function templatesForScope(templates: PromptTemplate[], scope: TemplateScope) {
  return templates.filter((template) => template.scope === scope).sort((a, b) => a.sortOrder - b.sortOrder)
}

function templatesByScope(templates: PromptTemplate[], scope: TemplateScope) {
  return templatesForScope(templates, scope).map((template) => template.body)
}

function uniqueTextBlocks(blocks: string[]) {
  const seen = new Set<string>()
  return blocks.filter((block) => {
    const normalized = block.replace(/\s+/g, " ").trim()
    if (!normalized || seen.has(normalized)) return false
    seen.add(normalized)
    return true
  })
}

function comboMatches(value: string, spec: GenerationStandardJson) {
  const tokens = value
    .split(/[\n,，、;；]/)
    .map((token) => token.trim())
    .filter(Boolean)
  if (!tokens.length) return false
  const categories = new Set(spec.parts.map((part) => part.category))
  const assets = new Set(spec.parts.map((part) => part.assetId).filter(Boolean))
  const virtualTokens = new Set<string>()
  if (spec.stance.prompt.trim() && spec.stance.value > 45) virtualTokens.add("stance_lowered")
  if (spec.stance.prompt.trim() && spec.stance.value > 74) virtualTokens.add("stance_aggressive")
  if (spec.paint.action === "change") virtualTokens.add("paint_change")
  if (spec.parts.some((part) => carbonPattern.test(`${part.finish} ${part.color} ${part.instruction}`))) virtualTokens.add("carbon_parts")
  if (spec.parts.some((part) => part.colorPolicy === "exposed_carbon")) {
    virtualTokens.add("exposed_carbon_parts")
    virtualTokens.add("hood_exposed_carbon")
  }
  if (spec.parts.some((part) => part.category === "hood" && part.colorPolicy === "body_color")) virtualTokens.add("hood_body_color")
  if (spec.parts.some((part) => part.source === "uploaded_reference")) virtualTokens.add("uploaded_reference")
  return tokens.every((token) => categories.has(token) || assets.has(token) || virtualTokens.has(token))
}

function inferCategories(text: string, categories: PartCategory[]) {
  return categoryIdsFromAliasText(text, categories)
    .map((id) => categories.find((category) => category.id === id))
    .filter((category): category is PartCategory => Boolean(category))
}

function inferRequestedCategories(input: BuildChatSpecInput) {
  const categories = inferCategories(input.text, input.categories)
  const seen = new Set(categories.map((category) => category.id))
  const fallback = validFallbackIntent(input.fallbackIntent)
  if (!fallback) return categories
  const fallbackCategories = (fallback.requestedCategories ?? [])
    .filter((item) => item.confidence >= CHAT_FALLBACK_CONFIDENCE)
    .map((item) => input.categories.find((category) => category.id === item.categoryId))
    .filter((category): category is PartCategory => Boolean(category))
    .filter((category) => {
      if (seen.has(category.id)) return false
      seen.add(category.id)
      return true
    })
  return [...categories, ...fallbackCategories]
}

function inferCategory(text: string, categories: PartCategory[]) {
  return inferCategories(text, categories)[0]
}

function extractModelHint(text: string) {
  const match = text.match(/\b(BMW|M3|M4|911|Supra|GTR|AMG|Audi|Porsche|Tesla|Civic|Mustang)[\w\s-]{0,18}/i)
  return match?.[0]?.trim() || ""
}

function inferMirrorColorCorrection(text: string, previous?: GenerationStandardJson | null) {
  const normalized = text.trim()
  if (!normalized) return { detected: false, target: "" }
  const mentionsMirror =
    /\b(?:mirror|mirrors|mirror\s*cap|mirror\s*caps|side\s*mirror|wing\s*mirror)\b|\u8033\u6735|\u540e\u89c6\u955c|\u5916\u540e\u89c6\u955c|\u955c\u58f3|\u540e\u89c6\u955c\u58f3|\u955c\u76d6/u.test(
      normalized,
    )
  if (!mentionsMirror) return { detected: false, target: "" }
  const looksLikeCorrection =
    /\b(?:why|wrong|not|isn'?t|doesn'?t|didn'?t|fix|correct|repaint|paint|change|make)\b|\u600e\u4e48|\u4e3a\u4ec0\u4e48|\u4e0d\u662f|\u4e0d\u5bf9|\u4e0d\u6539|\u6ca1\u6539|\u4fee\u6b63|\u6539\u6210|\u6539\u4e3a|\u6362\u6210|\u55b7\u6210/u.test(
      normalized,
    )
  if (!looksLikeCorrection) return { detected: false, target: "" }
  const target = inferPaintTarget(normalized) || namedPaintTarget(normalized) || previousPaintTarget(previous)
  return { detected: true, target }
}

function inferCaliperColorChange(text: string) {
  const normalized = text.trim()
  if (!normalized) return { detected: false, target: "" }
  const mentionsCaliper =
    /\b(?:brake\s*)?calipers?\b|\bbbk\b|\u5361\u94b3|\u5239\u8f66\u5361\u94b3|\u5236\u52a8\u5361\u94b3/u.test(normalized)
  if (!mentionsCaliper) return { detected: false, target: "" }

  const englishTarget = normalized.match(
    /\b(?:paint|repaint|colour|color|make|turn|change)\s+(?:the\s+)?(?:visible\s+)?(?:brake\s*)?calipers?\s*(?:to|into|in)?\s*([a-z][a-z\s-]{1,32})(?:[,.!?;]|$)/i,
  )?.[1]
  if (englishTarget) {
    const target = namedPaintTarget(englishTarget) || safeFreeformPaintTarget(englishTarget, normalized)
    if (target) return { detected: true, target }
  }

  const chineseTarget = normalized.match(
    /(?:\u628a|\u5c06)?(?:\u8fd9\u4e2a|\u8fd9\u5957|\u539f\u8f66|\u73b0\u6709)?(?:\u5239\u8f66|\u5236\u52a8)?\u5361\u94b3(?:\u989c\u8272)?\s*(?:\u6539(?:\u6210|\u4e3a)?|\u6362(?:\u6210|\u4e3a)|\u55b7(?:\u6210|\u4e3a)?|\u6d82(?:\u6210|\u4e3a)?|\u505a\u6210|\u5f04\u6210|\u8c03(?:\u6210|\u4e3a)?)\s*([\u4e00-\u9fffA-Za-z0-9\s-]{1,18}?(?:\u8272|\u7eff|\u9ec4|\u7ea2|\u84dd|\u9ed1|\u767d|\u7070|\u94f6|\u7d2b|\u7c89|\u6a59))/u,
  )?.[1]
  if (chineseTarget) return { detected: true, target: namedPaintTarget(chineseTarget) || chineseTarget.trim() }

  const colorOnlyRequest =
    /\b(?:paint|repaint|colour|color)\s+(?:the\s+)?(?:visible\s+)?(?:brake\s*)?calipers?\b|\b(?:brake\s*)?calipers?\s+(?:colour|color)\b|\u5361\u94b3(?:\u989c\u8272)?\s*\u6539\u8272|\u5361\u94b3\u989c\u8272/u.test(
      normalized,
    )
  return colorOnlyRequest ? { detected: true, target: "" } : { detected: false, target: "" }
}

function previousPaintTarget(previous?: GenerationStandardJson | null) {
  if (!previous || previous.paint?.action !== "change") return ""
  return previous.paint.target || ""
}

function inferPaint(text: string): GenerationStandardJson["paint"] {
  const target = inferPaintTarget(text)
  if (target) {
    return {
      action: "change",
      target,
      prompt: buildPaintInstruction(target, text),
    }
  }
  return keepOriginalPaint()
}

function inferEffectivePaint(input: BuildChatSpecInput): GenerationStandardJson["paint"] {
  const localPaint = inferPaint(input.text)
  if (localPaint.action === "change") return localPaint
  const fallbackPaint = validFallbackIntent(input.fallbackIntent)?.paint
  if (!fallbackPaint || fallbackPaint.action !== "change" || fallbackPaint.confidence < CHAT_FALLBACK_CONFIDENCE || !fallbackPaint.target.trim()) return localPaint
  const target = fallbackPaint.target.trim()
  return {
    action: "change",
    target,
    prompt: buildPaintInstruction(target, `${input.text} ${target}`),
  }
}

function keepOriginalPaint(): GenerationStandardJson["paint"] {
  return {
    action: "keep_original",
    target: "\u539f\u8f66\u6f06\u9762",
    prompt:
      "\u4fdd\u6301\u539f\u8f66\u8f66\u8eab\u6f06\u9762\u989c\u8272\u3001\u8272\u76f8\u3001\u5149\u6cfd\u3001\u53cd\u5c04\u548c\u9493\u91d1\u9762\u8fde\u7eed\u6027\u3002",
  }
}

function inferPaintTarget(text: string) {
  const normalized = text.trim()
  if (!normalized || keepOriginalPaintPattern.test(normalized)) return ""
  const explicit = explicitPaintTarget(normalized)
  if (explicit) return explicit
  if (!bodyPaintIntentPattern.test(normalized)) return ""
  return namedPaintTarget(normalized)
}

function isVaguePaintCorrection(text: string) {
  if (inferPaintTarget(text)) return false
  return vaguePaintCorrectionPattern.test(text)
}

function explicitPaintTarget(text: string) {
  const english = text.match(
    /\b(?:change|make|turn|paint|repaint|wrap)\s+(?:the\s+)?(?:car|vehicle|body|paint|colour|color|it)?\s*(?:to|into)?\s*([a-z][a-z\s-]{1,32})(?:[,.!?;]|$)/i,
  )
  const englishTarget = english?.[1]?.trim().replace(/\s+/g, " ")
  if (englishTarget) {
    const namedEnglish = namedPaintTarget(englishTarget)
    if (namedEnglish) return namedEnglish
    const safeEnglish = safeFreeformPaintTarget(englishTarget, english?.[0] || "")
    if (safeEnglish) return safeEnglish
  }

  const chinese = text.match(
    /(?:\u628a(?:\u8fd9\u8f86|\u8fd9\u4e2a)?\u8f66(?:\u8eab)?|\u8f66\u8eab|\u6574\u8f66|\u8f66\u6f06|\u8f66\u8863|\u8d34\u819c)?\s*(?:\u6539(?:\u6210|\u4e3a)?|\u53d8\u6210|\u6362\u6210|\u55b7\u6210|\u8d34\u6210|\u505a\u6210|\u5f04\u6210|\u8c03(?:\u6210|\u4e3a)|\u5f00\u6210)\s*([\u4e00-\u9fffA-Za-z0-9\s-]{1,24}?(?:\u8272|\u7eff|\u9ec4|\u7ea2|\u84dd|\u9ed1|\u767d|\u7070|\u94f6|\u7d2b|\u7c89|\u6a59))/u,
  )
  const chineseTarget = chinese?.[1]?.trim().replace(/\s+/g, " ")
  if (chineseTarget) return namedPaintTarget(chineseTarget) || chineseTarget

  return ""
}

function safeFreeformPaintTarget(target: string, commandText: string) {
  const normalized = target
    .toLowerCase()
    .replace(/\b(?:the\s+)?(?:car|vehicle|body|paint|colour|color|it)\b/g, " ")
    .replace(/[^a-z0-9 -]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  if (!normalized || normalized.length < 3 || normalized.length > 32) return ""
  if (/\b(?:lower|lowered|stance|height|wheel|wheels|hood|bonnet|mirror|mirrors|spoiler|wing|bumper|diffuser|exhaust|light|lights|grille)\b/i.test(normalized)) {
    return ""
  }
  const paintVerb = /\b(?:paint|repaint|wrap)\b/i.test(commandText)
  const colorCue =
    /\b(?:teal|cyan|aqua|turquoise|mint|olive|lime|maroon|burgundy|wine|champagne|ivory|cream|bronze|copper|navy|violet|lavender|magenta|midnight|candy|metallic|satin|matte|gloss|pearl|gold|silver|grey|gray|black|white|red|blue|green|yellow|orange|purple|pink|brown|beige)\b/i.test(
      normalized,
    )
  if (!paintVerb && !colorCue) return ""
  return normalized
}

function namedPaintTarget(text: string) {
  const value = text.toLowerCase()
  const candidates: Array<[RegExp, string]> = [
    [/\b(?:army|military)\s*green\b|\u519b\u7eff(?:\u8272)?/iu, "\u519b\u7eff\u8272"],
    [/\b(?:dark|deep|forest|british racing)\s*green\b|\u58a8\u7eff(?:\u8272)?|\u6df1\u7eff(?:\u8272)?|\u68ee\u6797\u7eff(?:\u8272)?/iu, "\u6df1\u7eff\u8272"],
    [/\bgreen\b|\u7eff(?:\u8272)?/iu, "\u7eff\u8272"],
    [/\b(?:egg|lemon|bright|racing)?\s*yellow\b|\u86cb\u9ec4(?:\u8272)?|\u660e\u9ec4(?:\u8272)?|\u9ec4(?:\u8272)?/iu, "\u9ec4\u8272"],
    [/\bnardo\s*gr[ae]y\b|\u7eb3\u591a\u7070/iu, "\u7eb3\u591a\u7070"],
    [/\b(?:gr[ae]y|silver)\b|\u7070(?:\u8272)?|\u94f6(?:\u8272)?|\u6c34\u6ce5\u7070/iu, "\u7070\u8272"],
    [/\b(?:pearl\s*)?white\b|\u73cd\u73e0\u767d|\u767d(?:\u8272)?/iu, "\u767d\u8272"],
    [/\bblack\b|\u9ed1(?:\u8272)?|\u4eae\u9ed1|\u54d1\u5149\u9ed1/iu, "\u9ed1\u8272"],
    [/\bred\b|\u7ea2(?:\u8272)?|\u6cd5\u62c9\u5229\u7ea2/iu, "\u7ea2\u8272"],
    [/\bblue\b|\u84dd(?:\u8272)?/iu, "\u84dd\u8272"],
    [/\bpurple\b|\u7d2b(?:\u8272)?/iu, "\u7d2b\u8272"],
    [/\bpink\b|\u7c89(?:\u8272)?/iu, "\u7c89\u8272"],
    [/\borange\b|\u6a59(?:\u8272)?/iu, "\u6a59\u8272"],
    [/\bgold(?:en)?\b|\u91d1(?:\u8272)?/iu, "\u91d1\u8272"],
    [/\b(?:brown|coffee)\b|\u68d5(?:\u8272)?|\u5496\u5561(?:\u8272)?/iu, "\u68d5\u8272"],
    [/\bbeige\b|\u7c73(?:\u8272)?/iu, "\u7c73\u8272"],
  ]
  return candidates.find(([pattern]) => pattern.test(value))?.[1] || ""
}

function buildPaintInstruction(target: string, text: string) {
  const modifiers = new Set<string>()
  if (darkPaintTonePattern.test(text)) modifiers.add("darker, deeper, lower-brightness")
  if (mattePaintTonePattern.test(text)) modifiers.add("matte or satin")
  if (glossPaintTonePattern.test(text)) modifiers.add("glossy")
  const modifierText = modifiers.size ? ` Finish preference: ${Array.from(modifiers).join("; ")}.` : ""
  return [
    `Change only the vehicle body paint to ${target}.`,
    modifierText,
    "Preserve the source vehicle identity, body shape, panel gaps, headlights, glass, wheels, tires, license plate shape, black plastic trim, carbon fiber parts, grille, rear wing or spoiler, camera angle, lighting, and background.",
    "Do not tint glass, lights, wheels, tires, license plate, black plastic trim, carbon fiber parts, grille, rear wing or spoiler, ground, nearby cars, or the background with the requested body color.",
  ]
    .filter(Boolean)
    .join(" ")
}

const keepOriginalPaintPattern =
  /\b(?:keep|preserve)\s+(?:the\s+)?(?:original|factory)\s+(?:paint|colou?r)\b|\u4fdd\u6301.{0,8}(?:\u539f\u8f66|\u539f\u5382).{0,8}(?:\u989c\u8272|\u8f66\u6f06)|\u4e0d\u8981\u6539\u8272|\u4e0d\u6539\u8272/iu
const bodyPaintIntentPattern =
  /\b(?:paint|repaint|wrap|colour|color|make|turn|change)\b|\u6539\u8272|\u8f66\u6f06|\u8f66\u8eab|\u6574\u8f66|\u8fd9\u8f86\u8f66|\u8fd9\u4e2a\u8f66|\u8f66\u8863|\u8d34\u819c|\u55b7\u6f06|\u6539(?:\u6210|\u4e3a)?|\u53d8\u6210|\u6362\u6210|\u55b7\u6210|\u8d34\u6210|\u505a\u6210|\u5f04\u6210|\u8c03(?:\u6210|\u4e3a)|\u5f00\u6210/iu
const darkPaintTonePattern = /\b(?:dark|darker|deep|deeper|less\s+bright|lower\s+brightness)\b|\u66f4\u6df1|\u6df1\u4e00\u70b9|\u6df1\u4e00\u4e9b|\u4e0d\u8981\u90a3\u4e48\u4eae|\u4e0d\u8981\u592a\u4eae|\u4f4e\u4eae\u5ea6|\u6697\u4e00\u70b9/iu
const mattePaintTonePattern = /\b(?:matte|satin|frosted)\b|\u54d1\u5149|\u78e8\u7802|\u534a\u54d1/iu
const glossPaintTonePattern = /\b(?:gloss|glossy|shiny)\b|\u4eae\u9762|\u9ad8\u4eae/iu
const vaguePaintCorrectionPattern =
  /\b(?:not\s+this\s+colou?r|wrong\s+colou?r|too\s+bright|too\s+dark|make\s+it\s+darker)\b|\u4e0d\u662f\u8fd9\u79cd.{0,8}(?:\u8272|\u7eff|\u9ec4|\u7ea2|\u84dd|\u9ed1|\u767d|\u7070)|\u4e0d\u5bf9.{0,8}(?:\u8272|\u7eff|\u9ec4|\u7ea2|\u84dd|\u9ed1|\u767d|\u7070)|\u592a\u4eae|\u592a\u6d45|\u592a\u6df1/iu

function legacyInferPaint(text: string): GenerationStandardJson["paint"] {
  const lower = text.toLowerCase()
  if (lower.includes("black") || lower.includes("黑")) {
    return { action: "change", target: "亮黑色", prompt: "将车身漆面改为深亮黑色，同时保留原图反射和钣金几何结构。" }
  }
  if (lower.includes("white") || lower.includes("白")) {
    return { action: "change", target: "珍珠白", prompt: "将车身漆面改为珍珠白，保留真实光泽和环境反射。" }
  }
  if (lower.includes("blue") || lower.includes("蓝") || lower.includes("藍")) {
    return { action: "change", target: "赛车蓝", prompt: "将车身漆面改为高饱和赛车蓝，保留自然高光和阴影。" }
  }
  if (lower.includes("red") || lower.includes("红") || lower.includes("紅")) {
    return { action: "change", target: "赛道红", prompt: "将车身漆面改为鲜明赛道红，保留真实清漆反射。" }
  }
  if (lower.includes("gray") || lower.includes("grey") || lower.includes("灰") || lower.includes("银") || lower.includes("銀")) {
    return { action: "change", target: "纳多灰", prompt: "将车身漆面改为中性纳多灰，同时保持原图光照和反射一致。" }
  }
  return {
    action: "keep_original",
    target: "原厂车漆",
    prompt: "保持原车车身漆面颜色、色相、光泽、反射和钣金面连续性。",
  }
}

function inferStance(text: string): GenerationStandardJson["stance"] {
  return stanceFromId(stancePresetIdFromText(text) ?? "slight_lower")
}

function legacyInferStance(text: string): GenerationStandardJson["stance"] {
  const lower = text.toLowerCase()
  const value =
    lower.includes("aggressive") || lower.includes("低趴") || lower.includes("贴地") || lower.includes("戰鬥") || lower.includes("战斗")
      ? 82
      : lower.includes("flush") || lower.includes("lower") || lower.includes("降低") || lower.includes("齐边") || lower.includes("齊邊")
        ? 66
        : 45
  return { value, label: stanceLabel(value), prompt: `应用车身姿态等级 ${value}（${stanceLabel(value)}）。轮胎与轮拱关系必须真实。` }
}

function inferEffectiveStance(input: BuildChatSpecInput): GenerationStandardJson["stance"] {
  if (hasStanceRequestText(input.text)) return inferStance(input.text)
  const fallbackStance = validFallbackIntent(input.fallbackIntent)?.stance
  if (!fallbackStance || fallbackStance.confidence < CHAT_FALLBACK_CONFIDENCE) return stanceFromId("slight_lower")
  return stancePresetFromValue(Number(fallbackStance.value))
}

function legacyInferEffectiveStance(input: BuildChatSpecInput): GenerationStandardJson["stance"] {
  if (hasStanceRequestText(input.text)) return inferStance(input.text)
  const fallbackStance = validFallbackIntent(input.fallbackIntent)?.stance
  if (!fallbackStance || fallbackStance.confidence < CHAT_FALLBACK_CONFIDENCE) return inferStance(input.text)
  const value = clampNumber(Number(fallbackStance.value), 0, 100)
  const label = fallbackStance.label.trim() || stanceLabel(value)
  return {
    value,
    label,
    prompt: `应用车身姿态等级 ${value}（${label}）。轮胎与轮拱关系必须真实。`,
  }
}

function defaultChatStance(): GenerationStandardJson["stance"] {
  return stanceFromId("stock")
}

function legacyDefaultChatStance(): GenerationStandardJson["stance"] {
  return { value: 0, label: "保持原车高度", prompt: "" }
}

function hasStanceRequestText(text: string) {
  return hasChatStanceRequestText(text)
}

function legacyHasStanceRequestText(text: string) {
  if (/不降低|不要降低|别降低|无需降低|保持.{0,6}(车高|高度|姿态)|原车高度|原厂高度/i.test(text)) return false
  return /\b(stance|lower|lowered|lowering|flush|aggressive|ride\s*height)\b|降低|降车身|低趴|贴地|齐边|姿态|车高|车身高度/i.test(text)
}

function hasEffectiveStanceRequest(input: BuildChatSpecInput) {
  if (hasStanceRequestText(input.text)) return true
  const fallbackStance = validFallbackIntent(input.fallbackIntent)?.stance
  return Boolean(fallbackStance && fallbackStance.confidence >= CHAT_FALLBACK_CONFIDENCE)
}

function extractStyleKeywords(text: string) {
  const lower = text.toLowerCase()
  const keywords = ["真实照片局部编辑", "汽车改装效果图"]
  if (carbonPattern.test(text)) keywords.push("可见碳纤维")
  if (lower.includes("street") || lower.includes("街道")) keywords.push("街道风格")
  if (lower.includes("track") || lower.includes("赛道") || lower.includes("賽道")) keywords.push("赛道风格")
  return keywords
}

function stanceLabel(value: number): string {
  if (value <= 24) return "原厂高度"
  if (value <= 49) return "轻微降低"
  if (value <= 74) return "齐边降低"
  return "激进赛道姿态"
}

function categoryLabel(category: PartCategory | undefined, fallback: string) {
  return category?.labelZh || category?.label || category?.labelEn || fallback
}

function defaultConstraints() {
  return {
    preserveBackground: true,
    preserveCameraAngle: true,
    preserveLighting: true,
    preserveLicensePlateShape: true,
    preserveVehicleIdentity: true,
    preserveUnselectedParts: true,
    selectedOnly: true,
  }
}
