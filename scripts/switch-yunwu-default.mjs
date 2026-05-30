import { openProjectDb, parseArgs, defaultDbPath } from "./project-config-utils.mjs"

const YUNWU_PROVIDER_ID = "provider_yunwu_image_edit"
const DISABLED_302_PROVIDER_IDS = ["provider_302_nano_banana2_async_edit", "provider_80fce082"]
const IMAGE_WORKFLOW_MODES = new Set(["config", "chat"])

const args = parseArgs()
const dbPath = args.db || defaultDbPath()
const db = openProjectDb(dbPath)
const now = Date.now()

try {
  db.exec("BEGIN")

  db.prepare(`
    INSERT INTO provider_configs
    (id, label, base_url, model_name, capabilities_json, enabled, active, api_key_cipher, api_key_masked, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, 1, '', '', ?)
    ON CONFLICT(id) DO UPDATE SET
      label = excluded.label,
      base_url = excluded.base_url,
      model_name = excluded.model_name,
      capabilities_json = excluded.capabilities_json,
      enabled = 1,
      active = 1,
      updated_at = excluded.updated_at
  `).run(
    YUNWU_PROVIDER_ID,
    "Yunwu GPT Image 1 Mini Edit",
    "https://yunwu.ai/v1/images/edits",
    "gpt-image-1-mini",
    JSON.stringify(["image_generation"]),
    now,
  )

  db.prepare(`UPDATE provider_configs SET active = CASE WHEN id = ? THEN 1 ELSE 0 END`).run(YUNWU_PROVIDER_ID)
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
        providerId: YUNWU_PROVIDER_ID,
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
    `).run(YUNWU_PROVIDER_ID, JSON.stringify(nodes), now, workflow.id)
    updatedWorkflows.push({ id: String(workflow.id), mode: String(workflow.mode) })
  }

  db.exec("COMMIT")
  console.log(JSON.stringify({
    ok: true,
    dbPath,
    activeProviderId: YUNWU_PROVIDER_ID,
    disabledProviders: DISABLED_302_PROVIDER_IDS,
    updatedWorkflows,
  }, null, 2))
} catch (error) {
  db.exec("ROLLBACK")
  throw error
} finally {
  db.close()
}

function safeJsonArray(value) {
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}
