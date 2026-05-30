import { loadTsModule } from "./ts-module-loader.mjs"

const db = loadTsModule("lib/server/db.ts")
const catalog = db.getCatalog()

console.log(JSON.stringify({
  ok: true,
  categories: catalog.categories.length,
  assets: catalog.assets.length,
  providers: catalog.providers.length,
  promptTemplates: catalog.promptTemplates.length,
  activeProviderId: catalog.providers.find((provider) => provider.active)?.id || "",
  yunwuSeedPresent: catalog.providers.some((provider) => provider.id === "provider_yunwu_image_edit"),
}, null, 2))
