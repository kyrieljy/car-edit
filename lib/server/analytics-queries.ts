import { DatabaseSync } from "node:sqlite"
import type {
  ActiveUserItem,
  ActivityResponse,
  AnalyticsGranularity,
  AnalyticsTimeseriesPoint,
  AnalyticsTrendResponse,
  CostBucket,
  CostDistributionResponse,
  FailureAttributionItem,
  FailureAttributionResponse,
  FailureTrendPoint,
  FailureTrendResponse,
  LatencyPoint,
  LatencyResponse,
  QualityScorePoint,
  QualityScoreTrendResponse,
  BadCaseEfficiencyPoint,
  BadCaseEfficiencyResponse,
  QueueStatusResponse,
  ReportMetrics,
  RetentionResponse,
  SuccessRatePoint,
  SuccessRateResponse,
} from "../types"
import { database, type Row } from "./db"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a millisecond timestamp to a SQLite datetime expression that can be
 * used inside SQL queries. The project stores all timestamps as INTEGER
 * milliseconds, so we divide by 1000 and use the `unixepoch` modifier.
 */
function tsExpr(column: string): string {
  return `datetime(${column} / 1000, 'unixepoch')`
}

/**
 * Return a SQLite strftime format string for the requested granularity.
 */
function granularityFormat(granularity: AnalyticsGranularity): string {
  switch (granularity) {
    case "hour":
      return "%Y-%m-%d %H:00"
    case "day":
      return "%Y-%m-%d"
    case "week":
      // ISO week: year-weekNumber — approximate by using the Monday of each week
      return "%Y-W%W"
    case "month":
      return "%Y-%m"
    default:
      return "%Y-%m-%d"
  }
}

/**
 * Compute a date-bucket expression for a given column and granularity.
 */
function bucketExpr(column: string, granularity: AnalyticsGranularity): string {
  return `strftime('${granularityFormat(granularity)}', ${tsExpr(column)})`
}

function nowMs(): number {
  return Date.now()
}

function daysAgoMs(days: number): number {
  return nowMs() - days * 24 * 60 * 60 * 1000
}

// ---------------------------------------------------------------------------
// Generic time series query
// ---------------------------------------------------------------------------

/**
 * Query a time-series aggregation from any table.
 *
 * @param options.table       - table name
 * @param options.timeColumn  - timestamp column (INTEGER ms)
 * @param options.startMs     - start timestamp (inclusive)
 * @param options.endMs       - end timestamp (inclusive)
 * @param options.granularity - hour / day / week / month
 * @param options.whereClause - optional extra WHERE fragment
 * @param options.params      - params for the extra WHERE fragment
 * @param options.groupColumn - optional column to split series by
 */
export function getTimeSeries(options: {
  table: string
  timeColumn: string
  startMs: number
  endMs: number
  granularity: AnalyticsGranularity
  whereClause?: string
  params?: Array<string | number>
  groupColumn?: string
}): AnalyticsTimeseriesPoint[] {
  const { table, timeColumn, startMs, endMs, granularity, whereClause, params = [], groupColumn } = options
  const bucket = bucketExpr(timeColumn, granularity)

  const conditions = [`${timeColumn} >= ?`, `${timeColumn} <= ?`]
  const sqlParams: Array<string | number> = [startMs, endMs]

  if (whereClause) {
    conditions.push(`(${whereClause})`)
    sqlParams.push(...params)
  }

  const groupBy = groupColumn ? `${bucket}, ${groupColumn}` : bucket
  const selectGroup = groupColumn ? `, ${groupColumn} AS group_value` : ""
  const orderBy = groupColumn ? `${bucket} ASC, ${groupColumn} ASC` : `${bucket} ASC`

  const sql = `SELECT ${bucket} AS date_bucket, COUNT(*) AS count${selectGroup} FROM ${table} WHERE ${conditions.join(" AND ")} GROUP BY ${groupBy} ORDER BY ${orderBy}`

  const rows = database().prepare(sql).all(...sqlParams) as Row[]
  return rows.map((row) => {
    const point: AnalyticsTimeseriesPoint = {
      date: String(row.date_bucket),
      count: Number(row.count),
    }
    if (groupColumn) {
      point.group = String((row as Record<string, unknown>).group_value ?? "")
    }
    return point
  })
}

// ---------------------------------------------------------------------------
// Trend with comparison (same/ratio)
// ---------------------------------------------------------------------------

/**
 * Build a trend response with current-period total, previous-period total,
 * and change-rate percentage.
 */
export function getTrendWithComparison(options: {
  table: string
  timeColumn: string
  startMs: number
  endMs: number
  granularity: AnalyticsGranularity
  whereClause?: string
  params?: Array<string | number>
  groupColumn?: string
}): AnalyticsTrendResponse {
  const { startMs, endMs, granularity, table, timeColumn, whereClause, params = [], groupColumn } = options

  const points = getTimeSeries(options)

  // Current period total
  const currentCount = points.reduce((sum, p) => sum + p.count, 0)

  // Previous period (same length immediately before startMs)
  const periodLength = endMs - startMs
  const prevStart = startMs - periodLength
  const prevPoints = getTimeSeries({
    table,
    timeColumn,
    startMs: prevStart,
    endMs: startMs - 1,
    granularity,
    whereClause,
    params,
    groupColumn,
  })
  const previousPeriodCount = prevPoints.reduce((sum, p) => sum + p.count, 0)

  const changeRate = previousPeriodCount > 0 ? ((currentCount - previousPeriodCount) / previousPeriodCount) * 100 : null

  return {
    points,
    previousPeriodCount,
    currentPeriodCount: currentCount,
    changeRate,
  }
}

// ---------------------------------------------------------------------------
// DAU / WAU / MAU
// ---------------------------------------------------------------------------

function countActiveUsers(startMs: number, endMs: number, bucketGranularity: AnalyticsGranularity | "none" = "none"): Array<{ date: string; count: number }> {
  const bucket = bucketGranularity === "none" ? "'all'" : bucketExpr("created_at", bucketGranularity)
  const sql = `SELECT ${bucket} AS date_bucket, COUNT(DISTINCT user_id) AS count FROM generation_jobs WHERE created_at >= ? AND created_at <= ? GROUP BY ${bucket} ORDER BY ${bucket} ASC`
  const rows = database().prepare(sql).all(startMs, endMs) as Row[]
  return rows.map((row) => ({ date: String(row.date_bucket), count: Number(row.count) }))
}

/**
 * Get activity metrics (DAU/WAU/MAU) time series.
 */
export function getActivitySeries(startMs: number, endMs: number, granularity: AnalyticsGranularity): ActivityResponse {
  const bucket = bucketExpr("created_at", granularity)

  // DAU series (distinct users per day)
  const dauSql = `SELECT ${bucket} AS date_bucket, COUNT(DISTINCT user_id) AS count FROM generation_jobs WHERE created_at >= ? AND created_at <= ? GROUP BY ${bucket} ORDER BY ${bucket} ASC`
  const dauRows = database().prepare(dauSql).all(startMs, endMs) as Row[]
  const dauMap = new Map<string, number>()
  for (const row of dauRows) {
    dauMap.set(String(row.date_bucket), Number(row.count))
  }

  // Build series — for each day in the range compute DAU, plus rolling WAU/MAU
  const series: ActivityResponse["series"] = []
  const dayMs = 24 * 60 * 60 * 1000
  for (let t = startMs; t <= endMs; t += dayMs) {
    const dateKey = strftimeDay(t)
    const dau = dauMap.get(dateKey) ?? 0

    // WAU: distinct users in the past 7 days (including today)
    const wauStart = t - 6 * dayMs
    const wauRow = database().prepare("SELECT COUNT(DISTINCT user_id) AS value FROM generation_jobs WHERE created_at >= ? AND created_at <= ?").get(wauStart, t) as Row
    const wau = Number(wauRow?.value ?? 0)

    // MAU: distinct users in the past 30 days (including today)
    const mauStart = t - 29 * dayMs
    const mauRow = database().prepare("SELECT COUNT(DISTINCT user_id) AS value FROM generation_jobs WHERE created_at >= ? AND created_at <= ?").get(mauStart, t) as Row
    const mau = Number(mauRow?.value ?? 0)

    series.push({ date: dateKey, dau, wau, mau })
  }

  // Current values (today)
  const todayStart = startOfTodayMs()
  const todayEnd = nowMs()
  const currentDau = Number((database().prepare("SELECT COUNT(DISTINCT user_id) AS value FROM generation_jobs WHERE created_at >= ? AND created_at <= ?").get(todayStart, todayEnd) as Row)?.value ?? 0)
  const currentWau = Number((database().prepare("SELECT COUNT(DISTINCT user_id) AS value FROM generation_jobs WHERE created_at >= ? AND created_at <= ?").get(todayStart - 6 * dayMs, todayEnd) as Row)?.value ?? 0)
  const currentMau = Number((database().prepare("SELECT COUNT(DISTINCT user_id) AS value FROM generation_jobs WHERE created_at >= ? AND created_at <= ?").get(todayStart - 29 * dayMs, todayEnd) as Row)?.value ?? 0)

  return { series, currentDau, currentWau, currentMau }
}

// ---------------------------------------------------------------------------
// Retention cohorts
// ---------------------------------------------------------------------------

/**
 * Compute retention cohorts. For each registration date in the range,
 * check what fraction of users registered on that date still had a
 * generation event on day N after registration.
 */
export function getRetentionCohorts(startMs: number, endMs: number, periods: number[]): RetentionResponse {
  const dayMs = 24 * 60 * 60 * 1000
  const db = database()

  // Get all users registered in the range, grouped by date
  const cohortSql = `SELECT date(created_at / 1000, 'unixepoch') AS cohort_date, id AS user_id FROM users WHERE created_at >= ? AND created_at <= ? ORDER BY cohort_date ASC`
  const cohortRows = db.prepare(cohortSql).all(startMs, endMs) as Array<{ cohort_date: string; user_id: string }>

  // Group user IDs by cohort date
  const cohortMap = new Map<string, string[]>()
  for (const row of cohortRows) {
    const list = cohortMap.get(row.cohort_date) ?? []
    list.push(row.user_id)
    cohortMap.set(row.cohort_date, list)
  }

  const cohorts: RetentionResponse["cohorts"] = []

  for (const [cohortDate, userIds] of cohortMap) {
    const cohortStartMs = new Date(cohortDate + "T00:00:00").getTime()
    const retention: Record<string, number> = {}

    for (const period of periods) {
      const targetStart = cohortStartMs + period * dayMs
      const targetEnd = targetStart + dayMs - 1

      if (targetEnd > nowMs()) {
        // Not enough data yet for this period
        retention[String(period)] = -1
        continue
      }

      // Count how many of these users had a generation on the target day
      if (userIds.length === 0) {
        retention[String(period)] = 0
        continue
      }

      const placeholders = userIds.map(() => "?").join(",")
      const retainedRow = db.prepare(
        `SELECT COUNT(DISTINCT user_id) AS value FROM generation_jobs WHERE user_id IN (${placeholders}) AND created_at >= ? AND created_at <= ?`
      ).get(...userIds, targetStart, targetEnd) as Row
      const retained = Number(retainedRow?.value ?? 0)
      retention[String(period)] = userIds.length > 0 ? (retained / userIds.length) * 100 : 0
    }

    cohorts.push({
      cohortDate,
      registerCount: userIds.length,
      retention,
    })
  }

  return { cohorts, periods }
}

// ---------------------------------------------------------------------------
// Active user list
// ---------------------------------------------------------------------------

/**
 * List users who were active (had at least one generation) on a given day.
 */
export function getActiveUserList(dateMs?: number): ActiveUserItem[] {
  const dayMs = 24 * 60 * 60 * 1000
  const targetDate = dateMs ?? startOfTodayMs()
  const targetEnd = targetDate + dayMs - 1

  const rows = database().prepare(`
    SELECT
      generation_jobs.user_id AS user_id,
      users.username AS username,
      users.plan AS plan,
      COUNT(*) AS today_generations,
      MAX(generation_jobs.created_at) AS last_active_at
    FROM generation_jobs
    LEFT JOIN users ON users.id = generation_jobs.user_id
    WHERE generation_jobs.created_at >= ? AND generation_jobs.created_at <= ?
    GROUP BY generation_jobs.user_id
    ORDER BY today_generations DESC
  `).all(targetDate, targetEnd) as Row[]

  return rows.map((row) => ({
    userId: String(row.user_id),
    username: String(row.username ?? ""),
    plan: String(row.plan ?? "free"),
    lastActiveAt: Number(row.last_active_at ?? 0),
    todayGenerations: Number(row.today_generations ?? 0),
  }))
}

// ---------------------------------------------------------------------------
// Percentile helper
// ---------------------------------------------------------------------------

/**
 * Compute the Nth percentile from an array of numbers.
 * Uses the nearest-rank method.
 */
export function computePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const rank = Math.ceil((percentile / 100) * sorted.length)
  const index = Math.min(rank - 1, sorted.length - 1)
  return sorted[index]
}

// ---------------------------------------------------------------------------
// Timestamp helpers
// ---------------------------------------------------------------------------

function startOfTodayMs(): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return now.getTime()
}

function strftimeDay(ms: number): string {
  const d = new Date(ms)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

// ---------------------------------------------------------------------------
// getTimeSeriesSum — SUM aggregation variant (DESIGN-20260729-003)
// ---------------------------------------------------------------------------

/**
 * Query a time-series SUM aggregation from any table.
 * Identical to getTimeSeries but uses SUM(aggregateColumn) instead of COUNT(*).
 * The `count` field in the returned points holds the SUM value.
 */
export function getTimeSeriesSum(options: {
  table: string
  timeColumn: string
  startMs: number
  endMs: number
  granularity: AnalyticsGranularity
  aggregateColumn: string
  whereClause?: string
  params?: Array<string | number>
  groupColumn?: string
}): AnalyticsTimeseriesPoint[] {
  const { table, timeColumn, startMs, endMs, granularity, aggregateColumn, whereClause, params = [], groupColumn } = options
  const bucket = bucketExpr(timeColumn, granularity)

  const conditions = [`${timeColumn} >= ?`, `${timeColumn} <= ?`]
  const sqlParams: Array<string | number> = [startMs, endMs]

  if (whereClause) {
    conditions.push(`(${whereClause})`)
    sqlParams.push(...params)
  }

  const groupBy = groupColumn ? `${bucket}, ${groupColumn}` : bucket
  const selectGroup = groupColumn ? `, ${groupColumn} AS group_value` : ""
  const orderBy = groupColumn ? `${bucket} ASC, ${groupColumn} ASC` : `${bucket} ASC`

  const sql = `SELECT ${bucket} AS date_bucket, COALESCE(SUM(${aggregateColumn}), 0) AS count${selectGroup} FROM ${table} WHERE ${conditions.join(" AND ")} GROUP BY ${groupBy} ORDER BY ${orderBy}`

  const rows = database().prepare(sql).all(...sqlParams) as Row[]
  return rows.map((row) => {
    const point: AnalyticsTimeseriesPoint = {
      date: String(row.date_bucket),
      count: Number(row.count),
    }
    if (groupColumn) {
      point.group = String((row as Record<string, unknown>).group_value ?? "")
    }
    return point
  })
}

// ---------------------------------------------------------------------------
// getFailureRateSeries — failure rate trend with anomaly detection
// ---------------------------------------------------------------------------

/**
 * Compute failure rate time series by querying total and failed generation
 * counts, then merging to produce a per-bucket failure rate.
 * Anomaly dates are those where the failure rate exceeds mean + 2 * stddev.
 */
export function getFailureRateSeries(options: {
  startMs: number
  endMs: number
  granularity: AnalyticsGranularity
  groupColumn?: string
  whereClause?: string
  params?: Array<string | number>
}): FailureTrendResponse {
  const { startMs, endMs, granularity, groupColumn, whereClause, params = [] } = options

  // Query total generation counts
  const totalPoints = getTimeSeries({
    table: "generation_jobs",
    timeColumn: "created_at",
    startMs,
    endMs,
    granularity,
    whereClause,
    params,
    groupColumn,
  })

  // Query failed generation counts
  const failedConditions = ["status = 'failed'"]
  const failedParams = [...params]
  if (whereClause) {
    failedConditions.unshift(`(${whereClause})`)
  }
  const failedWhereClause = failedConditions.join(" AND ")

  const failedPoints = getTimeSeries({
    table: "generation_jobs",
    timeColumn: "created_at",
    startMs,
    endMs,
    granularity,
    whereClause: failedWhereClause,
    params: failedParams,
    groupColumn,
  })

  // Build lookup maps for merging
  const totalMap = new Map<string, Map<string, number>>()
  for (const p of totalPoints) {
    const groupKey = p.group ?? "__total__"
    if (!totalMap.has(groupKey)) totalMap.set(groupKey, new Map())
    totalMap.get(groupKey)!.set(p.date, p.count)
  }

  const failedMap = new Map<string, Map<string, number>>()
  for (const p of failedPoints) {
    const groupKey = p.group ?? "__total__"
    if (!failedMap.has(groupKey)) failedMap.set(groupKey, new Map())
    failedMap.get(groupKey)!.set(p.date, p.count)
  }

  // Merge into FailureTrendPoint[]
  const points: FailureTrendPoint[] = []
  const allDates = Array.from(new Set([...totalPoints.map((p) => p.date), ...failedPoints.map((p) => p.date)])).sort()

  const allGroups = Array.from(new Set([...totalMap.keys(), ...failedMap.keys()]))

  for (const groupKey of allGroups) {
    const totalForGroup = totalMap.get(groupKey) ?? new Map()
    const failedForGroup = failedMap.get(groupKey) ?? new Map()
    for (const date of allDates) {
      const total = totalForGroup.get(date) ?? 0
      const failed = failedForGroup.get(date) ?? 0
      const failureRate = total > 0 ? (failed / total) * 100 : 0
      const point: FailureTrendPoint = { date, total, failed, failureRate }
      if (groupColumn && groupKey !== "__total__") {
        point.group = groupKey
      }
      points.push(point)
    }
  }

  // Compute anomaly dates (only for ungrouped series)
  const anomalyDates: string[] = []
  if (!groupColumn) {
    const rates = points.map((p) => p.failureRate).filter((r) => r > 0)
    if (rates.length > 0) {
      const mean = rates.reduce((a, b) => a + b, 0) / rates.length
      const variance = rates.reduce((a, b) => a + (b - mean) ** 2, 0) / rates.length
      const stddev = Math.sqrt(variance)
      const threshold = mean + 2 * stddev
      for (const p of points) {
        if (p.failureRate > threshold && p.failureRate > 0) {
          anomalyDates.push(p.date)
        }
      }
    }
  }

  return { points, anomalyDates }
}

// ---------------------------------------------------------------------------
// getCostDistribution — histogram + percentiles (DESIGN-20260729-003)
// ---------------------------------------------------------------------------

/**
 * Query cost distribution from usage_ledger, compute P50/P90/P99 and
 * bucket into predefined ranges for histogram rendering.
 */
export function getCostDistribution(options: {
  startMs: number
  endMs: number
}): CostDistributionResponse {
  const { startMs, endMs } = options

  const rows = database()
    .prepare("SELECT cost_cents FROM usage_ledger WHERE created_at >= ? AND created_at <= ? ORDER BY cost_cents ASC")
    .all(startMs, endMs) as Row[]

  const costs = rows.map((r) => Number(r.cost_cents ?? 0))

  if (costs.length === 0) {
    return { buckets: [], p50: 0, p90: 0, p99: 0 }
  }

  const p50 = computePercentile(costs, 50)
  const p90 = computePercentile(costs, 90)
  const p99 = computePercentile(costs, 99)

  // Define histogram buckets (in cents)
  const bucketDefs = [
    { range: "0-10", min: 0, max: 10 },
    { range: "10-20", min: 10, max: 20 },
    { range: "20-50", min: 20, max: 50 },
    { range: "50-100", min: 50, max: 100 },
    { range: "100+", min: 100, max: Infinity },
  ]

  const buckets: CostBucket[] = bucketDefs.map((b) => ({
    range: b.range,
    count: costs.filter((c) => c >= b.min && c < b.max).length,
  }))

  return { buckets, p50, p90, p99 }
}

// ---------------------------------------------------------------------------
// Failure attribution (DESIGN-20260730-001)
// ---------------------------------------------------------------------------

const FAILURE_CATEGORY_RULES: Array<{ category: string; keywords: string[] }> = [
  { category: "Provider timeout", keywords: ["timeout", "超时", "time out", "ETIMEDOUT", "ECONNRESET"] },
  { category: "Provider rate limit", keywords: ["rate limit", "quota exceeded", "too many requests", "429", "throttled"] },
  { category: "Content guardrail", keywords: ["guardrail", "blocked", "content policy", "safety", "审核", "拦截"] },
  { category: "Prompt build failed", keywords: ["prompt", "template", "build", "render", "mustache"] },
  { category: "Image processing failed", keywords: ["image", "canvas", "decode", "encode", "resize", "format"] },
  { category: "Provider error", keywords: ["provider", "api error", "500", "502", "503", "bad gateway"] },
  { category: "Validation failed", keywords: ["validation", "invalid", "missing", "required", "parameter"] },
]

function classifyFailure(errorMessage: string | null): string {
  if (!errorMessage) return "Other"
  const lower = errorMessage.toLowerCase()
  for (const rule of FAILURE_CATEGORY_RULES) {
    if (rule.keywords.some((kw) => lower.includes(kw.toLowerCase()))) {
      return rule.category
    }
  }
  return "Other"
}

export function getFailureAttribution(options: {
  startMs: number
  endMs: number
  provider?: string
  mode?: string
}): FailureAttributionResponse {
  const { startMs, endMs, provider, mode } = options
  const conditions = ["status = 'failed'", "created_at >= ?", "created_at <= ?"]
  const params: Array<string | number> = [startMs, endMs]
  if (provider) {
    conditions.push("provider = ?")
    params.push(provider)
  }
  if (mode) {
    conditions.push("mode = ?")
    params.push(mode)
  }

  const sql = `SELECT failure_reason FROM generation_jobs WHERE ${conditions.join(" AND ")}`
  const rows = database().prepare(sql).all(...params) as Array<{ failure_reason: string | null }>

  const counts = new Map<string, number>()
  for (const row of rows) {
    const category = classifyFailure(row.failure_reason)
    counts.set(category, (counts.get(category) ?? 0) + 1)
  }

  const total = rows.length
  const items: FailureAttributionItem[] = Array.from(counts.entries())
    .map(([category, count]) => ({
      category,
      count,
      percentage: total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0,
    }))
    .sort((a, b) => b.count - a.count)

  return { items, total }
}

// ---------------------------------------------------------------------------
// Health monitoring — success rate (DESIGN-20260730-001)
// ---------------------------------------------------------------------------

export function getSuccessRateSeries(options: {
  startMs: number
  endMs: number
  granularity: AnalyticsGranularity
  provider?: string
}): SuccessRateResponse {
  const { startMs, endMs, granularity, provider } = options
  const bucket = bucketExpr("created_at", granularity)
  const conditions = ["created_at >= ?", "created_at <= ?"]
  const params: Array<string | number> = [startMs, endMs]
  if (provider) {
    conditions.push("provider = ?")
    params.push(provider)
  }

  const whereClause = conditions.join(" AND ")

  // Total counts per bucket (optionally grouped by provider)
  const totalSql = provider
    ? `SELECT ${bucket} AS date_bucket, COUNT(*) AS total FROM generation_jobs WHERE ${whereClause} GROUP BY ${bucket} ORDER BY ${bucket} ASC`
    : `SELECT ${bucket} AS date_bucket, provider, COUNT(*) AS total FROM generation_jobs WHERE ${whereClause} GROUP BY ${bucket}, provider ORDER BY ${bucket} ASC, provider ASC`

  const succeededSql = provider
    ? `SELECT ${bucket} AS date_bucket, COUNT(*) AS succeeded FROM generation_jobs WHERE ${whereClause} AND status = 'succeeded' GROUP BY ${bucket} ORDER BY ${bucket} ASC`
    : `SELECT ${bucket} AS date_bucket, provider, COUNT(*) AS succeeded FROM generation_jobs WHERE ${whereClause} AND status = 'succeeded' GROUP BY ${bucket}, provider ORDER BY ${bucket} ASC, provider ASC`

  if (!provider) {
    // Ungrouped query already includes provider; need to adjust params for succeeded query
    const totalRows = database().prepare(totalSql).all(...params) as Array<{
      date_bucket: string
      provider: string
      total: number
    }>
    const succeededRows = database().prepare(succeededSql).all(...params) as Array<{
      date_bucket: string
      provider: string
      succeeded: number
    }>

    const succeededMap = new Map<string, number>()
    for (const r of succeededRows) {
      succeededMap.set(`${r.date_bucket}|${r.provider}`, r.succeeded)
    }

    const points: SuccessRatePoint[] = totalRows.map((r) => {
      const succeeded = succeededMap.get(`${r.date_bucket}|${r.provider}`) ?? 0
      return {
        date: r.date_bucket,
        provider: r.provider,
        successRate: r.total > 0 ? Number(((succeeded / r.total) * 100).toFixed(1)) : 0,
        total: r.total,
        succeeded,
      }
    })

    return { points }
  }

  // Provider-specific query (no provider grouping)
  const totalRows = database().prepare(totalSql).all(...params) as Array<{
    date_bucket: string
    total: number
  }>
  const succeededRows = database().prepare(succeededSql).all(...params) as Array<{
    date_bucket: string
    succeeded: number
  }>

  const succeededMap = new Map<string, number>()
  for (const r of succeededRows) {
    succeededMap.set(r.date_bucket, r.succeeded)
  }

  const points: SuccessRatePoint[] = totalRows.map((r) => {
    const succeeded = succeededMap.get(r.date_bucket) ?? 0
    return {
      date: r.date_bucket,
      provider: provider ?? "all",
      successRate: r.total > 0 ? Number(((succeeded / r.total) * 100).toFixed(1)) : 0,
      total: r.total,
      succeeded,
    }
  })

  return { points }
}

// ---------------------------------------------------------------------------
// Health monitoring — latency percentiles (DESIGN-20260730-001)
// ---------------------------------------------------------------------------

export function getLatencyPercentiles(options: {
  startMs: number
  endMs: number
  granularity: AnalyticsGranularity
  provider?: string
}): LatencyResponse {
  const { startMs, endMs, granularity, provider } = options
  const bucket = bucketExpr("created_at", granularity)
  const conditions = ["status = 'succeeded'", "completed_at > created_at", "created_at >= ?", "created_at <= ?"]
  const params: Array<string | number> = [startMs, endMs]
  if (provider) {
    conditions.push("provider = ?")
    params.push(provider)
  }

  const whereClause = conditions.join(" AND ")

  const sql = provider
    ? `SELECT ${bucket} AS date_bucket, (completed_at - created_at) AS duration_ms FROM generation_jobs WHERE ${whereClause} ORDER BY date_bucket ASC, duration_ms ASC`
    : `SELECT ${bucket} AS date_bucket, provider, (completed_at - created_at) AS duration_ms FROM generation_jobs WHERE ${whereClause} ORDER BY date_bucket ASC, provider ASC, duration_ms ASC`

  const rows = database().prepare(sql).all(...params) as Array<{
    date_bucket: string
    provider?: string
    duration_ms: number
  }>

  // Group by date (and provider if ungrouped)
  const groupKey = (r: typeof rows[0]) => (provider ? r.date_bucket : `${r.date_bucket}|${r.provider}`)

  const groups = new Map<string, { date: string; provider?: string; durations: number[] }>()
  for (const r of rows) {
    const key = groupKey(r)
    if (!groups.has(key)) {
      groups.set(key, { date: r.date_bucket, provider: r.provider, durations: [] })
    }
    groups.get(key)!.durations.push(r.duration_ms)
  }

  const points: LatencyPoint[] = []
  for (const g of groups.values()) {
    const d = g.durations
    points.push({
      date: g.date,
      provider: g.provider,
      p50: Math.round(computePercentile(d, 50)),
      p95: Math.round(computePercentile(d, 95)),
      p99: Math.round(computePercentile(d, 99)),
    })
  }

  return { points }
}

// ---------------------------------------------------------------------------
// Health monitoring — queue status (DESIGN-20260730-001)
// ---------------------------------------------------------------------------

export function getQueueStatus(): QueueStatusResponse {
  const db = database()
  const queued = Number(
    (db.prepare("SELECT COUNT(*) AS value FROM generation_jobs WHERE status = 'queued'").get() as Row)?.value ?? 0
  )
  const running = Number(
    (db.prepare("SELECT COUNT(*) AS value FROM generation_jobs WHERE status = 'running'").get() as Row)?.value ?? 0
  )
  return { queued, running, alert: queued > 20 }
}

// ---------------------------------------------------------------------------
// Quality analysis — score trend (DESIGN-20260730-001)
// ---------------------------------------------------------------------------

export function getQualityScoreTrend(options: {
  startMs: number
  endMs: number
  granularity: AnalyticsGranularity
}): QualityScoreTrendResponse {
  const { startMs, endMs, granularity } = options
  const bucket = bucketExpr("created_at", granularity)

  const sql = `SELECT ${bucket} AS date_bucket, result_check FROM generation_jobs WHERE status = 'succeeded' AND result_check IS NOT NULL AND created_at >= ? AND created_at <= ? ORDER BY date_bucket ASC`
  const rows = database().prepare(sql).all(startMs, endMs) as Array<{
    date_bucket: string
    result_check: string | null
  }>

  const groups = new Map<string, number[]>()
  for (const r of rows) {
    if (!r.result_check) continue
    try {
      const rc = JSON.parse(r.result_check) as { score?: number }
      if (typeof rc.score === "number") {
        const list = groups.get(r.date_bucket) ?? []
        list.push(rc.score)
        groups.set(r.date_bucket, list)
      }
    } catch {
      // ignore malformed JSON
    }
  }

  const points: QualityScorePoint[] = []
  for (const [date, scores] of groups) {
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length
    points.push({
      date,
      avgScore: Number(avg.toFixed(1)),
      minScore: Math.min(...scores),
      maxScore: Math.max(...scores),
      count: scores.length,
    })
  }

  points.sort((a, b) => a.date.localeCompare(b.date))

  return { points, threshold: 70 }
}

// ---------------------------------------------------------------------------
// Quality analysis — bad case efficiency (DESIGN-20260730-001)
// ---------------------------------------------------------------------------

export function getBadCaseEfficiency(options: {
  startMs: number
  endMs: number
  granularity: AnalyticsGranularity
}): BadCaseEfficiencyResponse {
  const { startMs, endMs, granularity } = options
  const bucket = bucketExpr("created_at", granularity)

  const sql = `SELECT ${bucket} AS date_bucket, COUNT(*) AS total, AVG(CASE WHEN updated_at > created_at THEN (updated_at - created_at) ELSE NULL END) AS avg_time, SUM(CASE WHEN updated_at > created_at THEN 1 ELSE 0 END) AS processed FROM generation_bad_cases WHERE created_at >= ? AND created_at <= ? GROUP BY ${bucket} ORDER BY ${bucket} ASC`

  const rows = database().prepare(sql).all(startMs, endMs) as Array<{
    date_bucket: string
    total: number
    avg_time: number | null
    processed: number
  }>

  const overallSql = `SELECT COUNT(*) AS total, AVG(CASE WHEN updated_at > created_at THEN (updated_at - created_at) ELSE NULL END) AS avg_time, SUM(CASE WHEN updated_at > created_at THEN 1 ELSE 0 END) AS processed FROM generation_bad_cases WHERE created_at >= ? AND created_at <= ?`
  const overall = database().prepare(overallSql).get(startMs, endMs) as {
    total: number
    avg_time: number | null
    processed: number
  }

  const points: BadCaseEfficiencyPoint[] = rows.map((r) => ({
    date: r.date_bucket,
    avgProcessTimeMs: Math.round(r.avg_time ?? 0),
    processed: r.processed,
    unprocessed: r.total - r.processed,
  }))

  return {
    points,
    totalProcessed: Number(overall.processed ?? 0),
    totalUnprocessed: Number(overall.total ?? 0) - Number(overall.processed ?? 0),
    overallAvgTimeMs: Math.round(overall.avg_time ?? 0),
  }
}

// ---------------------------------------------------------------------------
// Report generation helpers (DESIGN-20260730-001)
// ---------------------------------------------------------------------------

export function getReportMetrics(options: {
  startMs: number
  endMs: number
  granularity: AnalyticsGranularity
}): ReportMetrics[] {
  const { startMs, endMs, granularity } = options
  const bucket = bucketExpr("created_at", granularity)

  // New users per bucket
  const userRows = database()
    .prepare(`SELECT ${bucket} AS date_bucket, COUNT(*) AS count FROM users WHERE created_at >= ? AND created_at <= ? GROUP BY ${bucket} ORDER BY ${bucket} ASC`)
    .all(startMs, endMs) as Array<{ date_bucket: string; count: number }>
  const userMap = new Map(userRows.map((r) => [r.date_bucket, r.count]))

  // Total generations per bucket
  const genRows = database()
    .prepare(`SELECT ${bucket} AS date_bucket, COUNT(*) AS count FROM generation_jobs WHERE created_at >= ? AND created_at <= ? GROUP BY ${bucket} ORDER BY ${bucket} ASC`)
    .all(startMs, endMs) as Array<{ date_bucket: string; count: number }>
  const genMap = new Map(genRows.map((r) => [r.date_bucket, r.count]))

  // Successful generations per bucket
  const successRows = database()
    .prepare(`SELECT ${bucket} AS date_bucket, COUNT(*) AS count FROM generation_jobs WHERE status = 'succeeded' AND created_at >= ? AND created_at <= ? GROUP BY ${bucket} ORDER BY ${bucket} ASC`)
    .all(startMs, endMs) as Array<{ date_bucket: string; count: number }>
  const successMap = new Map(successRows.map((r) => [r.date_bucket, r.count]))

  // Revenue per bucket
  const revenueRows = database()
    .prepare(`SELECT ${bucket} AS date_bucket, COALESCE(SUM(amount_cents), 0) AS total FROM payment_orders WHERE status = 'paid' AND created_at >= ? AND created_at <= ? GROUP BY ${bucket} ORDER BY ${bucket} ASC`)
    .all(startMs, endMs) as Array<{ date_bucket: string; total: number }>
  const revenueMap = new Map(revenueRows.map((r) => [r.date_bucket, r.total]))

  // Cost per bucket
  const costRows = database()
    .prepare(`SELECT ${bucket} AS date_bucket, COALESCE(SUM(cost_cents), 0) AS total FROM usage_ledger WHERE created_at >= ? AND created_at <= ? GROUP BY ${bucket} ORDER BY ${bucket} ASC`)
    .all(startMs, endMs) as Array<{ date_bucket: string; total: number }>
  const costMap = new Map(costRows.map((r) => [r.date_bucket, r.total]))

  const allDates = Array.from(new Set([...userMap.keys(), ...genMap.keys(), ...revenueMap.keys(), ...costMap.keys()])).sort()

  return allDates.map((date) => {
    const totalGen = genMap.get(date) ?? 0
    const successGen = successMap.get(date) ?? 0
    return {
      date,
      newUsers: userMap.get(date) ?? 0,
      totalGenerations: totalGen,
      successRate: totalGen > 0 ? Number(((successGen / totalGen) * 100).toFixed(1)) : 0,
      totalRevenueCents: revenueMap.get(date) ?? 0,
      totalCostCents: costMap.get(date) ?? 0,
    }
  })
}
