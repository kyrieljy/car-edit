'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  CostTrendResponse,
  CostByUserResponse,
  CostByCategoryResponse,
  CostDistributionResponse,
} from '@/lib/types';
import {
  StatCard,
  LineChartCard,
  BarChartCard,
  DonutChartCard,
  TimeRangeSelector,
  GranularitySelector,
} from './analytics-charts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCents(cents: number): string {
  return `${(cents / 100).toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CostAnalytics() {
  const [days, setDays] = useState(7);
  const [granularity, setGranularity] = useState('day');
  const [groupByProvider, setGroupByProvider] = useState(false);
  const [trendData, setTrendData] = useState<CostTrendResponse | null>(null);
  const [byUserData, setByUserData] = useState<CostByUserResponse | null>(null);
  const [byCategoryData, setByCategoryData] = useState<CostByCategoryResponse | null>(null);
  const [distData, setDistData] = useState<CostDistributionResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [trendRes, userRes, catRes, distRes] = await Promise.all([
        fetch(`/api/admin/analytics/costs/trend?days=${days}&granularity=${granularity}&groupByProvider=${groupByProvider}`),
        fetch('/api/admin/analytics/costs/by-user?limit=10'),
        fetch(`/api/admin/analytics/costs/by-category?days=${days}`),
        fetch(`/api/admin/analytics/costs/distribution?days=${days}`),
      ]);

      if (trendRes.ok) setTrendData(await trendRes.json() as CostTrendResponse);
      if (userRes.ok) setByUserData(await userRes.json() as CostByUserResponse);
      if (catRes.ok) setByCategoryData(await catRes.json() as CostByCategoryResponse);
      if (distRes.ok) setDistData(await distRes.json() as CostDistributionResponse);
    } catch {
      // noop
    } finally {
      setLoading(false);
    }
  }, [days, granularity, groupByProvider]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // Build trend series
  const trendSeries = trendData
    ? groupByProvider
      ? Object.entries(
          trendData.points.reduce<Record<string, Array<{ date: string; value: number }>>>((acc, p) => {
            const g = p.group ?? 'unknown';
            if (!acc[g]) acc[g] = [];
            acc[g].push({ date: p.date, value: p.count });
            return acc;
          }, {})
        ).map(([name, data]) => ({ name, data }))
      : [{ name: 'cost', data: trendData.points.map((p) => ({ date: p.date, value: p.count })) }]
    : [];

  // Build user bar chart
  const userBars = byUserData
    ? byUserData.items.map((item) => ({
        label: item.username || item.userId.slice(0, 8),
        count: item.totalCostCents,
      }))
    : [];

  // Build category pie chart
  const categoryPie = byCategoryData
    ? byCategoryData.items.map((item) => ({
        name: item.category,
        value: item.totalCostCents,
      }))
    : [];

  // Build distribution histogram
  const distBars = distData
    ? distData.buckets.map((b) => ({ label: b.range, count: b.count }))
    : [];

  return (
    <div className="analytics-page">
      <div className="analytics-toolbar">
        <TimeRangeSelector value={days} onChange={setDays} />
        <GranularitySelector value={granularity} onChange={setGranularity} />
        <div className="analytics-range-selector">
          <button
            className={groupByProvider ? 'selected' : ''}
            onClick={() => setGroupByProvider(!groupByProvider)}
          >
            By Provider
          </button>
        </div>
      </div>

      {loading ? (
        <div className="analytics-loading">Loading...</div>
      ) : (
        <>
          <LineChartCard
            title="Cost Trend (cents)"
            series={trendSeries}
            valueFormatter={formatCents}
          />

          <div className="analytics-stat-row">
            {distData && (
              <>
                <StatCard label="P50" value={formatCents(distData.p50)} sublabel="median cost" />
                <StatCard label="P90" value={formatCents(distData.p90)} sublabel="90th percentile" />
                <StatCard label="P99" value={formatCents(distData.p99)} sublabel="99th percentile" />
              </>
            )}
          </div>

          <BarChartCard
            title="Cost by User TOP 10 (cents)"
            data={userBars}
          />

          <DonutChartCard
            title="Cost by Part Category"
            data={categoryPie}
          />

          <BarChartCard
            title="Single Generation Cost Distribution"
            data={distBars}
          />
        </>
      )}
    </div>
  );
}
