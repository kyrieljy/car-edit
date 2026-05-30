import fs from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"
import vm from "node:vm"
import ts from "typescript"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const tsModuleCache = new Map()

export function loadTsModule(relativePath) {
  const absolutePath = path.join(root, relativePath)
  const cacheKey = path.normalize(absolutePath)
  const cached = tsModuleCache.get(cacheKey)
  if (cached) return cached.exports

  const module = { exports: {} }
  tsModuleCache.set(cacheKey, module)

  const baseRequire = createRequire(absolutePath)
  const localRequire = (specifier) => {
    if (specifier.startsWith(".")) {
      const resolvedBase = path.resolve(path.dirname(absolutePath), specifier)
      const candidates = [`${resolvedBase}.ts`, `${resolvedBase}.tsx`, path.join(resolvedBase, "index.ts")]
      const candidate = candidates.find((filePath) => fs.existsSync(filePath))
      if (candidate) return loadTsModule(path.relative(root, candidate))
    }
    return baseRequire(specifier)
  }

  const source = fs.readFileSync(absolutePath, "utf8")
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText

  vm.runInNewContext(output, {
    Blob,
    Buffer,
    clearTimeout,
    console,
    crypto,
    exports: module.exports,
    fetch,
    FormData,
    module,
    process,
    require: localRequire,
    setTimeout,
    URL,
  }, { filename: path.relative(root, absolutePath) })
  return module.exports
}
