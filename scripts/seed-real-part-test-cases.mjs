import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { DatabaseSync } from "node:sqlite"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const dbPath = path.join(root, "data", "car_mod_effect.sqlite")
const outputDir = path.join(root, "public", "assets", "parts", "test-cases")
const sourceLogPath = path.join(root, "data", "part-test-cases.sources.json")

const now = Date.now()

function defaultKeywords(item) {
  return [item.model, item.variant, item.id].filter(Boolean).join(", ")
}

const cases = [
  {
    id: "bbs-lmr-ds-sld",
    categoryId: "wheels",
    brand: "BBS",
    model: "LM-R",
    variant: "DS-SLD",
    color: "Diamond Silver disk / Silver Diamond-cut rim",
    finish: "forged two-piece diamond-cut silver",
    sourcePage: "https://bbs-japan.co.jp/en/products/1303/",
    imageSource: "https://bbs-japan.co.jp/en/wp-content/uploads/sites/2/2016/10/01_lm-r_320.jpg",
    fileName: "bbs-lmr-ds-sld.jpg",
    sortOrder: 10,
    promptHint:
      "安装 BBS LM-R DS-SLD 双片式锻造轮毂，银色多辐条盘面、银色钻石切削轮唇、可见装配铆钉和 BBS 中心盖。保持原车轮胎尺寸、轮拱位置、刹车盘透视和接地阴影。",
  },
  {
    id: "bbs-lmr-db-sld",
    categoryId: "wheels",
    brand: "BBS",
    model: "LM-R",
    variant: "DB-SLD",
    color: "Diamond Black disk / Silver Diamond-cut rim",
    finish: "forged two-piece dark center with polished lip",
    sourcePage: "https://bbs-japan.co.jp/en/products/1303/",
    imageSource:
      "https://bbs-japan.co.jp/en/wp-content/uploads/sites/2/2016/10/LM-R_DBSLD_R_%E7%99%BD_%E6%AD%A3%E6%96%B9%E5%BD%A2.jpg",
    fileName: "bbs-lmr-db-sld.jpg",
    sortOrder: 20,
    promptHint:
      "安装 BBS LM-R DB-SLD 双片式锻造轮毂，深灰黑多辐条盘面、银色钻石切削外唇、可见装配铆钉和 BBS 中心盖。不要改变车辆姿态，保持原车轮拱比例。",
  },
  {
    id: "bbs-lmr-ds-bkbd",
    categoryId: "wheels",
    brand: "BBS",
    model: "LM-R",
    variant: "DS-BKBD",
    color: "Diamond Silver disk / Black Bright Diamond-cut rim",
    finish: "forged two-piece silver center with black diamond-cut lip",
    sourcePage: "https://bbs-japan.co.jp/en/products/1303/",
    imageSource:
      "https://bbs-japan.co.jp/en/wp-content/uploads/sites/2/2016/10/LM-R_DSBKBD_R_%E7%99%BD_%E6%AD%A3%E6%96%B9%E5%BD%A2-%E3%82%B3%E3%83%94%E3%83%BC.jpg",
    fileName: "bbs-lmr-ds-bkbd.jpg",
    sortOrder: 30,
    promptHint:
      "安装 BBS LM-R DS-BKBD 轮毂，银色多辐条盘面搭配黑亮钻石切削轮唇，保留双片式铆钉结构。轮毂角度、轮胎接地和刹车盘遮挡必须真实。",
  },
  {
    id: "bbs-lmr-db-bkbd",
    categoryId: "wheels",
    brand: "BBS",
    model: "LM-R",
    variant: "DB-BKBD",
    color: "Diamond Black disk / Black Bright Diamond-cut rim",
    finish: "forged two-piece dark center with black diamond-cut lip",
    sourcePage: "https://bbs-japan.co.jp/en/products/1303/",
    imageSource:
      "https://bbs-japan.co.jp/en/wp-content/uploads/sites/2/2016/10/LM-R_DBBKBD_R_%E7%99%BD_%E6%AD%A3%E6%96%B9%E5%BD%A2-%E3%82%B3%E3%83%94%E3%83%BC.jpg",
    fileName: "bbs-lmr-db-bkbd.jpg",
    sortOrder: 40,
    promptHint:
      "安装 BBS LM-R DB-BKBD 轮毂，深灰黑盘面、黑亮钻石切削轮唇、双片式铆钉结构和 BBS 中心盖清晰可见。保持原车角度和真实反光。",
  },
  {
    id: "brembo-gt-red",
    categoryId: "calipers",
    brand: "Brembo",
    model: "GT",
    variant: "6-Piston Red",
    color: "red",
    finish: "painted red caliper with drilled two-piece rotor",
    sourcePage: "https://www.racetechnologies.com/products/brakekits/gt-1j-9019a",
    imageSource:
      "https://www.racetechnologies.com/sites/default/files/content/images/brakekits/brembo-j-caliper-6-piston-2-piece-380mm-drilled-red-med.jpg",
    fileName: "brembo-gt-red.jpg",
    sortOrder: 10,
    promptHint:
      "将刹车卡钳替换为 Brembo GT 红色 6 活塞卡钳，搭配大尺寸打孔双片刹车盘。卡钳必须位于轮毂内侧正确位置，不能漂浮，透过轮辐可见并有真实遮挡。",
  },
  {
    id: "ap-racing-yellow",
    categoryId: "calipers",
    brand: "AP Racing",
    model: "Pro 5000 R",
    variant: "6-Piston Yellow",
    color: "yellow",
    finish: "motorsport forged caliper",
    sourcePage: "https://apracing.com/race-car/brake-calipers/pro-5000-r-range",
    imageSource: "https://apracing.com/_/img/banners/banner-12.jpg",
    fileName: "ap-racing-pro-5000r.jpg",
    sortOrder: 20,
    promptHint:
      "将刹车卡钳替换为 AP Racing Pro 5000 R 赛车风格黄色 6 活塞卡钳。卡钳只出现在车轮内部，与刹车盘、轮毂辐条和阴影关系真实，不改变轮毂款式。",
  },
  {
    id: "akrapovic-quad-tip",
    categoryId: "exhaust",
    brand: "Akrapovic",
    model: "Tail Pipe Set",
    variant: "Carbon TP-CT/26",
    color: "carbon fiber and titanium",
    finish: "carbon fiber outer sleeve with titanium inner pipe",
    sourcePage: "https://www.maperformance.com/products/akrapovic-carbon-tail-pipes-2014-2018-bmw-m3-f80-m4-f82-83-tp-ct-26",
    imageSource:
      "https://www.maperformance.com/cdn/shop/products/akrapovic-akr-tp-ct-26-11950907129926.jpg?v=1747675663&width=1200",
    fileName: "akrapovic-tail-pipe-carbon.jpg",
    sortOrder: 10,
    promptHint:
      "将排气尾嘴替换为 Akrapovic 碳纤维尾嘴套装，四出圆形尾嘴，外圈为碳纤维纹理，内管为金属钛色。只修改尾部排气出口，不改变保险杠结构。",
  },
  {
    id: "varis-front-lip",
    categoryId: "front-bumper",
    brand: "APR Performance",
    model: "Front Splitter / Air Dam / Lip",
    variant: "FA-830402",
    color: "carbon fiber black",
    finish: "pre-preg carbon fiber gloss",
    sourcePage: "https://shop.aprperformance.com/products/bmw-f80-f82-m3-m4-front-splitter-air-dam-lip-2014-18",
    imageSource: "https://shop.aprperformance.com/cdn/shop/files/BMW_M4_Lip_Product_HR_1.jpg?v=1682441193&width=1946",
    fileName: "apr-f80-front-splitter.jpg",
    sortOrder: 10,
    promptHint:
      "在前保险杠下方安装 APR Performance 碳纤维前唇/前铲，形状贴合 F80/F82 前杠下沿，低矮外扩但不夸张。保留原车前脸、进气口、灯组和车牌区域。",
  },
  {
    id: "rsc-f80-side-skirts",
    categoryId: "side-skirts",
    brand: "Racing Sport Concepts",
    model: "Side Skirt Extensions",
    variant: "RSCBMW001",
    color: "carbon fiber black",
    finish: "pre-preg carbon fiber gloss",
    sourcePage: "https://www.racingsportconcepts.com/products/bmw-f80-m3-carbon-fiber-side-skirts",
    imageSource:
      "https://www.racingsportconcepts.com/cdn/shop/files/BMW_M3_Side_Skirt_Extension_F80_RSC_Carbon_Fiber_6_1800x1800.jpg?v=1685639474",
    fileName: "rsc-f80-side-skirts.jpg",
    sortOrder: 10,
    promptHint:
      "在左右侧裙下沿安装 Racing Sport Concepts 碳纤维侧裙延伸件，沿车身侧面从前门下方向后延伸，低位贴合门槛。保持车门缝、车身腰线和地面阴影真实。",
  },
  {
    id: "m-performance-carbon-wing",
    categoryId: "rear-wing",
    brand: "Racing Sport Concepts",
    model: "M3 Rear Spoiler",
    variant: "RSCBMW005",
    color: "carbon fiber black",
    finish: "3K 2x2 twill carbon fiber gloss",
    sourcePage: "https://www.racingsportconcepts.com/products/bmw-f80-m3-rear_spoiler",
    imageSource: "https://www.racingsportconcepts.com/cdn/shop/files/Rear2.jpg?v=1683912173&width=1080",
    fileName: "rsc-f80-rear-spoiler.jpg",
    sortOrder: 10,
    promptHint:
      "在后备箱尾端安装 Racing Sport Concepts 碳纤维小尾翼，低矮鸭尾造型，贴合 F80 M3 尾箱边缘。不要生成大型 GT 翼，不改变尾灯和后窗比例。",
  },
  {
    id: "rsc-f80-carbon-diffuser",
    categoryId: "diffuser",
    brand: "Racing Sport Concepts",
    model: "F80 Rear Diffuser",
    variant: "RSCBMW004",
    color: "carbon fiber black",
    finish: "3-piece pre-preg carbon fiber gloss",
    sourcePage: "https://www.racingsportconcepts.com/products/bmw-f80-m3-rear-diffuser-carbon-fiber",
    imageSource: "https://www.racingsportconcepts.com/cdn/shop/files/Rear-diffuser-square-product-photo_1800x1800.jpg?v=1683911956",
    fileName: "rsc-f80-carbon-diffuser.jpg",
    sortOrder: 10,
    promptHint:
      "在后保险杠下部安装 Racing Sport Concepts 三片式碳纤维后扩散器，围绕四出排气布局，中央和两侧导流鳍清晰。保持原车尾灯、后杠轮廓和排气位置不变。",
  },
  {
    id: "seibon-oe-carbon-hood",
    categoryId: "hood",
    brand: "Seibon",
    model: "OE-Style Carbon Fiber Hood",
    variant: "HD14BMWF80-OE",
    color: "carbon fiber black",
    finish: "gloss carbon fiber weave",
    sourcePage: "https://seiboncarbon.com/oe-style-carbon-fiber-hood-for-2015-2018-bmw-f80-m3-and-2015-2020-f82-f83-m4.html",
    imageSource: "https://seiboncarbon.com/media/catalog/product/cache/71ca68bedc79d61dff7e04ab03c07fd5/h/d/hd14bmwf80-oe_01.jpg",
    fileName: "seibon-oe-carbon-hood.jpg",
    sortOrder: 10,
    promptHint:
      "将机盖替换为 Seibon OE-Style 碳纤维机盖，保持原厂机盖轮廓和缝隙位置，仅改变为清晰碳纤维纹理与亮面清漆反光。不要增加额外开孔或改变前脸。",
  },
  {
    id: "carbon-mirror-caps",
    categoryId: "mirrors",
    brand: "APR Performance",
    model: "Formula GT3 Carbon Fiber Mirrors",
    variant: "CB-100004B",
    color: "carbon fiber black with blue mirror glass",
    finish: "pre-preg carbon fiber gloss",
    sourcePage: "https://shop.aprperformance.com/products/universal-fit-formula-gt3-mirrors",
    imageSource: "https://shop.aprperformance.com/cdn/shop/files/CB-100004B.jpg?v=1699921975&width=1946",
    fileName: "apr-formula-gt3-mirror.jpg",
    sortOrder: 10,
    promptHint:
      "将两侧后视镜替换为 APR Performance Formula GT3 碳纤维后视镜，小尺寸空气动力学外壳，碳纤维纹理和蓝色防眩镜片可见。镜子必须安装在原后视镜位置。",
  },
  {
    id: "vland-f80-smoked-tail-lights",
    categoryId: "lights",
    brand: "VLAND",
    model: "OLED Smoked Tail Lights",
    variant: "YAB-BMW-0293A",
    color: "smoked lens with red LED",
    finish: "smoked polycarbonate lens",
    sourcePage: "https://vlandfactory.com/products/bmw-m3-3-series-f30-f35-f80-2012-2019-smoked-led-tail-lights-0293as",
    fileName: "vland-f80-smoked-tail-lights.jpg",
    sortOrder: 10,
    promptHint:
      "将尾灯替换为 VLAND OLED 烟熏尾灯，灯罩为深色烟熏效果，内部红色 LED 光带结构清晰。只修改尾灯外观，不改变车尾轮廓、尾门缝隙和后保险杠。",
  },
  {
    id: "3m-2080-s261-satin-dark-gray",
    categoryId: "wrap",
    brand: "3M",
    model: "Wrap Film 2080",
    variant: "S261 Satin Dark Gray Metallic",
    color: "satin dark gray metallic",
    finish: "satin metallic vinyl wrap",
    sourcePage: "https://www.3m.com/3M/en_US/p/dc/v101651157/",
    fileName: "3m-2080-s261-satin-dark-gray.jpg",
    sortOrder: 10,
    promptHint:
      "将整车车身颜色改为 3M 2080 S261 Satin Dark Gray Metallic，深灰金属缎面贴膜质感，低光泽、柔和反射。保留原车所有结构线、灯组、玻璃、轮毂和背景。",
  },
  {
    id: "bmw-m-performance-black-grille",
    categoryId: "grille",
    brand: "Genuine BMW",
    model: "M Performance Front Grilles",
    variant: "51712352812 + 51712352813",
    color: "gloss black",
    finish: "high-gloss black ABS",
    sourcePage: "https://r44performance.com/products/genuine-bmw-f80-m3-oem-m-performance-front-grilles-in-gloss-black",
    imageSource:
      "https://r44performance.com/cdn/shop/files/OEM-BMW-M-Performance-Gloss-Black-Front-Grilles-F80-M3.jpg?v=1733830602&width=1500",
    fileName: "bmw-m-performance-gloss-black-grille.jpg",
    sortOrder: 10,
    promptHint:
      "将前双肾格栅替换为 Genuine BMW M Performance 高亮黑前格栅，双肾外框和竖条均为亮黑色，并保留 M3 标识。只修改格栅，不改变前杠、灯组和机盖。",
  },
  {
    id: "test-bbs-lmr-reference-case",
    categoryId: "test",
    brand: "BBS",
    model: "LM-R",
    variant: "Reference Test Case",
    color: "diamond silver",
    finish: "forged wheel reference",
    sourcePage: "https://bbs-japan.co.jp/en/products/1303/",
    imageSource: "https://bbs-japan.co.jp/en/wp-content/uploads/sites/2/2016/10/01_lm-r_320.jpg",
    fileName: "test-bbs-lmr-reference-case.jpg",
    sortOrder: 10,
    promptHint:
      "测试分类专用案例：使用 BBS LM-R 银色双片式锻造轮毂作为参考件，验证资产库图片、品牌、型号、提示词和前台选择流程是否完整联动。生成时只把它作为轮毂外观参考，不添加额外配件。",
  },
]

function slug(input) {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[-\s]+/g, "-")
}

function decodeHtml(input) {
  return input
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
}

function resolveUrl(candidate, baseUrl) {
  const decoded = decodeHtml(candidate.trim())
  if (decoded.startsWith("//")) return `https:${decoded}`
  return new URL(decoded, baseUrl).toString()
}

async function fetchWithHeaders(url, referer) {
  const response = await fetch(url, {
    headers: {
      accept: "text/html,image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      "accept-language": "en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7",
      referer: referer ?? url,
      "user-agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
    },
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`)
  }
  return response
}

async function extractImageFromPage(pageUrl) {
  const response = await fetchWithHeaders(pageUrl)
  const html = await response.text()
  const patterns = [
    /<meta[^>]+(?:property|name)=["'](?:og:image|og:image:secure_url|twitter:image)["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:image|og:image:secure_url|twitter:image)["']/i,
    /"image"\s*:\s*"([^"]+)"/i,
    /"featured_image"\s*:\s*"([^"]+)"/i,
    /https?:\\?\/\\?\/[^"']+\.(?:jpg|jpeg|png|webp)(?:\?[^"']*)?/i,
  ]

  for (const pattern of patterns) {
    const match = html.match(pattern)
    if (!match) continue
    const raw = match[1] ?? match[0]
    return resolveUrl(raw.replaceAll("\\/", "/"), pageUrl)
  }

  throw new Error(`No product image found on ${pageUrl}`)
}

function extensionFrom(contentType, url) {
  if (contentType.includes("avif")) return ".avif"
  if (contentType.includes("png")) return ".png"
  if (contentType.includes("webp")) return ".webp"
  if (contentType.includes("svg")) return ".svg"
  if (contentType.includes("jpeg") || contentType.includes("jpg")) return ".jpg"
  const pathname = new URL(url).pathname.toLowerCase()
  const ext = path.extname(pathname)
  return ext && ext.length <= 5 ? ext : ".jpg"
}

async function downloadImage(item) {
  const imageSource = item.imageSource ?? (await extractImageFromPage(item.sourcePage))
  const response = await fetchWithHeaders(imageSource, item.sourcePage)
  const contentType = response.headers.get("content-type") ?? ""
  const buffer = Buffer.from(await response.arrayBuffer())
  const ext = extensionFrom(contentType, imageSource)
  const fileName = item.fileName.replace(/\.[a-z0-9]+$/i, ext)
  const absolutePath = path.join(outputDir, fileName)
  await writeFile(absolutePath, buffer)
  return {
    imageSource,
    imageUrl: `/assets/parts/test-cases/${fileName}`,
    bytes: buffer.byteLength,
  }
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
  const sortOrder = Number(sortRow?.sort_order ?? 10)
  db.prepare("INSERT INTO asset_brands (id, category_id, label, sort_order, active) VALUES (?, ?, ?, ?, 1)").run(
    id,
    categoryId,
    label,
    sortOrder,
  )
  return id
}

await mkdir(outputDir, { recursive: true })

const db = new DatabaseSync(dbPath)
const upsertAsset = db.prepare(`
  INSERT INTO part_assets
    (id, category_id, brand_id, brand, model, variant, keywords, color, finish, image_url, image_crop, active, sort_order, prompt_hint, created_at)
  VALUES
    (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', 1, ?, ?, ?)
  ON CONFLICT(id) DO UPDATE SET
    category_id = excluded.category_id,
    brand_id = excluded.brand_id,
    brand = excluded.brand,
    model = excluded.model,
    variant = excluded.variant,
    keywords = CASE WHEN trim(COALESCE(part_assets.keywords, '')) = '' THEN excluded.keywords ELSE part_assets.keywords END,
    color = excluded.color,
    finish = excluded.finish,
    image_url = excluded.image_url,
    active = excluded.active,
    sort_order = excluded.sort_order,
    prompt_hint = excluded.prompt_hint
`)

const sourceLog = []
for (const item of cases) {
  const result = await downloadImage(item)
  const brandId = ensureBrand(db, item.categoryId, item.brand)
  upsertAsset.run(
    item.id,
    item.categoryId,
    brandId,
    item.brand,
    item.model,
    item.variant,
    item.keywords || defaultKeywords(item),
    item.color,
    item.finish,
    result.imageUrl,
    item.sortOrder,
    item.promptHint,
    now,
  )
  sourceLog.push({
    id: item.id,
    categoryId: item.categoryId,
    brand: item.brand,
    model: item.model,
    variant: item.variant,
    sourcePage: item.sourcePage,
    imageSource: result.imageSource,
    localImageUrl: result.imageUrl,
    bytes: result.bytes,
  })
  console.log(`seeded ${item.id} -> ${result.imageUrl}`)
}

await writeFile(sourceLogPath, `${JSON.stringify({ generatedAt: new Date(now).toISOString(), cases: sourceLog }, null, 2)}\n`)
db.close()

console.log(`Seeded ${cases.length} real part test cases.`)
console.log(`Source log: ${path.relative(root, sourceLogPath)}`)
