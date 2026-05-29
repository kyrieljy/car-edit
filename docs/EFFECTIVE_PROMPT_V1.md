# Effective Prompt v1

Last reviewed: 2026-05-29 Asia/Shanghai

Context note: prompt subsystem reference only. Do not read during normal UI/account handoff.

This document defines the v1 prompt pack structure used by `scripts/apply-prompt-pack-v1.mjs`.
The pack is intentionally template-first: source seed text remains in the existing catalog/server seed code, and the script synchronizes it into database rows by upsert/update.

## Core Principles

- The first uploaded image is the only canvas. Treat it as the target vehicle, target viewpoint, target lighting, target color reference, and final composition boundary.
- Later uploaded images are accessory references only. They can define shape, material, branding, texture, or attachment details, but must not replace the vehicle, camera angle, scene, paint color, wheels, or background from the first image.
- Multiple reference images may be supplied for one request. Resolve them by role: image 1 is the canvas; image 2+ are parts, material references, or detail references.
- Only modify selected parts. Unselected accessories and unrelated vehicle areas must remain unchanged.
- Preserve vehicle identity and geometry unless a selected part explicitly requires a localized change.
- Keep edits physically plausible: fitted scale, correct perspective, clean mounting, believable contact shadows, and no floating or duplicated parts.
- Prefer concise, imperative prompts that describe what to preserve and what to change. Avoid broad style words that invite whole-image reinterpretation.

## Template Sections

### base

`base` is the shared invariant for every generation prompt.

- State that image 1 is the only editable canvas.
- State that all later images are reference-only.
- Preserve camera angle, crop, vehicle pose, lighting, background, and original body color from image 1.
- Apply edits only to selected categories and parts.
- Forbid changing unselected parts, license plates, cabin, windshield, wheels, paint, scene, or body panels unless explicitly selected.
- Require photorealistic integration with correct perspective, reflections, occlusion, and shadows.

### config_mode

`config_mode` is used when the user has selected a structured configuration in the UI.

- Translate selected categories and assets into explicit edit instructions.
- Include all selected parts, including combinations, in a deterministic order.
- Treat UI selections as authoritative. If text chat conflicts with selected config, config wins unless the user explicitly asks to override.
- Do not infer extra parts from brand names, style packages, or inspiration references.

### chat_mode

`chat_mode` is used when the user describes an edit in natural language.

- Extract requested parts, materials, and constraints from the message.
- Keep the request scoped to the described edits.
- If the user mentions reference images, keep image 1 as canvas and use image 2+ only for the referenced accessory details.
- If the request is ambiguous, prefer preserving the original vehicle and applying the smallest plausible localized edit.

### config_base

`config_base` is the bridge between `base` and concrete selected parts.

- Begin from the shared preservation rules.
- Add a concise selected-parts summary.
- Mention that unselected catalog parts remain unchanged.
- When multiple selected parts affect the same region, combine them as a coordinated fitment rather than separate visual overlays.

### category

`category` templates describe category-level behavior such as hood, spoiler, diffuser, lip, side skirt, mirror cap, wheel, or roof accessory.

- Define the editable region and the expected physical attachment points.
- Preserve neighboring panels outside the selected region.
- Clarify material behavior when relevant: painted body color, gloss black, exposed carbon, matte carbon, metal, clear lens, or rubber.
- Avoid changing the whole vehicle stance or kit unless the category explicitly covers that scope.

### part

`part` templates map a single asset to a prompt hint.

- Use the part asset reference only for the selected part's shape, material, vent pattern, weave, logo placement, or finish.
- Keep the target vehicle from image 1.
- Fit the part to the target vehicle's perspective and panel boundaries.
- Preserve unselected OEM or existing aftermarket parts.
- If the part is absent from the reference image or poorly visible, use the prompt hint as the authority and avoid inventing unrelated features.

### combo

`combo` templates define known part combinations.

- Describe how selected parts should align visually and physically.
- Resolve overlapping edits in favor of coherent fitment and consistent material finish.
- Do not let a combo expand into unselected categories.
- Keep combo language specific, for example front lip plus side skirts plus rear diffuser, instead of broad terms like full rebuild.

### negative

`negative` is the shared rejection list.

- Reject changing the base vehicle identity, color, viewpoint, background, plate, interior, and unselected parts.
- Reject replacing the whole car with the reference image vehicle.
- Reject extra vents, extra stickers, duplicate accessories, warped body panels, floating parts, melted edges, low resolution, cartoon render, CGI look, or over-stylized lighting.
- Reject making every visible accessory carbon fiber unless selected.

### result_check

`result_check` describes how a generated result is judged.

- Image 1 must still be recognizable as the same car, same viewpoint, same scene, and same body color.
- Selected parts must appear, be fitted cleanly, and match the requested material.
- Later reference images must influence only accessory details.
- Unselected parts must remain unchanged.
- Multi-reference requests pass only if the references are assigned to the correct roles.
- Hood material must match the explicit selection: `body_color` means painted to match the original body color; `exposed_carbon` means visible carbon fiber weave and should not be painted body color.

### retry

`retry` is used when the first generation misses a requirement.

- Name the failed requirement directly.
- Restate image 1 as the only canvas.
- Restate image 2+ as accessory references only.
- Preserve all correct parts from the previous attempt when possible.
- Ask for a focused correction instead of a full reinterpretation.
- For material failures, use exact contrastive language, for example: hood must be `body_color`, not exposed carbon; or hood must be `exposed_carbon`, not body-color painted.

## Hood Material Policy

Hood prompts require special handling because body-color and exposed-carbon hoods are common failure cases.

- `body_color`: replace or reshape the hood only if selected, but paint it to match the original body color from image 1. Carbon weave should not be visible.
- `exposed_carbon`: apply visible carbon fiber weave and carbon reflections to the hood. Do not repaint it to the body color.
- If a hood reference image shows a different vehicle color, use only hood shape, vents, weave, and finish. Do not copy that vehicle color to the target car.
- If the hood is not selected, do not alter the hood even if another selected part reference contains a hood.

## Script Synchronization

`scripts/apply-prompt-pack-v1.mjs` reads existing seeds and synchronizes them into the local SQLite database.

- `prompt_presets`: upsert by `id`; update title, version, body, negative prompt, and active state on conflict.
- `prompt_templates`: upsert by `id`; update scope, title, body, asset id, combination key, active state, sort order, and `updated_at` on conflict.
- `part_assets.prompt_hint`: update by asset `id` from `assetsSeed`.
- The script should report how many templates were read, how many rows were applied, how many asset hints were targeted, how many asset hints were updated, and which asset ids were missing if any.
