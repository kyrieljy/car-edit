'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type {
  FailureAttributionResponse,
  FailureTrendResponse,
  ProviderFailureRankingResponse,
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

function formatPercent(v: number): string {
  return `${v.toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function FailureAnalytics() {
  const [days, setDays] = useState(7);
  const [granularity, setGranularity] = useState('day');
  const [groupBy, setGroupBy] = useState<string>('none');
  const [trendData, setTrendData] = useState<FailureTrendResponse | null>(null);
  const [rankingData, setRankingData] = useState<ProviderFailureRankingResponse | null>(null);
  const [attributionData, setAttributionData] = useState<FailureAttributionResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTrend = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/analytics/failures/trend?days=${days}&granularity=${granularity}&groupBy=${groupBy}`
      );
      if (res.ok) {
        const data = await res.json() as FailureTrendResponse;
        setTrendData(data);
      }
    } catch {
      // noop
    } finally {
      setLoading(false);
    }
  }, [days, granularity, groupBy]);

  const fetchRanking = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/analytics/failures/provider-ranking');
      if (res.ok) {
        const data = await res.json() as ProviderFailureRankingResponse;
        setRankingData(data);
      }
    } catch {
      // noop
    }
  }, []);

  const fetchAttribution = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/analytics/failures/attribution?days=${days}`);
      if (res.ok) {
        const data = await res.json() as FailureAttributionResponse;
        setAttributionData(data);
      }
    } catch {
      // noop
    }
  }, [days]);

  useEffect(() => {
    void fetchTrend();
  }, [fetchTrend]);

  useEffect(() => {
    void fetchRanking();
  }, [fetchRanking]);

  useEffect(() => {
    void fetchAttribution();
  }, [fetchAttribution]);

  // Build chart series from trend data
  const trendSeries = trendData
    ? groupBy === 'none'
      ? [{
          name: 'failureRate',
          data: trendData.points.map((p) => ({ date: p.date, value: p.failureRate })),
        }]
      : Object.entries(
          trendData.points.reduce<Record<string, Array<{ date: string; value: number }>>>((acc, p) => {
            const g = p.group ?? 'unknown';
            if (!acc[g]) acc[g] = [];
            acc[g].push({ date: p.date, value: p.failureRate });
            return acc;
          }, {})
        ).map(([name, data]) => ({ name, data }))
    : [];

  // Build ranking bar chart data
  const rankingBars = rankingData
    ? rankingData.rankings.map((r) => ({
        label: r.provider,
        count: Number(r.failureRate.toFixed(1)),
      }))
    : [];

  return (
    <div className="analytics-page">
      <div className="analytics-toolbar">
        <TimeRangeSelector value={days} onChange={setDays} />
        <GranularitySelector value={granularity} onChange={setGranularity} />
        <div className="analytics-range-selector">
          {['none', 'mode', 'provider'].map((g) => (
            <button
              key={g}
              className={groupBy === g ? 'selected' : ''}
              onClick={() => setGroupBy(g)}
            >
              {g === 'none' ? 'total' : g === 'mode' ? 'mode' : 'provider'}
            </button>
          ))}
        </div>
      </div>

      {trendData && trendData.anomalyDates.length > 0 && (
        <div className="analytics-anomaly-banner">
          <AlertTriangle size={16} />
          <span>Anomaly dates detected: {trendData.anomalyDates.join(', ')}</span>
        </div>
      )}

      {loading ? (
        <div className="analytics-loading">Loading...</div>
      ) : (
        <>
          <LineChartCard
            title="Failure Rate Trend (%)"
            series={trendSeries}
            valueFormatter={formatPercent}
          />

          <BarChartCard
            title="Provider Failure Rate Ranking (%)"
            data={rankingBars}
          />

          {attributionData && attributionData.items.length > 0 && (
            <DonutChartCard
              title="Failure Attribution"
              data={attributionData.items.map((item) => ({ name: item.category, value: item.count }))}
            />
          )}

          {rankingData && rankingData.rankings.length > 0 && (
            <div className="analytics-chart-card">
              <div className="analytics-chart-header">
                <h3>Failure Reason Keywords by Provider</h3>
              </div>
              <div className="analytics-reason-list">
                {rankingData.rankings.map((r) => (
                  <div key={r.provider} className="analytics-reason-item">
                    <span className="analytics-reason-provider">{r.provider}</span>
                    <span className="analytics-reason-keywords">
                      {r.topReasons.length > 0 ? r.topReasons.join(', ') : 'No data'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
