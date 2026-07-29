import { database, type Row, insertAlert } from "./db"
import type { AlertType } from "../types"

// ---------------------------------------------------------------------------
// Cache: avoid scanning on every request within a 5-minute window
// ---------------------------------------------------------------------------

let lastScanMs = 0
const SCAN_INTERVAL_MS = 5 * 60 * 1000 // 5 minutes

// ---------------------------------------------------------------------------
// Detection thresholds
// ---------------------------------------------------------------------------

const HIGH_FREQUENCY_THRESHOLD = 10 // > 10 generations per hour
const HIGH_COST_THRESHOLD = 100 // > 100 credits (cents) per hour

/**
 * Scan for anomalous consumption patterns in the last hour.
 * Inserts alert records for users exceeding thresholds.
 * Cached for 5 minutes to avoid excessive scanning.
 *
 * @returns The timestamp when the scan was executed.
 */
export function scanAnomalies(): number {
  const now = Date.now()

  // Use cached result if within interval
  if (now - lastScanMs < SCAN_INTERVAL_MS) {
    return lastScanMs
  }

  lastScanMs = now
  const oneHourAgo = now - 60 * 60 * 1000
  const db = database()

  // Detect high-frequency users: > 10 generations in the last hour
  const freqRows = db.prepare(`
    SELECT user_id, COUNT(*) AS count
    FROM generation_jobs
    WHERE created_at >= ?
    GROUP BY user_id
    HAVING count > ?
  `).all(oneHourAgo, HIGH_FREQUENCY_THRESHOLD) as Row[]

  for (const row of freqRows) {
    insertAlert({
      userId: String(row.user_id),
      alertType: "high_frequency" as AlertType,
      alertValue: Number(row.count),
      detectedAt: now,
    })
  }

  // Detect high-cost users: > 100 credits in the last hour
  const costRows = db.prepare(`
    SELECT user_id, SUM(cost_cents) AS total
    FROM usage_ledger
    WHERE created_at >= ?
    GROUP BY user_id
    HAVING total > ?
  `).all(oneHourAgo, HIGH_COST_THRESHOLD) as Row[]

  for (const row of costRows) {
    insertAlert({
      userId: String(row.user_id),
      alertType: "high_cost" as AlertType,
      alertValue: Number(row.total),
      detectedAt: now,
    })
  }

  return now
}
