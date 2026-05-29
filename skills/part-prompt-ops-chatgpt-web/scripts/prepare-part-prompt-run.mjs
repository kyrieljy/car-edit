#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const usage = `Usage:
  node scripts/prepare-part-prompt-run.mjs <input.json>

Reads a part prompt input JSON file and writes a dry-run manifest JSON to stdout.
No browser automation, image saving, API calls, or database writes are performed.

Input fields:
  partId, partName, vehicleApplicability?, canvasImage?, referenceImages?, promptDraft?, constraints?
  images? may be used instead; images[0] is canvas and images[1..] are references.`;

function asArray(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
}

function normalizeInput(raw) {
  const images = asArray(raw.images);
  const canvasImage = raw.canvasImage || images[0] || "";
  const referenceImages = asArray(raw.referenceImages).length
    ? asArray(raw.referenceImages)
    : images.slice(1);

  return {
    partId: raw.partId || raw.id || "",
    partName: raw.partName || raw.name || "",
    vehicleApplicability: asArray(raw.vehicleApplicability),
    canvasImage,
    referenceImages,
    promptDraft: raw.promptDraft || raw.prompt || "",
    constraints: asArray(raw.constraints),
    notes: raw.notes || "",
  };
}

function validate(manifest) {
  const issues = [];
  const warnings = [];

  if (!manifest.partId) issues.push({ level: "error", field: "partId", message: "partId is required." });
  if (!manifest.partName) issues.push({ level: "error", field: "partName", message: "partName is required." });
  if (!manifest.canvasImage) issues.push({ level: "error", field: "canvasImage", message: "First image must be the canvas/base vehicle." });
  if (!manifest.referenceImages.length) issues.push({ level: "error", field: "referenceImages", message: "At least one part reference image is required." });
  if (!manifest.promptDraft) warnings.push({ level: "warning", field: "promptDraft", message: "No prompt draft supplied; create one before web execution." });
  if (!manifest.vehicleApplicability.length) warnings.push({ level: "warning", field: "vehicleApplicability", message: "Vehicle applicability is empty." });

  return { issues, warnings };
}

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    console.log(usage);
    process.exitCode = 0;
    return;
  }

  const absoluteInputPath = path.resolve(inputPath);
  const raw = JSON.parse(fs.readFileSync(absoluteInputPath, "utf8"));
  const normalized = normalizeInput(raw);
  const validation = validate(normalized);

  const manifest = {
    manifestVersion: 1,
    mode: "dry-run",
    executionAllowed: false,
    sourceFile: absoluteInputPath,
    imageOrderPolicy: {
      canvas: "image[0] or canvasImage",
      references: "image[1..] or referenceImages",
    },
    ...normalized,
    validation,
    nextActions: [
      "Review validation issues.",
      "Refine prompt draft.",
      "Ask for explicit approval before sending anything to ChatGPT web.",
    ],
  };

  console.log(JSON.stringify(manifest, null, 2));
}

try {
  main();
} catch (error) {
  console.error(JSON.stringify({ error: error.message }, null, 2));
  process.exitCode = 1;
}
