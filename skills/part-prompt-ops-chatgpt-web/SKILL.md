---
name: part-prompt-ops-chatgpt-web
description: Operational workflow for adding or maintaining car modification parts by running small logged-in ChatGPT Pro web tests, refining a single-part image prompt, and producing a system entry package. Use when Codex helps operations staff prepare, test, score, document, or package prompts for individual parts using ChatGPT web rather than the OpenAI API.
---

# Part Prompt Ops via ChatGPT Web

Use this skill to help operations staff turn one car part into a tested prompt record and import-ready package.

## Safety Defaults

- Default to dry-run. Planning, drafting prompts, preparing manifests, and validating inputs are allowed.
- Do not send messages to ChatGPT web unless the user explicitly asks to execute the web run.
- Do not save generated images unless the user explicitly asks to save images.
- Do not write to a database, app data file, or production catalog unless the user explicitly asks to write.
- Do not use the OpenAI API for this workflow. Use the already logged-in ChatGPT Pro webpage only when execution is requested.
- Treat the first input image as the canvas/base vehicle image. Treat all later images as part references.

## Workflow

1. Collect the part brief: part id/name, vehicle applicability, desired visual effect, constraints, and input image paths.
2. Prepare a dry-run manifest with `scripts/prepare-part-prompt-run.mjs`. Review warnings before any browser work.
3. Draft a single-part prompt focused on geometry, placement, material, scale, and integration with the canvas.
4. If the user explicitly requests execution, run a small ChatGPT Pro web batch using the canvas plus references.
5. Score outputs with `references/scoring-rubric.md`. Keep only evidence-backed prompt changes.
6. Produce the system entry package using `references/prompt-record-schema.md`.

## Resources

- `references/prompt-batch-sop.md`: browser execution SOP and dry-run gates.
- `references/scoring-rubric.md`: criteria for judging generated images.
- `references/part-reference-policy.md`: source and image-ordering rules.
- `references/prompt-record-schema.md`: import package shape and required fields.
- `scripts/prepare-part-prompt-run.mjs`: generate or validate a run manifest draft from JSON.

## Output Expectations

Return a compact ops package containing:

- part metadata
- canvas image path and reference image paths
- final prompt
- negative prompt or exclusions
- scoring notes and selected output ids, if a web run was executed
- import JSON matching the schema reference
- explicit status: `dry-run`, `web-run-complete`, or `ready-to-write`
