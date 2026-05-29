import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const outRoot = path.join(root, "docs", "batch-inputs", "part-references", "multi-ref-v1")

const sourcePages = {
  bbs: "https://bbs-japan.co.jp/en/products/1303/",
  brembo: "https://www.racetechnologies.com/products/brakekits/gt-1j-9019a",
  apRacing: "https://apracing.com/race-car/brake-calipers/pro-5000-r-range",
  akrapovic:
    "https://www.maperformance.com/products/akrapovic-carbon-tail-pipes-2014-2018-bmw-m3-f80-m4-f82-83-tp-ct-26",
  frontLip: "https://shop.aprperformance.com/products/bmw-f80-f82-m3-m4-front-splitter-air-dam-lip-2014-18",
  sideSkirts: "https://www.racingsportconcepts.com/products/bmw-f80-m3-carbon-fiber-side-skirts",
  rscSpoiler: "https://www.racingsportconcepts.com/products/bmw-f80-m3-rear_spoiler",
  kiesSpoiler: "https://www.kiesmotorsports.com/products/bmw-m4-f82-carbon-fiber-trunk-spoiler",
  diffuser: "https://www.racingsportconcepts.com/products/bmw-f80-m3-rear-diffuser-carbon-fiber",
  hood:
    "https://jmautosports.com/products/seibon-carbon-oe-style-carbon-fiber-hood-for-2014-2018-bmw-f80-m3-and-2014-2020-f82-f83-m4-hd14bmwf80-oe",
  mirrors: "https://shop.aprperformance.com/products/universal-fit-formula-gt3-mirrors",
  mirrorsAlt: "https://www.maperformance.com/products/apr-universal-formula-gt3-mirrors-cb-100004b",
  tailLights: "https://vlandfactory.com/products/bmw-m3-3-series-f30-f35-f80-2012-2019-smoked-led-tail-lights-0293as",
  wrap: "https://www.3m.com/3M/en_US/p/dc/v101651157/",
  grille: "https://r44performance.com/products/genuine-bmw-f80-m3-oem-m-performance-front-grilles-in-gloss-black",
}

const bbsRefs = {
  hero: "https://bbs-japan.co.jp/en/wp-content/uploads/sites/2/2016/10/LM-R_top.jpg",
  dsSld: "https://bbs-japan.co.jp/en/wp-content/uploads/sites/2/2016/10/01_lm-r_320.jpg",
  dbSld:
    "https://bbs-japan.co.jp/en/wp-content/uploads/sites/2/2016/10/LM-R_DBSLD_R_%E7%99%BD_%E6%AD%A3%E6%96%B9%E5%BD%A2.jpg",
  dsBkbd:
    "https://bbs-japan.co.jp/en/wp-content/uploads/sites/2/2016/10/LM-R_DSBKBD_R_%E7%99%BD_%E6%AD%A3%E6%96%B9%E5%BD%A2-%E3%82%B3%E3%83%94%E3%83%BC.jpg",
  dbBkbd:
    "https://bbs-japan.co.jp/en/wp-content/uploads/sites/2/2016/10/LM-R_DBBKBD_R_%E7%99%BD_%E6%AD%A3%E6%96%B9%E5%BD%A2-%E3%82%B3%E3%83%94%E3%83%BC.jpg",
}

const bbsAssets = [
  ["bbs-lmr-ds-sld", "ds-sld", "dsSld", ["dbSld", "dsBkbd", "dbBkbd"]],
  ["bbs-lmr-db-sld", "db-sld", "dbSld", ["dsSld", "dsBkbd", "dbBkbd"]],
  ["bbs-lmr-ds-bkbd", "ds-bkbd", "dsBkbd", ["dsSld", "dbSld", "dbBkbd"]],
  ["bbs-lmr-db-bkbd", "db-bkbd", "dbBkbd", ["dsSld", "dbSld", "dsBkbd"]],
  ["test-bbs-lmr-reference-case", "ds-sld", "dsSld", ["dbSld"]],
]

const refs = []

function add(assetId, fileName, url, sourcePage, role, view, priority) {
  refs.push({ assetId, fileName, url, sourcePage, role, view, priority })
}

for (const [assetId, label, exactKey, siblingKeys] of bbsAssets) {
  add(assetId, `01-exact-${label}.jpg`, bbsRefs[exactKey], sourcePages.bbs, "shape_material_reference", "product_front", 1)
  add(assetId, "02-lineup-hero.jpg", bbsRefs.hero, sourcePages.bbs, "shape_reference", "lineup_context", 2)
  siblingKeys.forEach((key, index) => {
    add(assetId, `${String(index + 3).padStart(2, "0")}-shape-${key}.jpg`, bbsRefs[key], sourcePages.bbs, "shape_sibling_finish", "product_front", index + 3)
  })
}

[
  ["01-red-drilled.jpg", "brembo-j-caliper-6-piston-2-piece-380mm-drilled-red-med.jpg"],
  ["02-red-slotted-type-1.jpg", "brembo-j-caliper-6-piston-2-piece-380mm-slotted-type-1-red-med.jpg"],
  ["03-red-slotted-type-3.jpg", "brembo-j-caliper-6-piston-2-piece-380mm-slotted-type-3-red-med.jpg"],
].forEach(([fileName, remote], index) => {
  add(
    "brembo-gt-red",
    fileName,
    `https://www.racetechnologies.com/sites/default/files/content/images/brakekits/${remote}`,
    sourcePages.brembo,
    "shape_material_reference",
    "product_front",
    index + 1,
  )
});

[
  ["01-banner-12-source.jpg", "https://apracing.com/_/img/banners/banner-12.jpg", "banner_context"],
  ["02-banner-5-page.jpg", "https://apracing.com/_/img/banners/banner-5.jpg", "banner_context"],
  ["03-pro-5000-r-section.jpg", "https://apracing.com/cdn/pages/1584/1584/Pro%205000%20R%20section.jpg", "product_context"],
].forEach(([fileName, url, view], index) => {
  add("ap-racing-yellow", fileName, url, sourcePages.apRacing, "shape_reference", view, index + 1)
});

[
  ["01-tail-pipe-product.jpg", "akrapovic-akr-tp-ct-26-11950907129926.jpg", "product_front"],
  ["02-tail-pipe-angle.jpg", "akrapovic-akr-tp-ct-26-11950907392070.jpg", "product_angle"],
  ["03-tail-pipe-detail.jpg", "akrapovic-akr-tp-ct-26-7782602670150.jpg", "detail"],
].forEach(([fileName, remote, view], index) => {
  add(
    "akrapovic-quad-tip",
    fileName,
    `https://www.maperformance.com/cdn/shop/products/${remote}?v=1747675663&width=840`,
    sourcePages.akrapovic,
    "shape_material_reference",
    view,
    index + 1,
  )
});

[
  ["01-product-main.jpg", "files/BMW_M4_Lip_Product_HR_1.jpg", "shape_reference", "product"],
  ["02-installed-front.jpg", "products/BMW_M4_Lip_Installed_HR_2.jpg", "install_context", "front_three_quarter"],
  ["03-product-angle-8.jpg", "products/BMW_M4_Lip_Product_HR_8.jpg", "shape_reference", "product_angle"],
  ["04-product-angle-6.jpg", "products/BMW_M4_Lip_Product_HR_6.jpg", "shape_reference", "product_angle"],
  ["05-installed-front-7.jpg", "products/BMW_M4_Lip_Installed_HR_7.jpg", "install_context", "front_close"],
].forEach(([fileName, remote, role, view], index) => {
  add(
    "varis-front-lip",
    fileName,
    `https://shop.aprperformance.com/cdn/shop/${remote}?v=1682441193&width=1946`,
    sourcePages.frontLip,
    role,
    view,
    index + 1,
  )
});

;[6, 3, 5, 2, 4, 7].forEach((n, index) => {
  add(
    "rsc-f80-side-skirts",
    `${String(index + 1).padStart(2, "0")}-side-skirt-${n}.jpg`,
    `https://www.racingsportconcepts.com/cdn/shop/files/BMW_M3_Side_Skirt_Extension_F80_RSC_Carbon_Fiber_${n}.jpg?v=${n >= 7 ? "1685639784" : "1685639474"}&width=1080`,
    sourcePages.sideSkirts,
    "install_context",
    index % 2 === 0 ? "side" : "side_detail",
    index + 1,
  )
});

[
  ["01-rear2.jpg", "Rear2.jpg?v=1683912173", "rear_three_quarter"],
  ["02-angle-2.jpg", "CarbonFiberRearSpoilerforBMWF80M3_1of1_-2.jpg?v=1683912175", "rear"],
  ["03-angle-3.jpg", "CarbonFiberRearSpoilerforBMWF80M3_1of1_-3.jpg?v=1683912178", "rear_detail"],
].forEach(([fileName, remote, view], index) => {
  add(
    "m-performance-carbon-wing",
    fileName,
    `https://www.racingsportconcepts.com/cdn/shop/files/${remote}&width=1080`,
    sourcePages.rscSpoiler,
    "install_context",
    view,
    index + 1,
  )
});

[
  ["01-kies-main.jpg", "29109480915029.jpg?v=1708006946", "rear_three_quarter"],
  ["02-kies-angle.jpg", "29109480882261.jpg?v=1708006991", "rear_angle"],
  ["03-kies-detail.jpg", "29109480849493.jpg?v=1708007000", "rear_detail"],
].forEach(([fileName, remote, view], index) => {
  add(
    "f82-m4-kies-carbon-trunk-lip-spoiler",
    fileName,
    `https://www.kiesmotorsports.com/cdn/shop/files/kies-motorsports-kies-carbon-2015-2020-bmw-m4-f82-performance-inspired-carbon-fiber-trunk-spoiler-${remote}`,
    sourcePages.kiesSpoiler,
    "install_context",
    view,
    index + 1,
  )
});

[
  ["01-product-square.jpg", "Rear-diffuser-square-product-photo.jpg?v=1683911956", "shape_reference", "product"],
  ["02-installed-dsc08708.jpg", "dsc08708.jpg?v=1683911959", "install_context", "rear_close"],
  ["03-installed-close.jpg", "F80DaytonaVioletM3Reardiffuser3.4close.jpg?v=1683911962", "install_context", "rear_three_quarter_close"],
  ["04-installed-green-rear.jpg", "F80SignalGreenBMWM3rear3.4view.jpg?v=1683911965", "install_context", "rear_three_quarter"],
  ["05-installed-violet-rear.jpg", "F80DaytonVioletM3Rearview.jpg?v=1683911968", "install_context", "rear"],
  ["06-product-diffuser1.png", "Diffuser1.png?v=1683911972", "shape_reference", "product_detail"],
].forEach(([fileName, remote, role, view], index) => {
  add(
    "rsc-f80-carbon-diffuser",
    fileName,
    `https://www.racingsportconcepts.com/cdn/shop/files/${remote}&width=1080`,
    sourcePages.diffuser,
    role,
    view,
    index + 1,
  )
});

[1, 2, 3, 4, 5, 7, 8].forEach((n, index) => {
  add(
    "seibon-oe-carbon-hood",
    `${String(index + 1).padStart(2, "0")}-hd14bmwf80-oe-${String(n).padStart(2, "0")}.jpg`,
    `https://jmautosports.com/cdn/shop/files/HD14BMWF80-OE_${String(n).padStart(2, "0")}_1024x1024.jpg?v=1726637123`,
    sourcePages.hood,
    "shape_reference",
    "product_angle",
    index + 1,
  )
});

[
  ["01-apr-official.jpg", "https://shop.aprperformance.com/cdn/shop/files/CB-100004B.jpg?v=1699921975&width=1946", sourcePages.mirrors, "product_pair"],
  ["02-map-angle-1.jpg", "https://www.maperformance.com/cdn/shop/products/apr-performance-apr-cb-100004b-28320737132614.jpg?v=1747675748&width=840", sourcePages.mirrorsAlt, "product_angle"],
  ["03-map-angle-2.jpg", "https://www.maperformance.com/cdn/shop/products/apr-performance-apr-cb-100004b-28320731332678.jpg?v=1747675748&width=840", sourcePages.mirrorsAlt, "product_angle"],
  ["04-map-angle-3.jpg", "https://www.maperformance.com/cdn/shop/products/apr-performance-apr-cb-100004b-12019472171078.jpg?v=1747675748&width=840", sourcePages.mirrorsAlt, "product_angle"],
  ["05-map-angle-4.jpg", "https://www.maperformance.com/cdn/shop/products/apr-performance-apr-cb-100004b-12019471024198.jpg?v=1747675748&width=840", sourcePages.mirrorsAlt, "product_angle"],
].forEach(([fileName, url, sourcePage, view], index) => {
  add("carbon-mirror-caps", fileName, url, sourcePage, "shape_material_reference", view, index + 1)
});

for (let n = 1; n <= 7; n += 1) {
  add(
    "vland-f80-smoked-tail-lights",
    `${String(n).padStart(2, "0")}-smoked-${n}.webp`,
    `https://vlandfactory.com/cdn/shop/files/VLANDOLEDSmokedTailLightsforBMW3-SeriesF30F35F806thGenSedan2012-2019_${n}.webp?v=${n === 1 ? "1756276006" : "1756276588"}&width=800`,
    sourcePages.tailLights,
    "shape_material_reference",
    n === 1 ? "product_pair" : n <= 5 ? "product_angle" : "product_detail",
    n,
  )
}

[
  ["01-exact-swatch.jpg", "https://multimedia.3m.com/mws/media/2319517J/3m-wrap-film-series-2080-satin-dark-gray.jpg", "swatch"],
  ["02-exact-swatch-506.jpg", "https://multimedia.3m.com/mws/media/2319517J/3m-wrap-film-series-2080-satin-dark-gray.jpg?width=506", "swatch"],
  ["03-2080-color-poster.jpg", "https://multimedia.3m.com/mws/media/1635871J/3m-wrap-film-series-swatch-color-poster-2080.jpg", "poster"],
].forEach(([fileName, url, view], index) => {
  add("3m-2080-s261-satin-dark-gray", fileName, url, sourcePages.wrap, index < 2 ? "color_material_reference" : "color_context", view, index + 1)
});

for (let n = 1; n <= 6; n += 1) {
  const suffix = n === 1 ? "" : `-${n}`
  add(
    "bmw-m-performance-black-grille",
    `${String(n).padStart(2, "0")}-grille${suffix || "-main"}.jpg`,
    `https://r44performance.com/cdn/shop/files/OEM-BMW-M-Performance-Gloss-Black-Front-Grilles-F80-M3${suffix}.jpg?v=1733830602&width=1500`,
    sourcePages.grille,
    "shape_material_reference",
    n <= 3 ? "product_angle" : "product_detail",
    n,
  )
}

await mkdir(outRoot, { recursive: true })

const results = []
for (const ref of refs) {
  const assetDir = path.join(outRoot, ref.assetId)
  await mkdir(assetDir, { recursive: true })
  const absolutePath = path.join(assetDir, ref.fileName)
  const localPath = path.relative(root, absolutePath).replaceAll(path.sep, "/")
  const result = { ...ref, localPath, status: "downloaded", bytes: 0, error: "" }

  try {
    const response = await fetch(ref.url, {
      headers: {
        accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
        "accept-language": "en-US,en;q=0.9",
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
    })
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`)
    const buffer = Buffer.from(await response.arrayBuffer())
    await writeFile(absolutePath, buffer)
    result.bytes = buffer.byteLength
  } catch (error) {
    result.status = "failed"
    result.error = error instanceof Error ? error.message : String(error)
  }

  results.push(result)
  console.log(`${result.status} ${ref.assetId}/${ref.fileName} ${result.bytes}`)
}

const grouped = Object.fromEntries(
  [...new Set(results.map((item) => item.assetId))].sort().map((assetId) => [
    assetId,
    {
      total: results.filter((item) => item.assetId === assetId).length,
      downloaded: results.filter((item) => item.assetId === assetId && item.status === "downloaded").length,
      failed: results.filter((item) => item.assetId === assetId && item.status === "failed").length,
    },
  ]),
)

await writeFile(
  path.join(outRoot, "manifest.json"),
  `${JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      note:
        "Multi-reference assets collected for prompt batch testing. The first uploaded image should remain the vehicle canvas; these are part-specific references only.",
      grouped,
      references: results,
    },
    null,
    2,
  )}\n`,
)

console.log(`Wrote ${path.relative(root, path.join(outRoot, "manifest.json"))}`)
console.log(JSON.stringify(grouped, null, 2))
