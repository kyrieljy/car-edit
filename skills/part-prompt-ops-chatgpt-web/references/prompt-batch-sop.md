# Prompt Batch SOP

Use this SOP for small manual batches in a logged-in ChatGPT Pro webpage.

## Dry-Run Gate

Before any web execution, confirm:

- User explicitly requested a ChatGPT web run.
- First image is the canvas/base vehicle.
- Subsequent images are part references only.
- Part prompt targets one part, not a kit or scene redesign.
- Manifest has no `error` validation issues.

If any item is missing, stop at dry-run and report the missing item.

## Batch Size

Run 2-4 prompt variants per part. Prefer small changes:

- placement wording
- material/finish wording
- scale and alignment constraints
- integration/blending constraints

Do not change multiple major variables at once.

## Manual Web Steps

1. Open ChatGPT Pro web in the logged-in browser.
2. Upload images in order: canvas first, then part references.
3. Send one prompt variant at a time.
4. Record output id, prompt variant id, visible issues, and score.
5. Save images only after the user explicitly requests saving.

## Stop Conditions

Stop the batch when:

- one output meets acceptance threshold,
- three consecutive outputs fail for the same root cause,
- reference ambiguity prevents fair scoring,
- the user did not authorize the next action.
