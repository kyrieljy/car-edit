"use client"

import type { CSSProperties } from "react"
import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { BadgeCheck, Car, ChevronDown, CircleHelp, Eye, Palette, SlidersHorizontal } from "lucide-react"
import type {
  CatalogResponse,
  PartAsset,
  PartCategory,
  PartSelectionOptions,
  SelectionMap,
} from "@/lib/types"

export type Language = "en" | "zh"

export type ExhaustLayoutGroup = {
  id: string
  label: { zh: string; en: string }
  assetIds: string[]
  childLabels: Record<string, { zh: string; en: string }>
}

export const styleSurfaceCategoryIds = new Set(["rear-wing", "side-skirts", "front-bumper"])

export function isBrandResourceCategory(category: PartCategory | undefined): boolean {
  return (category?.configType ?? "brand_resource") === "brand_resource"
}

export function isResourceNoImageCategory(category: PartCategory | undefined): boolean {
  return category?.configType === "resource" && category.assetImageVisible === false
}

export function isResourceSubcategoryCategory(category: PartCategory | undefined): boolean {
  return category?.configType === "resource_subcategory"
}

export function isResourceWithImageCategory(category: PartCategory | undefined): boolean {
  return category?.configType === "resource" && category.assetImageVisible !== false
}

export function ExhaustPipeIcon({ size = 17, strokeWidth = 2.2 }: { size?: number; strokeWidth?: number }) {
  return <Car size={size} strokeWidth={strokeWidth} aria-hidden="true" focusable="false" />
}

export const wingStyleInfoById: Record<string, { zh: string; en: string; description: string }> = {
  "wing-ducktail": {
    zh: "鸭尾",
    en: "Ducktail",
    description:
      "贴着后备箱/尾门边缘微微上翘，比较低调。常见于性能街车、复古车、M 系/AMG/R 系一些改装。主要作用是轻微改善尾部气流，视觉上让车尾更翘、更运动。",
  },
  "wing-lip-spoiler": {
    zh: "小尾翼",
    en: "Lip Spoiler",
    description: "比鸭尾更薄，有点像一条贴片，很多原厂运动套件会用。装饰属性更强，对高速下压力帮助有限，但日常最协调，也最不容易显得夸张。",
  },
  "wing-gt-wing": {
    zh: "高脚尾翼",
    en: "GT Wing",
    description: "GT3 赛车常见，翼面和车身分离，有支架。更偏赛道，理论上能产生更明显的下压力，但角度、宽度、高度、安装位置都很关键。",
  },
  "wing-swan-neck": {
    zh: "天鹅颈尾翼",
    en: "Swan Neck",
    description: "支架从翼面上方连接，常见于 GT3 RS、GT4 赛车等。好处是翼面下方气流更干净，空气动力效率更高。视觉也更赛车化，改装成本和突兀感都更高。",
  },
  "wing-time-attack": {
    zh: "双层尾翼",
    en: "Time Attack Wing",
    description: "有主翼加副翼，或者上下两层，常见于赛车、Time Attack 改装。下压力更强，但也更夸张。",
  },
}

export const dryCarbonParts = [
  { id: "hood", assetId: "dry-carbon-hood", label: { zh: "机盖", en: "Hood" } },
  { id: "mirrors", assetId: "dry-carbon-mirrors", label: { zh: "后视镜", en: "Mirrors" } },
  { id: "fenders", assetId: "dry-carbon-fenders", label: { zh: "叶子板", en: "Fenders" } },
  { id: "trunk-lid", assetId: "dry-carbon-trunk-lid", label: { zh: "后备箱盖", en: "Trunk lid" } },
] as const

export const riskInfoCategoryIds = new Set(["hood", "front-bumper", "trunk-lid", "rear-wing", "exhaust"])

export function riskTooltipText(language: Language) {
  return language === "zh"
    ? "该配件受上传照片影响，可能不生成"
    : "This part is affected by the uploaded photo and may not be generated."
}

export const surfaceColorOptions = [
  { id: "black", swatch: "#050506", label: { zh: "黑色", en: "Black" } },
  { id: "exposed_carbon", swatch: "#202226", label: { zh: "碳纤维", en: "Carbon fiber" } },
  { id: "body_color", swatch: "linear-gradient(135deg, #f8fafc, #64748b)", label: { zh: "车身同色", en: "Body color" } },
] as const

export const caliperColorOptions = [
  { id: "red", swatch: "#d71920", label: { zh: "红色", en: "Red" } },
  { id: "blue", swatch: "#2563eb", label: { zh: "蓝色", en: "Blue" } },
  { id: "black", swatch: "#050506", label: { zh: "黑色", en: "Black" } },
  { id: "orange", swatch: "#f97316", label: { zh: "橙色", en: "Orange" } },
  { id: "yellow", swatch: "#f2c230", label: { zh: "黄色", en: "Yellow" } },
  { id: "green", swatch: "#16a34a", label: { zh: "绿色", en: "Green" } },
  { id: "nickel", swatch: "#9ca3af", label: { zh: "镀镍色", en: "Nickel" } },
  { id: "white", swatch: "#f8fafc", label: { zh: "白色", en: "White" } },
  { id: "pink", swatch: "#ec4899", label: { zh: "粉色", en: "Pink" } },
  { id: "purple", swatch: "#8b5cf6", label: { zh: "紫色", en: "Purple" } },
] as const

export const rotorOptions = [
  { id: "stock", label: { zh: "不变", en: "Stock rotor" } },
  { id: "big_brake", label: { zh: "加大刹车盘", en: "Big brake rotor" } },
  { id: "carbon_ceramic", label: { zh: "碳陶瓷刹车盘", en: "Carbon ceramic" } },
] as const

export function selectedDryCarbonPartsFor(selections: SelectionMap) {
  return dryCarbonParts.filter((part) => selections[part.id] === part.assetId)
}

export function displayDryCarbonCategorySelectionStatus(language: Language, parts: Array<(typeof dryCarbonParts)[number]>) {
  if (!parts.length) return language === "zh" ? "未选择" : "Not selected"
  const labels = parts.map((part) => part.label[language]).join(language === "zh" ? "、" : ", ")
  return language === "zh" ? `已选择：${labels}` : `Selected: ${labels}`
}

export function dryCarbonPartMatchesSearch(part: (typeof dryCarbonParts)[number], asset: PartAsset | undefined, search: string, language: Language) {
  if (!search) return true
  const text = [part.label.zh, part.label.en, part.label[language], asset?.brand, asset?.model, asset?.variant, asset?.color, asset?.finish, asset?.keywords]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
  return text.includes(search)
}

export function DryCarbonPartsList({
  language,
  catalog,
  selections,
  focusedAssetId,
  assetRefs,
  search,
  toggleDryCarbonPart,
}: {
  language: Language
  catalog: CatalogResponse
  selections: SelectionMap
  focusedAssetId: string
  assetRefs: { current: Record<string, HTMLButtonElement | null> }
  search: string
  toggleDryCarbonPart: (part: (typeof dryCarbonParts)[number]) => void
}) {
  const assetsById = useMemo(() => new Map(catalog.assets.map((asset) => [asset.id, asset])), [catalog.assets])
  const visibleParts = dryCarbonParts.filter((part) => dryCarbonPartMatchesSearch(part, assetsById.get(part.assetId), search, language))
  const [riskPopup, setRiskPopup] = useState<{ id: string; top: number; left: number; width: number } | null>(null)

  useEffect(() => {
    if (!riskPopup) return
    const close = () => setRiskPopup(null)
    window.addEventListener("scroll", close, true)
    window.addEventListener("resize", close)
    return () => {
      window.removeEventListener("scroll", close, true)
      window.removeEventListener("resize", close)
    }
  }, [riskPopup])

  const showRiskPopup = (element: HTMLElement, id: string) => {
    const rect = element.getBoundingClientRect()
    const width = Math.min(320, window.innerWidth - 24)
    const left = Math.min(window.innerWidth - width - 12, Math.max(12, rect.left))
    const top = Math.min(window.innerHeight - 80, Math.max(12, rect.bottom + 8))
    setRiskPopup({ id, top, left, width })
  }

  if (!visibleParts.length) {
    return <div className="empty-category">{language === "zh" ? "没有匹配的干碳纤维部件" : "No matching dry carbon parts"}</div>
  }

  return (
    <>
      <div className="wing-style-list dry-carbon-list">
        {visibleParts.map((part) => {
          const asset = assetsById.get(part.assetId)
          if (!asset) return null
          const selected = selections[part.id] === part.assetId
          return (
            <article key={part.id} className={`wing-style-row dry-carbon-row${selected ? " selected" : ""}${focusedAssetId === asset.id ? " spotlight" : ""}`}>
              <div className="wing-style-trigger">
                <button
                  ref={(node) => {
                    assetRefs.current[asset.id] = node
                  }}
                  type="button"
                  data-asset-id={asset.id}
                  className="wing-style-main dry-carbon-main"
                  aria-pressed={selected}
                  onClick={() => toggleDryCarbonPart(part)}
                >
                  <span className="wing-style-thumb">
                    <AssetImage asset={asset} />
                  </span>
                  <span className="wing-style-copy">
                    <strong>{part.label[language]}</strong>
                    <small>{language === "zh" ? "裸碳局部材质" : "Exposed carbon part"}</small>
                  </span>
                  {selected && <BadgeCheck className="wing-style-selected-mark" size={17} />}
                </button>
                {riskInfoCategoryIds.has(part.id) && (
                  <button
                    type="button"
                    className={`wing-style-info-button${riskPopup?.id === part.id ? " active" : ""}`}
                    aria-label={language === "zh" ? `${part.label[language]}风险提示` : `${part.label[language]} risk notice`}
                    onClick={(event) => {
                      event.stopPropagation()
                      if (riskPopup?.id === part.id) setRiskPopup(null)
                      else showRiskPopup(event.currentTarget, part.id)
                    }}
                    onFocus={(event) => showRiskPopup(event.currentTarget, part.id)}
                    onBlur={() => setRiskPopup(null)}
                    onMouseEnter={(event) => showRiskPopup(event.currentTarget, part.id)}
                    onMouseLeave={() => setRiskPopup(null)}
                  >
                    <CircleHelp size={17} />
                  </button>
                )}
              </div>
            </article>
          )
        })}
      </div>
      {riskPopup &&
        createPortal(
          <div
            className="wing-style-popover wing-style-popover-hover"
            style={{ top: riskPopup.top, left: riskPopup.left, "--wing-style-popover-width": `${riskPopup.width}px` } as CSSProperties}
            role="tooltip"
          >
            <p>{riskTooltipText(language)}</p>
          </div>,
          document.body,
        )}
    </>
  )
}

export function WingStyleList({
  language,
  assets,
  selectedAssetId,
  focusedAssetId,
  assetRefs,
  selectionOptions,
  selectAsset,
  updatePartSelectionOption,
}: {
  language: Language
  assets: PartAsset[]
  selectedAssetId?: string
  focusedAssetId: string
  assetRefs: { current: Record<string, HTMLButtonElement | null> }
  selectionOptions: PartSelectionOptions
  selectAsset: (asset: PartAsset) => void
  updatePartSelectionOption: (categoryId: string, patch: PartSelectionOptions[string]) => void
}) {
  const [infoPopup, setInfoPopup] = useState<{ assetId: string; body: string; top: number; left: number; width: number } | null>(null)
  const fixedAssets = assets.filter((asset) => wingStyleInfoById[asset.id])
  const visibleAssets = fixedAssets.length ? fixedAssets : assets

  useEffect(() => {
    if (!infoPopup) return
    const close = () => setInfoPopup(null)
    window.addEventListener("scroll", close, true)
    window.addEventListener("resize", close)
    return () => {
      window.removeEventListener("scroll", close, true)
      window.removeEventListener("resize", close)
    }
  }, [infoPopup])

  const showInfoPopup = (button: HTMLElement, assetId: string, body: string) => {
    const rect = button.getBoundingClientRect()
    const width = Math.min(390, window.innerWidth - 24)
    const preferredLeft = rect.right + 12
    const left = Math.min(window.innerWidth - width - 12, Math.max(12, preferredLeft))
    const top = Math.min(window.innerHeight - 96, Math.max(12, rect.top + rect.height / 2 - 34))
    setInfoPopup({ assetId, body, top, left, width })
  }

  return (
    <>
      <div className="wing-style-list">
        {visibleAssets.map((asset) => {
          const selected = selectedAssetId === asset.id
          const info = wingStyleInfoById[asset.id]
          const title = info ? (language === "zh" ? info.zh : info.en) : displayAssetTitle(asset)
          const subtitle = info ? (language === "zh" ? info.en : info.zh) : displayAssetSubtitle(asset)
          const infoOpen = infoPopup?.assetId === asset.id
          const description = info?.description || asset.promptHint || asset.finish
          return (
            <article key={asset.id} className={`wing-style-row${selected ? " selected" : ""}${infoOpen ? " info-open" : ""}${focusedAssetId === asset.id ? " spotlight" : ""}`}>
              <div className="wing-style-trigger">
                <button
                  ref={(node) => {
                    assetRefs.current[asset.id] = node
                  }}
                  type="button"
                  data-asset-id={asset.id}
                  className="wing-style-main"
                  aria-pressed={selected}
                  onClick={() => {
                    setInfoPopup(null)
                    selectAsset(asset)
                  }}
                >
                  <span className="wing-style-thumb">
                    <AssetImage asset={asset} />
                  </span>
                  <span className="wing-style-copy">
                    <strong>{title}</strong>
                    <small>{subtitle}</small>
                  </span>
                  {selected && <BadgeCheck className="wing-style-selected-mark" size={17} />}
                </button>
                {info && (
                  <button
                    type="button"
                    className={`wing-style-info-button${infoOpen ? " active" : ""}`}
                    aria-expanded={infoOpen}
                    aria-label={language === "zh" ? `${title}说明` : `${subtitle || title} info`}
                    onClick={(event) => event.stopPropagation()}
                    onFocus={(event) => showInfoPopup(event.currentTarget, asset.id, description)}
                    onBlur={() => setInfoPopup(null)}
                    onMouseEnter={(event) => showInfoPopup(event.currentTarget, asset.id, description)}
                    onMouseLeave={() => setInfoPopup(null)}
                  >
                    <CircleHelp size={17} />
                  </button>
                )}
              </div>
              <div className="wing-style-content" aria-hidden={!selected}>
                <div className="wing-style-content-inner">
                  <WingSurfaceControls
                    language={language}
                    asset={asset}
                    selectionOptions={selectionOptions}
                    updatePartSelectionOption={updatePartSelectionOption}
                  />
                </div>
              </div>
            </article>
          )
        })}
      </div>
      {infoPopup &&
        createPortal(
          <div
            className="wing-style-popover wing-style-popover-hover"
            style={{ top: infoPopup.top, left: infoPopup.left, "--wing-style-popover-width": `${infoPopup.width}px` } as CSSProperties}
            role="tooltip"
          >
            <p>{infoPopup.body}</p>
          </div>,
          document.body,
        )}
    </>
  )
}

export function ExhaustLayoutList({
  language,
  assets,
  selectedAssetId,
  focusedAssetId,
  assetRefs,
  selectAsset,
  layoutGroups,
  layoutLabels,
}: {
  language: Language
  assets: PartAsset[]
  selectedAssetId?: string
  focusedAssetId: string
  assetRefs: { current: Record<string, HTMLButtonElement | null> }
  selectAsset: (asset: PartAsset) => void
  layoutGroups: ExhaustLayoutGroup[]
  layoutLabels: Record<string, { zh: string; en: string }>
}) {
  const [expandedGroupId, setExpandedGroupId] = useState("")
  const [previewAssetId, setPreviewAssetId] = useState("")
  const assetById = useMemo(() => new Map(assets.map((asset) => [asset.id, asset])), [assets])

  return (
    <div className="wing-style-list exhaust-layout-list">
      {layoutGroups.map((group) => {
        const groupAssets = group.assetIds.map((assetId) => assetById.get(assetId)).filter((asset): asset is PartAsset => Boolean(asset))
        if (!groupAssets.length) return null
        const selectedAsset = selectedAssetId ? groupAssets.find((asset) => asset.id === selectedAssetId) : undefined
        const selected = Boolean(selectedAsset)
        const expanded = expandedGroupId === group.id
        const hasChildren = groupAssets.length > 1
        const previewAsset = previewAssetId ? groupAssets.find((asset) => asset.id === previewAssetId) : undefined
        const primaryAsset = previewAsset || selectedAsset || groupAssets[0]
        const groupLabel = language === "zh" ? group.label.zh : group.label.en
        const status = selectedAsset
          ? language === "zh"
            ? `已选择：${displayExhaustLayoutLeafLabel(selectedAsset, language, layoutLabels)}`
            : `Selected: ${displayExhaustLayoutLeafLabel(selectedAsset, language, layoutLabels)}`
          : language === "zh"
            ? "未选择"
            : "Not selected"

        return (
          <article key={group.id} className={`wing-style-row exhaust-layout-row${expanded ? " expanded" : ""}${groupAssets.some((asset) => asset.id === focusedAssetId) ? " spotlight" : ""}`}>
            <div className="wing-style-trigger">
              <button
                ref={(node) => {
                  groupAssets.forEach((asset) => {
                    assetRefs.current[asset.id] = node
                  })
                }}
                type="button"
                data-asset-id={selectedAsset?.id || groupAssets[0].id}
                className="wing-style-main exhaust-layout-main"
                aria-expanded={hasChildren ? expanded : undefined}
                aria-pressed={selected}
                onClick={() => {
                  if (hasChildren) {
                    setExpandedGroupId((current) => (current === group.id ? "" : group.id))
                    return
                  }
                  setExpandedGroupId("")
                  selectAsset(groupAssets[0])
                }}
              >
                <span className="wing-style-thumb">
                  <AssetImage asset={primaryAsset} />
                </span>
                <span className="wing-style-copy">
                  <strong>{groupLabel}</strong>
                  <small>{status}</small>
                </span>
                {selected ? (
                  <BadgeCheck className="wing-style-selected-mark" size={17} />
                ) : hasChildren ? (
                  <ChevronDown className={`exhaust-layout-chevron${expanded ? " expanded" : ""}`} size={17} />
                ) : (
                  <span aria-hidden="true" />
                )}
              </button>
            </div>
            {hasChildren && (
              <div className="wing-style-content exhaust-layout-content" aria-hidden={!expanded}>
                <div className="wing-style-content-inner">
                  <div className="exhaust-layout-children">
                    <strong className="exhaust-layout-icon" aria-label={language === "zh" ? "排气位置" : "Exhaust position"} title={language === "zh" ? "排气位置" : "Exhaust position"}>
                      <ExhaustPipeIcon />
                    </strong>
                    <div className="exhaust-layout-option-row">
                      {groupAssets.map((asset) => {
                        const childSelected = selectedAssetId === asset.id
                        const childLabel = childExhaustLayoutLabel(group, asset.id, language)
                        return (
                          <button
                            key={asset.id}
                            type="button"
                            data-asset-id={asset.id}
                            className={`exhaust-layout-child${childSelected ? " selected" : ""}${focusedAssetId === asset.id ? " spotlight" : ""}`}
                            aria-pressed={childSelected}
                            onMouseEnter={() => setPreviewAssetId(asset.id)}
                            onMouseLeave={() => setPreviewAssetId("")}
                            onFocus={() => setPreviewAssetId(asset.id)}
                            onBlur={() => setPreviewAssetId("")}
                            onClick={() => {
                              setPreviewAssetId("")
                              selectAsset(asset)
                            }}
                          >
                            {childLabel}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </article>
        )
      })}
    </div>
  )
}

export function SurfaceInstallControl({
  language,
  asset,
  selectedAssetId,
  focusedAssetId,
  assetRefs,
  selectionOptions,
  selectAsset,
  updatePartSelectionOption,
}: {
  language: Language
  asset: PartAsset
  selectedAssetId?: string
  focusedAssetId: string
  assetRefs: { current: Record<string, HTMLButtonElement | null> }
  selectionOptions: PartSelectionOptions
  selectAsset: (asset: PartAsset) => void
  updatePartSelectionOption: (categoryId: string, patch: PartSelectionOptions[string]) => void
}) {
  const [previewPopup, setPreviewPopup] = useState<{ top: number; left: number; width: number } | null>(null)
  const selected = selectedAssetId === asset.id
  const title = displayAssetTitle(asset)
  const ariaLabel = selected ? (language === "zh" ? `取消安装${title}` : `Remove ${title}`) : language === "zh" ? `安装${title}` : `Install ${title}`

  useEffect(() => {
    if (!previewPopup) return
    const close = () => setPreviewPopup(null)
    window.addEventListener("scroll", close, true)
    window.addEventListener("resize", close)
    return () => {
      window.removeEventListener("scroll", close, true)
      window.removeEventListener("resize", close)
    }
  }, [previewPopup])

  const showPreviewPopup = (button: HTMLElement) => {
    const rect = button.getBoundingClientRect()
    const width = Math.min(300, window.innerWidth - 24)
    const left = Math.min(window.innerWidth - width - 12, Math.max(12, rect.right - width))
    const top = Math.max(12, Math.min(window.innerHeight - 260, rect.bottom + 8))
    setPreviewPopup({ top, left, width })
  }

  return (
    <>
      <div className={`surface-install-control${selected ? " selected" : ""}${previewPopup ? " preview-open" : ""}${focusedAssetId === asset.id ? " spotlight" : ""}`}>
        <button
          ref={(node) => {
            assetRefs.current[asset.id] = node
          }}
          type="button"
          data-asset-id={asset.id}
          className="surface-install-button"
          aria-label={ariaLabel}
          aria-pressed={selected}
          onClick={() => selectAsset(asset)}
        >
          <i aria-hidden="true" />
        </button>
        <div className="surface-install-options">
          <WingSurfaceControls
            language={language}
            asset={asset}
            selectionOptions={selectionOptions}
            updatePartSelectionOption={updatePartSelectionOption}
          />
        </div>
        <button
          type="button"
          className={`surface-preview-button${previewPopup ? " active" : ""}`}
          aria-label={language === "zh" ? `${title}预览图` : `${title} preview`}
          onClick={(event) => event.stopPropagation()}
          onFocus={(event) => showPreviewPopup(event.currentTarget)}
          onBlur={() => setPreviewPopup(null)}
          onMouseEnter={(event) => showPreviewPopup(event.currentTarget)}
          onMouseLeave={() => setPreviewPopup(null)}
        >
          <Eye size={16} />
        </button>
      </div>
      {previewPopup &&
        createPortal(
          <div
            className="surface-preview-popover surface-preview-popover-hover"
            style={{
              top: previewPopup.top,
              left: previewPopup.left,
              "--surface-preview-popover-width": `${previewPopup.width}px`,
              "--surface-preview-object-position": asset.imageCrop || "center",
            } as CSSProperties}
            role="tooltip"
          >
            <img src={asset.imageUrl} alt={title} />
          </div>,
          document.body,
        )}
    </>
  )
}

export function WingSurfaceControls({
  language,
  asset,
  selectionOptions,
  updatePartSelectionOption,
}: {
  language: Language
  asset: PartAsset
  selectionOptions: PartSelectionOptions
  updatePartSelectionOption: (categoryId: string, patch: PartSelectionOptions[string]) => void
}) {
  const activeSurface = selectionOptions[asset.categoryId]?.surfaceColor || inferDefaultSurfaceColor(asset)
  return (
    <div className="wing-surface-controls">
      <strong className="wing-surface-icon-label" aria-label={language === "zh" ? "颜色" : "Color"} title={language === "zh" ? "颜色" : "Color"}>
        <Palette size={15} strokeWidth={2.2} />
      </strong>
      <div className="wing-surface-row" aria-label={language === "zh" ? "颜色/材质" : "Color/material"}>
        {surfaceColorOptions.map((option) => {
          const selected = activeSurface === option.id
          return (
            <button
              key={option.id}
              type="button"
              className={`wing-surface-chip${selected ? " selected" : ""}`}
              aria-pressed={selected}
              onClick={() => updatePartSelectionOption(asset.categoryId, { surfaceColor: option.id })}
            >
              {option.label[language]}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function CaliperCaseList({
  language,
  assets,
  selectedAssetId,
  expandedAssetId,
  focusedAssetId,
  assetRefs,
  selectionOptions,
  selectAsset,
  setExpandedAssetId,
  updatePartSelectionOption,
}: {
  language: Language
  assets: PartAsset[]
  selectedAssetId?: string
  expandedAssetId: string
  focusedAssetId: string
  assetRefs: { current: Record<string, HTMLButtonElement | null> }
  selectionOptions: PartSelectionOptions
  selectAsset: (asset: PartAsset) => void
  setExpandedAssetId: (value: string) => void
  updatePartSelectionOption: (categoryId: string, patch: PartSelectionOptions[string]) => void
}) {
  return (
    <div className="caliper-case-list">
      {assets.map((asset) => {
        const selected = selectedAssetId === asset.id
        const expanded = selected && expandedAssetId === asset.id
        return (
          <article key={asset.id} className={`caliper-case-row${selected ? " selected" : ""}${expanded ? " expanded" : ""}${focusedAssetId === asset.id ? " spotlight" : ""}`}>
            <div className="caliper-case-trigger">
              <button
                ref={(node) => {
                  assetRefs.current[asset.id] = node
                }}
                type="button"
                data-asset-id={asset.id}
                className="caliper-case-main"
                aria-expanded={expanded}
                disabled={!selected}
                onClick={() => setExpandedAssetId(expanded ? "" : asset.id)}
              >
                <span className="caliper-case-thumb">
                  <AssetImage asset={asset} />
                </span>
                <span className="caliper-case-copy">
                  <strong>{displayAssetTitle(asset)}</strong>
                  <small>{displayAssetSubtitle(asset) || asset.finish}</small>
                </span>
                {selected ? <ChevronDown className={`caliper-case-chevron${expanded ? " expanded" : ""}`} size={18} /> : <span aria-hidden="true" />}
              </button>
              <button
                type="button"
                className={`caliper-case-select-button${selected ? " selected" : ""}`}
                aria-pressed={selected}
                onClick={() => {
                  selectAsset(asset)
                  setExpandedAssetId(selected ? "" : asset.id)
                }}
              >
                {selected && <BadgeCheck size={14} />}
                {language === "zh" ? (selected ? "取消" : "选择") : selected ? "Remove" : "Select"}
              </button>
            </div>
            <div className="caliper-case-content" aria-hidden={!expanded}>
              <div className="caliper-case-content-inner">
                <CaliperCaseControls
                  language={language}
                  selectedAsset={asset}
                  selectionOptions={selectionOptions}
                  updatePartSelectionOption={updatePartSelectionOption}
                />
              </div>
            </div>
          </article>
        )
      })}
    </div>
  )
}

export function CaliperCaseControls({
  language,
  selectedAsset,
  selectionOptions,
  updatePartSelectionOption,
}: {
  language: Language
  selectedAsset: PartAsset
  selectionOptions: PartSelectionOptions
  updatePartSelectionOption: (categoryId: string, patch: PartSelectionOptions[string]) => void
}) {
  const activeColor = selectionOptions.calipers?.caliperColor || inferDefaultCaliperColor(selectedAsset)
  const customColorSelected = isHexColorValue(activeColor)
  const customColorValue = customColorSelected ? activeColor : "#d71920"
  const activeRotor = selectionOptions.calipers?.rotorOption || "stock"

  return (
    <div className="caliper-case-controls">
      <div className="caliper-color-dot-row" aria-label={language === "zh" ? "卡钳颜色" : "Caliper color"}>
        {caliperColorOptions.map((option) => {
          const selected = activeColor === option.id
          return (
            <button
              key={option.id}
              type="button"
              className={`caliper-color-dot${selected ? " selected" : ""}`}
              style={{ "--caliper-color": option.swatch } as CSSProperties}
              aria-label={option.label[language]}
              title={option.label[language]}
              aria-pressed={selected}
              onClick={() => updatePartSelectionOption("calipers", { caliperColor: option.id })}
            />
          )
        })}
        <label
          className={`caliper-color-picker${customColorSelected ? " selected" : ""}`}
          aria-label={language === "zh" ? "自定义卡钳颜色" : "Custom caliper color"}
          title={language === "zh" ? "调色" : "Custom"}
        >
          <span style={{ "--caliper-color": customColorValue } as CSSProperties} />
          <Palette size={17} />
          <input type="color" value={customColorValue} onChange={(event) => updatePartSelectionOption("calipers", { caliperColor: event.target.value })} />
        </label>
      </div>
      <div className="caliper-case-control-group caliper-style-control-group">
        <strong className="caliper-style-icon-label" aria-label={language === "zh" ? "样式" : "Style"} title={language === "zh" ? "样式" : "Style"}>
          <SlidersHorizontal size={15} strokeWidth={2.2} />
        </strong>
        <div className="caliper-rotor-row" aria-label={language === "zh" ? "样式选择" : "Style selection"}>
          {rotorOptions.map((option) => {
            const selected = activeRotor === option.id
            return (
              <button
                key={option.id}
                type="button"
                className={`caliper-rotor-option${selected ? " selected" : ""}`}
                aria-pressed={selected}
                onClick={() => updatePartSelectionOption("calipers", { rotorOption: option.id })}
              >
                {option.label[language]}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export function PartOptionsPanel({
  language,
  selectionOptions,
  selectedSurfaceAssets,
  updatePartSelectionOption,
}: {
  language: Language
  selectionOptions: PartSelectionOptions
  selectedSurfaceAssets: PartAsset[]
  updatePartSelectionOption: (categoryId: string, patch: PartSelectionOptions[string]) => void
}) {
  if (selectedSurfaceAssets.length === 0) return null

  return (
    <section className="option-card part-v2-options-card">
      <h2>{language === "zh" ? "配件细项" : "Part options"}</h2>
      {selectedSurfaceAssets.map((asset) => (
        <div key={`surface-${asset.id}`} className="part-v2-option-group">
          <div className="part-v2-option-heading">
            <strong>{displayAssetTitle(asset)}</strong>
            <span>{language === "zh" ? "颜色/材质" : "Color/material"}</span>
          </div>
          <div className="part-v2-segment-row">
            {surfaceColorOptions.map((option) => {
              const selected = (selectionOptions[asset.categoryId]?.surfaceColor || inferDefaultSurfaceColor(asset)) === option.id
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`part-v2-chip${selected ? " selected" : ""}`}
                  aria-pressed={selected}
                  onClick={() => updatePartSelectionOption(asset.categoryId, { surfaceColor: option.id })}
                >
                  <span className="part-v2-swatch" style={{ background: option.swatch }} />
                  {option.label[language]}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </section>
  )
}

export function inferDefaultCaliperColor(asset: PartAsset) {
  const text = [asset.variant, asset.color, asset.keywords].join(" ").toLowerCase()
  if (/yellow|\u9ec4|\u9ec3/.test(text)) return "yellow"
  if (/blue|\u84dd|\u85cd/.test(text)) return "blue"
  if (/black|\u9ed1/.test(text)) return "black"
  if (/silver|\u94f6|\u9280/.test(text)) return "nickel"
  return "red"
}

export function inferDefaultSurfaceColor(asset: PartAsset): "black" | "exposed_carbon" | "body_color" {
  if (asset.defaultColorPolicy === "body_color") return "body_color"
  const text = [asset.variant, asset.color, asset.finish, asset.promptHint].join(" ")
  if (/carbon|\u78b3/i.test(text)) return "exposed_carbon"
  return "black"
}

export function displayExhaustLayoutLeafLabel(asset: PartAsset, language: Language, layoutLabels?: Record<string, { zh: string; en: string }>) {
  const label = layoutLabels?.[asset.id]
  if (label) return language === "zh" ? label.zh : label.en
  return asset.variant || asset.model
}

export function childExhaustLayoutLabel(group: ExhaustLayoutGroup, assetId: string, language: Language) {
  const childLabels = group.childLabels
  const label = childLabels[assetId]
  if (label) return language === "zh" ? label.zh : label.en
  return assetId
}

export function isHexColorValue(value: string | undefined) {
  return /^#[0-9a-fA-F]{6}$/.test((value || "").trim())
}

export function displayAssetTitle(asset: PartAsset, layoutLabels?: Record<string, { zh: string; en: string }>) {
  if (asset.categoryId === "exhaust") return displayExhaustLayoutLeafLabel(asset, "zh", layoutLabels)
  if (styleSurfaceCategoryIds.has(asset.categoryId)) return asset.variant || asset.model
  if (asset.id.startsWith("dry-carbon-")) return asset.variant || asset.model
  return `${asset.brand} ${asset.model}`.trim()
}

export function displayAssetSubtitle(asset: PartAsset) {
  if (asset.categoryId === "exhaust") return asset.model
  if (styleSurfaceCategoryIds.has(asset.categoryId)) return asset.model
  return asset.variant
}

export function displaySelectedAssetSummary(asset: PartAsset, language: Language = "zh", layoutLabels?: Record<string, { zh: string; en: string }>) {
  const title = asset.categoryId === "exhaust" ? displayExhaustLayoutLeafLabel(asset, language, layoutLabels) : displayAssetTitle(asset, layoutLabels)
  if (asset.categoryId !== "wheels") return title
  const details = [displayAssetSubtitle(asset), asset.color, asset.finish]
    .map((value) => value.trim())
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)
  return details.length ? `${title} (${details.join(" / ")})` : title
}

export function AssetImage({ asset }: { asset: PartAsset }) {
  if (asset.imageUrl.endsWith("bbs-lmr-options.png")) {
    const [x = "50%", y = "50%"] = (asset.imageCrop || "50% 50%").split(" ")
    const cropX = Number.parseFloat(x)
    const cropY = Number.parseFloat(y)
    return (
      <span className="wheel-crop">
        <img
          src={asset.imageUrl}
          alt={`${displayAssetTitle(asset)} ${displayAssetSubtitle(asset)}`}
          style={
            {
              "--wheel-x": `${Number.isFinite(cropX) ? -cropX / 2 : -25}%`,
              "--wheel-y": `${Number.isFinite(cropY) ? -cropY / 2 : -25}%`,
            } as CSSProperties
          }
        />
      </span>
    )
  }

  return <img className="asset-img" src={asset.imageUrl} alt={`${displayAssetTitle(asset)} ${displayAssetSubtitle(asset)}`} />
}
