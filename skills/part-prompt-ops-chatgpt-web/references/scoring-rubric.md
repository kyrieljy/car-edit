# Scoring Rubric

Score each output from 0-5 per category. Accept only if total is 20+ and no category is below 3.

| Category | What to Check |
| --- | --- |
| Part identity | Correct part type, key silhouette, vents/edges/logo-free details preserved. |
| Placement | Mounted in the intended vehicle area with believable orientation and alignment. |
| Fit and scale | Size matches the vehicle; no floating, clipping, or warped proportions. |
| Material and finish | Texture, color, reflectivity, and lighting match the prompt and scene. |
| Canvas preservation | Base vehicle, background, camera angle, and non-target areas remain stable. |

## Common Failure Notes

- `wrong-part`: output resembles another component.
- `bad-fit`: incorrect location, scale, or mounting.
- `canvas-drift`: vehicle identity, angle, or body panels changed.
- `reference-leak`: extra objects, labels, watermark, or background from reference copied.
- `overstyle`: cinematic effects or redesign beyond requested part.

## Acceptance Note Format

Use one line per output:

`variant=<id> score=<total>/25 decision=<accept|revise|reject> notes=<short reason>`
