# Part Reference Policy

## Image Ordering

- Image 1 is always the canvas/base vehicle.
- Images 2..N are part references.
- Do not mix alternate canvases into the same run.
- Do not infer that a later image is a canvas unless the user explicitly changes the run.

## Reference Quality

Prefer references that show:

- full part silhouette
- mounting side and intended orientation
- finish/material under neutral lighting
- minimal background clutter

Avoid references with heavy watermarking, extreme perspective, unrelated accessories, or ambiguous part boundaries.

## Prompt Handling

Use references to describe the part, not to copy the reference scene. Preserve the canvas vehicle and environment unless the requested part requires local integration changes.

## Data Handling

Do not store source images, generated images, or prompt records outside the requested output location. Ask before saving files or writing catalog/database records.
