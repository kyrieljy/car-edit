# Vehicle Model Prompt Safety

Last reviewed: 2026-05-29 Asia/Shanghai

Context note: prompt safety reference only. Do not read during normal UI/account handoff.

## Rule

- Vehicle recognition may be used for UI display, rejection checks, and debugging.
- Auto-recognized vehicle model names must not be used as generation prompt constraints.
- Generation prompts should preserve the uploaded vehicle identity from the source image itself.
- In Config Mode, a vehicle model may enter `GenerationStandardJson.vehicle.model` only when the user manually edits/confirms it.
- In Chat Mode, `GenerationStandardJson.vehicle.model` always stays as a source-image preservation instruction. Chat Mode does not pass vehicle model names into the generation prompt because the user cannot edit or confirm the recognized model there.

## Reason

Wrong vehicle recognition can over-constrain the image model. For example, if an XPeng P7 image is recognized as `Nio ET7 sedan (NT1)`, the generation model may drift toward ET7 headlights or front fascia instead of preserving the source vehicle's lamp geometry.
