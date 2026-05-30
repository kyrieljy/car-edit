import path from "node:path"
import { loadJson, normalizedForCompare, parseArgs, stableStringify, validateProjectConfig } from "./project-config-utils.mjs"

const args = parseArgs()
const filePath = args.file ? path.resolve(String(args.file)) : ""
if (!filePath) {
  console.error("Usage: node scripts/validate-project-config.mjs --file artifacts/project-config.json [--compare artifacts/other.json]")
  process.exit(2)
}

const config = loadJson(filePath)
const result = validateProjectConfig(config)
if (args.compare) {
  const otherPath = path.resolve(String(args.compare))
  const left = stableStringify(normalizedForCompare(config))
  const right = stableStringify(normalizedForCompare(loadJson(otherPath)))
  if (left !== right) {
    result.ok = false
    result.errors.push(`config differs from ${otherPath}`)
  }
}

console.log(stableStringify(result))
if (!result.ok) process.exit(1)
