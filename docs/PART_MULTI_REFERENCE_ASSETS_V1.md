# Part Multi-Reference Assets V1

Last reviewed: 2026-05-29 Asia/Shanghai

Context note: asset/reference subsystem reference only. Do not read during normal UI/account handoff.

Generated on 2026-05-12 for prompt batch testing and local catalog wiring.

## Storage

- Source download manifest: `docs/batch-inputs/part-references/multi-ref-v1/manifest.json`
- Public provider-ready assets: `public/assets/parts/references/multi-ref-v1/<asset-id>/...`
- Published manifest: `data/part-reference-manifest.v1.json`
- Database table populated: `part_asset_references`

Provider local image resolution only supports paths under `public`, so DB references use `/assets/parts/references/multi-ref-v1/...`.

## Scope

The import covers the active seeded assets plus the prompt-test F82 trunk lip spoiler:

- BBS LM-R wheel variants: 3-5 refs each
- Brembo GT red caliper: 3 refs
- AP Racing Pro 5000 R yellow caliper: 3 refs, low confidence
- Akrapovic carbon quad tips: 3 refs
- APR/F80-F82 front splitter: 5 refs
- RSC F80 side skirts: 6 refs
- RSC F80 rear spoiler: 3 refs
- Kies F82 M4 trunk lip spoiler: 3 refs
- RSC F80 rear diffuser: 6 refs
- Seibon HD14BMWF80-OE hood: 7 refs
- APR Formula GT3 mirrors: 5 refs
- VLAND smoked tail lights: 7 refs, only 2 upload by default
- 3M S261 satin dark gray wrap: 3 refs, 2 upload by default
- BMW M Performance black grille: 6 refs

## Upload Rule

For ChatGPT/Image 2 prompt testing, the first uploaded image must remain the original vehicle canvas. All other uploaded images are part-specific references only.

Do not upload extra full-car photos as vehicle references when the test target is part multi-reference behavior.

## Hood + F82 Trunk Lip Test Set

Use this order for the next hood and rear wing run:

1. Vehicle canvas: `docs/batch-inputs/source-c-parking-blue-m4.jpg`
2. Hood ref 1: `public/assets/parts/references/multi-ref-v1/seibon-oe-carbon-hood/01-hd14bmwf80-oe-01.jpg`
3. Hood ref 2: `public/assets/parts/references/multi-ref-v1/seibon-oe-carbon-hood/02-hd14bmwf80-oe-02.jpg`
4. Hood ref 3: `public/assets/parts/references/multi-ref-v1/seibon-oe-carbon-hood/03-hd14bmwf80-oe-03.jpg`
5. Hood ref 4: `public/assets/parts/references/multi-ref-v1/seibon-oe-carbon-hood/04-hd14bmwf80-oe-04.jpg`
6. Trunk lip ref 1: `public/assets/parts/references/multi-ref-v1/f82-m4-kies-carbon-trunk-lip-spoiler/01-kies-main.jpg`
7. Trunk lip ref 2: `public/assets/parts/references/multi-ref-v1/f82-m4-kies-carbon-trunk-lip-spoiler/02-kies-angle.jpg`
8. Trunk lip ref 3: `public/assets/parts/references/multi-ref-v1/f82-m4-kies-carbon-trunk-lip-spoiler/03-kies-detail.jpg`

If the ChatGPT UI resists 8 images, reduce to 5 images:

1. Vehicle canvas
2. Hood refs 1-3
3. Trunk lip ref 1

## QA Notes

- Cropped images under `docs/batch-inputs/part-references/` are not valid multi-angle references. Treat them as obsolete detail-only scratch assets.
- `ap-racing-yellow` lacks clean official yellow single-product multi-angle refs. Keep it low confidence until better refs are sourced.
- Several VLAND images include marketing text/graphics. They are retained for audit, but only the first two are marked `upload_to_model=1`.
- BBS sibling finish refs are uploaded as shape references. Prompt hints tell the model to use exact finish from the priority 1 reference.
- Install-context images are allowed, but prompt text must say they are not vehicle canvases and must not transfer donor car paint, wheels, plates, background, or unrelated mods.
