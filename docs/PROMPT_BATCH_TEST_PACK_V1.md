# Prompt Batch Test Pack V1

Last condensed: 2026-05-29 Asia/Shanghai

This is an archived prompt-testing plan from the early real-effect QA phase. It is not the active handoff and should not be read during normal UI/account work.

## Purpose

The original plan tested whether generated images preserved:

- original vehicle canvas, camera, lighting, and background
- selected-only edits
- unselected wheels/body/background/model
- hood/mirror carbon color policy
- paint and stance intent

## Important Historical Case

The early bad case used a BMW M4/F82-style source image and showed these failures:

- background changed
- vehicle identity drifted
- unselected wheels changed
- body-color selection conflicted with a black carbon hood reference

That failure led to the current invariant:

- first uploaded image is the only canvas
- later images are part references only
- selected parts only
- hood/mirror carbon-capable assets need explicit `body_color` vs `exposed_carbon`

## Current Source Of Truth

- Prompt structure: `docs/EFFECTIVE_PROMPT_V1.md`
- Chat strategy: `docs/CHAT_MODE_STRATEGY_GUIDE.md`
- Asset/color-policy QA: `docs/PART_ASSET_QA_AND_COLOR_POLICY_V1.md`
- Real-effect manual checklist: `docs/PROMPT_REAL_EFFECT_REGRESSION_CHECKLIST.md`

Do not restart broad prompt batch testing unless the user explicitly approves the scope and any provider credit usage.
