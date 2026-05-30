import { openProjectDb, parseArgs, defaultDbPath } from "./project-config-utils.mjs"

const YUNWU_IMAGE2_PROVIDER_ID = "provider_yunwu_image_edit"
const YUNWU_NANO2_PROVIDER_ID = "provider_yunwu_nano2_edit"
const YUNWU_DEFAULT_PROVIDER_ID = YUNWU_IMAGE2_PROVIDER_ID
const DISABLED_302_PROVIDER_IDS = ["provider_302_nano_banana2_async_edit", "provider_80fce082"]
const IMAGE_WORKFLOW_MODES = new Set(["config", "chat"])

const args = parseArgs()
const dbPath = args.db || defaultDbPath()
const db = openProjectDb(dbPath)
const now = Date.now()

try {
  db.exec("BEGIN")

  upsertProvider({
    id: YUNWU_NANO2_PROVIDER_ID,
    label: "Yunwu Nano Banana 2 Edit",
    baseUrl: "https://yunwu.ai/fal-ai/nano-banana/edit",
    modelName: "gemini-3.1-flash-image-preview",
  })
  upsertProvider({
    id: YUNWU_IMAGE2_PROVIDER_ID,
    label: "Yunwu GPT Image 2 Edit",
    baseUrl: "https://yunwu.ai/v1/images/edits",
    modelName: "gpt-image-2",
  })

  db.prepare(`UPDATE provider_configs SET active = CASE WHEN id = ? THEN 1 ELSE 0 END`).run(YUNWU_DEFAULT_PROVIDER_ID)
  copyYunwuKeyIfNeeded(YUNWU_IMAGE2_PROVIDER_ID, YUNWU_NANO2_PROVIDER_ID)
  copyYunwuKeyIfNeeded(YUNWU_NANO2_PROVIDER_ID, YUNWU_IMAGE2_PROVIDER_ID)

  for (const providerId of DISABLED_302_PROVIDER_IDS) {
    db.prepare(`UPDATE provider_configs SET enabled = 0, active = 0, updated_at = ? WHERE id = ?`).run(now, providerId)
  }

  const workflows = db.prepare(`SELECT id, mode, nodes_json FROM workflow_configs WHERE mode IN ('config', 'chat')`).all()
  const updatedWorkflows = []
  for (const workflow of workflows) {
    const nodes = safeJsonArray(String(workflow.nodes_json || "[]")).map((node) => {
      if (!node || typeof node !== "object" || node.type !== "image_generation") return node
      return {
        ...node,
        providerId: YUNWU_DEFAULT_PROVIDER_ID,
        fallbackProviderId: "",
        failureStrategy: "stop",
        config: { ...(node.config && typeof node.config === "object" ? node.config : {}), callFailurePolicy: "stop" },
      }
    })
    if (!IMAGE_WORKFLOW_MODES.has(String(workflow.mode))) continue
    db.prepare(`
      UPDATE workflow_configs
      SET provider_id = ?, fallback_provider_id = '', nodes_json = ?, updated_at = ?
      WHERE id = ?
    `).run(YUNWU_DEFAULT_PROVIDER_ID, JSON.stringify(nodes), now, workflow.id)
    updatedWorkflows.push({ id: String(workflow.id), mode: String(workflow.mode) })
  }

  db.exec("COMMIT")
  console.log(JSON.stringify({
    ok: true,
    dbPath,
    activeProviderId: YUNWU_DEFAULT_PROVIDER_ID,
    availableProviderIds: [YUNWU_NANO2_PROVIDER_ID, YUNWU_IMAGE2_PROVIDER_ID],
    disabledProviders: DISABLED_302_PROVIDER_IDS,
    updatedWorkflows,
  }, null, 2))
} catch (error) {
  db.exec("ROLLBACK")
  throw error
} finally {
  db.close()
}

function upsertProvider(provider) {
  db.prepare(`
    INSERT INTO provider_configs
    (id, label, base_url, model_name, capabilities_json, enabled, active, api_key_cipher, api_key_masked, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, 0, '', '', ?)
    ON CONFLICT(id) DO UPDATE SET
      label = excluded.label,
      base_url = excluded.base_url,
      model_name = excluded.model_name,
      capabilities_json = excluded.capabilities_json,
      enabled = 1,
      updated_at = excluded.updated_at
  `).run(provider.id, provider.label, provider.baseUrl, provider.modelName, JSON.stringify(["image_generation"]), now)
}

function copyYunwuKeyIfNeeded(fromProviderId, toProviderId) {
  const source = db.prepare(`SELECT api_key_cipher, api_key_masked FROM provider_configs WHERE id = ?`).get(fromProviderId)
  const target = db.prepare(`SELECT api_key_cipher, api_key_masked FROM provider_configs WHERE id = ?`).get(toProviderId)
  if (!source?.api_key_cipher || target?.api_key_cipher) return
  db.prepare(`UPDATE provider_configs SET api_key_cipher = ?, api_key_masked = ?, updated_at = ? WHERE id = ?`).run(
    source.api_key_cipher,
    source.api_key_masked || "",
    now,
    toProviderId,
  )
}

function safeJsonArray(value) {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
