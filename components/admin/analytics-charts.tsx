"use client"

import type React from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts"

// ---------------------------------------------------------------------------
// Chart color palette (aligned with admin dark theme)
// ---------------------------------------------------------------------------

const CHART_COLORS = ["#614b00", "#3a82ff", "#48d18d", "#ef6363", "#a855f7", "#f59e0b", "#06b6d4", "#ec4899"]
const TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: "rgba(10, 10, 11, 0.95)",
  border: "1px solid var(--line)",
  borderRadius: "var(--radius-md, 8px)",
  color: "var(--text)",
  fontSize: "12px",
  padding: "8px 12px",
}
const AXIS_TICK_STYLE = { fill: "var(--muted)", fontSize: 11 }

// ---------------------------------------------------------------------------
// StatCard
// ---------------------------------------------------------------------------

export function StatCard({ label, value, sublabel }: { label: string; value: string | number; sublabel?: string }) {
  return (
    <div className="analytics-stat-card">
      <span className="analytics-stat-label">{label}</span>
      <strong className="analytics-stat-value">{value}</strong>
      {sublabel && <em className="analytics-stat-sub">{sublabel}</em>}
    </div>
  )
}

// ---------------------------------------------------------------------------
// LineChartCard
// ---------------------------------------------------------------------------

type LineSeries = {
  name: string
  data: Array<{ date: string; value: number }>
  color?: string
}

export function LineChartCard({
  title,
  series,
  height = 280,
  valueFormatter,
}: {
  title: string
  series: LineSeries[]
  height?: number
  valueFormatter?: (value: number) => string
}) {
  // Merge all series dates into a single x-axis
  const allDates = Array.from(new Set(series.flatMap((s) => s.data.map((d) => d.date)))).sort()
  const merged = allDates.map((date) => {
    const point: Record<string, string | number> = { date }
    for (const s of series) {
      const found = s.data.find((d) => d.date === date)
      point[s.name] = found ? found.value : 0
    }
    return point
  })

  return (
    <div className="analytics-chart-card">
      <div className="analytics-chart-header">
        <h3>{title}</h3>
      </div>
      <div className="analytics-chart-body" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={merged} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis dataKey="date" tick={AXIS_TICK_STYLE} stroke="var(--line)" />
            <YAxis tick={AXIS_TICK_STYLE} stroke="var(--line)" tickFormatter={(value: number) => valueFormatter ? valueFormatter(value) : String(value)} width={50} />
            <Tooltip
              contentStyle={TOOLTIP_STYLE}
              formatter={valueFormatter ? (value: unknown) => valueFormatter(Number(value)) : undefined}
            />
            {series.length > 1 && <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted)" }} />}
            {series.map((s, i) => (
              <Line
                key={s.name}
                type="monotone"
                dataKey={s.name}
                stroke={s.color ?? CHART_COLORS[i % CHART_COLORS.length]}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4 }}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// BarChartCard (horizontal bars for TOP-N rankings)
// ---------------------------------------------------------------------------

export function BarChartCard({
  title,
  data,
  height = 280,
  color,
}: {
  title: string
  data: Array<{ label: string; count: number }>
  height?: number
  color?: string
}) {
  return (
    <div className="analytics-chart-card">
      <div className="analytics-chart-header">
        <h3>{title}</h3>
      </div>
      <div className="analytics-chart-body" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, bottom: 8, left: 40 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
            <XAxis type="number" tick={AXIS_TICK_STYLE} stroke="var(--line)" />
            <YAxis type="category" dataKey="label" tick={AXIS_TICK_STYLE} stroke="var(--line)" width={100} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="count" fill={color ?? CHART_COLORS[0]} radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DonutChartCard
// ---------------------------------------------------------------------------

export function DonutChartCard({
  title,
  data,
  height = 280,
}: {
  title: string
  data: Array<{ name: string; value: number }>
  height?: number
}) {
  return (
    <div className="analytics-chart-card">
      <div className="analytics-chart-header">
        <h3>{title}</h3>
      </div>
      <div className="analytics-chart-body" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend wrapperStyle={{ fontSize: 12, color: "var(--muted)" }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TimeRangeSelector
// ---------------------------------------------------------------------------

export function TimeRangeSelector({
  value,
  onChange,
}: {
  value: number
  onChange: (days: number) => void
}) {
  const options = [
    { label: "近7天", days: 7 },
    { label: "近30天", days: 30 },
    { label: "近90天", days: 90 },
  ]
  return (
    <div className="analytics-range-selector">
      {options.map((opt) => (
        <button
          key={opt.days}
          className={value === opt.days ? "selected" : ""}
          onClick={() => onChange(opt.days)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// GranularitySelector
// ---------------------------------------------------------------------------

export function GranularitySelector({
  value,
  onChange,
}: {
  value: string
  onChange: (granularity: string) => void
}) {
  const options = [
    { label: "小时", value: "hour" },
    { label: "天", value: "day" },
    { label: "周", value: "week" },
    { label: "月", value: "month" },
  ]
  return (
    <div className="analytics-range-selector">
      {options.map((opt) => (
        <button
          key={opt.value}
          className={value === opt.value ? "selected" : ""}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
