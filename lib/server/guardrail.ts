import { getGuardrailConfig } from "./db"
import type { GuardrailResult } from "../types"

const allowedTerms = [
  "car",
  "vehicle",
  "bmw",
  "m3",
  "wheel",
  "wheels",
  "rim",
  "bbs",
  "caliper",
  "wing",
  "spoiler",
  "bumper",
  "lip",
  "diffuser",
  "exhaust",
  "hood",
  "wrap",
  "paint",
  "black",
  "stance",
  "flush",
  "lower",
  "改装",
  "车辆",
  "汽车",
  "轮毂",
  "卡钳",
  "尾翼",
  "包围",
  "前唇",
  "扩散器",
  "排气",
  "机盖",
  "贴膜",
  "车身",
  "降低",
]

export function runMockGuardrail(input: {
  hasVehicleImage: boolean
  text?: string
  fileTypes: string[]
  extraAllowedTerms?: string[]
  skipIntentKeywordCheck?: boolean
}): GuardrailResult {
  const config = getGuardrailConfig()
  if (config.mockFailUploads) {
    return { allowed: false, reason: "Mock guardrail is configured to reject uploads.", detectedModel: "" }
  }
  if (!input.hasVehicleImage) {
    return { allowed: false, reason: "Vehicle image is required.", detectedModel: "" }
  }
  const badType = input.fileTypes.find((type) => !["image/jpeg", "image/png", "image/webp"].includes(type))
  if (badType) {
    return { allowed: false, reason: "Only jpg, png, and webp uploads are supported.", detectedModel: "" }
  }

  const text = (input.text || "").toLowerCase()
  const blocked = config.blockedTerms
    .split(",")
    .map((term) => term.trim().toLowerCase())
    .filter(Boolean)
    .find((term) => text.includes(term))
  if (blocked) {
    return { allowed: false, reason: `Request is outside car modification scope: ${blocked}.`, detectedModel: "" }
  }

  if (input.skipIntentKeywordCheck) {
    return { allowed: true, reason: "Mock vehicle guardrail passed.", detectedModel: "BMW M3" }
  }

  const effectiveAllowedTerms = [...allowedTerms, ...(input.extraAllowedTerms ?? [])]
  if (text && !effectiveAllowedTerms.some((term) => text.includes(term.toLowerCase()))) {
    return { allowed: false, reason: "Please describe a vehicle modification request.", detectedModel: "" }
  }

  return { allowed: true, reason: "Mock vehicle guardrail passed.", detectedModel: "BMW M3" }
}
