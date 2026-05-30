# Prompt Packs

This directory is the Git-tracked source of truth for validated generation prompt behavior.

SQLite is runtime state. Admin edits may be used for experiments, but a prompt is not considered deployable until it is exported here as a new versioned pack and committed.

## Current Stable Pack

- `effective-prompt-v1-2026-05-29.json`
- Active preset: `preset_oem_plus_v1`
- Version: `3.0-effective-v1`
- Evidence: `docs/chat-mode-dry-run-test-results.json` recorded `76/76` passing dry-run cases.

## Rules

1. Do not overwrite an existing pack after it has been deployed. Create a new file.
2. Keep prompt changes scoped to one behavior area when possible, such as hood body color, stance, or color policy.
3. Run `npm.cmd run prompt:validate` before deploying.
4. Run project config export/compare before deploying to make sure test server prompt/provider/workflow state matches local.
5. Real provider tests require explicit approval because they may charge credits.

## Recovery Boundary

The 2026-05-29 pack restores these verified behaviors:

- Auto-recognized vehicle names are not generation constraints.
- Chat Mode uses `User uploaded vehicle, preserve exact identity`.
- No explicit height request means no `## 车身姿态` section.
- Stance presets are `轻微升高`, `轻微降低`, `齐边低趴`, and `气动避震`.
- Hood `body_color` means visible Seibon OE-style contour in body color, without black carbon weave.
- The first image is always the only editable canvas; later images are part references only.
