# ChatGPT Web Prompt Stability Run - 2026-05-13

Last condensed: 2026-05-29 Asia/Shanghai

This is a historical ChatGPT Pro web prompt test log, not an active handoff document.

## Durable Finding

The hood body-color prompt was too weak at first: the generated hood stayed body color but did not show enough Seibon OE contour/power-dome shape.

The successful V2 prompt strengthened same-color hood contour requirements:

- keep the hood painted exactly like the source body color
- do not introduce black carbon, exposed weave, vents, or openings
- make the OE-style central power dome and long contour lines visibly legible through same-color highlights, shadows, reflections, and panel curvature
- edit only the hood panel

This was applied to `tpl_combo_hood_body_color` in `lib/catalog.ts` and synced with `scripts/apply-prompt-pack-v1.mjs`.

## Current Use

Use this only if debugging hood body-color prompt regressions. For current prompt structure and maintenance, read:

- `docs/EFFECTIVE_PROMPT_V1.md`
- `docs/PART_ASSET_QA_AND_COLOR_POLICY_V1.md`
- `docs/CHAT_MODE_STRATEGY_GUIDE.md`
