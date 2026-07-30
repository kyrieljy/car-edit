'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type {
  QualityScoreTrendResponse,
  BadCaseEfficiencyResponse,
} from '@/lib/types';
import {
  StatCard,
  LineChartCard,
  TimeRangeSelector,
  GranularitySelector,
} from './analytics-charts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMs(v: number): string {
  if (v < 1000) return `${v}ms`;
  return `${(v / 1000).toFixed(1)}s`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function QualityAnalytics() {
  const [days, setDays] = useState(30);
  const [granularity, setGranularity] = useState('day');
  const [scoreData, setScoreData] = useState<QualityScoreTrendResponse | null>(null);
  const [badCaseData, setBadCaseData] = useState<BadCaseEfficiencyResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchScoreTrend = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/analytics/quality/score-trend?days=${days}&granularity=${granularity}`
      );
      if (res.ok) {
        const data = await res.json() as QualityScoreTrendResponse;
        setScoreData(data);
      }
    } catch {
      // noop
    } finally {
      setLoading(false);
    }
  }, [days, granularity]);

  const fetchBadCaseEfficiency = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/admin/analytics/quality/bad-cases?days=${days}&granularity=${granularity}`
      );
      if (res.ok) {
        const data = await res.json() as BadCaseEfficiencyResponse;
        setBadCaseData(data);
      }
    } catch {
      // noop
    }
  }, [days, granularity]);

  useEffect(() => {
    void fetchScoreTrend();
  }, [fetchScoreTrend]);

  useEffect(() => {
    void fetchBadCaseEfficiency();
  }, [fetchBadCaseEfficiency]);

  const scoreSeries = scoreData
    ? [
        {
          name: 'avgScore',
          data: scoreData.points.map((p) => ({ date: p.date, value: p.avgScore })),
        },
      ]
    : [];

  const badCaseSeries = badCaseData
    ? [
        {
          name: 'processed',
          data: badCaseData.points.map((p) => ({ date: p.date, value: p.processed })),
        },
        {
          name: 'unprocessed',
          data: badCaseData.points.map((p) => ({ date: p.date, value: p.unprocessed })),
        },
      ]
    : [];

  const lowScoreDates = scoreData
    ? scoreData.points.filter((p) => p.avgScore < scoreData.threshold).map((p) => p.date)
    : [];

  return (
    <div className="analytics-page">
      <div className="analytics-toolbar">
        <TimeRangeSelector value={days} onChange={setDays} />
        <GranularitySelector value={granularity} onChange={setGranularity} />
      </div>

      {lowScoreDates.length > 0 && (
        <div className="analytics-anomaly-banner">
          <AlertTriangle size={16} />
          <span>Low quality score dates: {lowScoreDates.join(', ')}</span>
        </div>
      )}

      {badCaseData && (
        <div className="analytics-stat-row">
          <StatCard label="Processed" value={badCaseData.totalProcessed} />
          <StatCard label="Unprocessed" value={badCaseData.totalUnprocessed} />
          <StatCard label="Avg Process Time" value={formatMs(badCaseData.overallAvgTimeMs)} />
        </div>
      )}

      {loading ? (
        <div className="analytics-loading">Loading...</div>
      ) : (
        <>
          <LineChartCard
            title="Average Quality Score"
            series={scoreSeries}
          />

          <LineChartCard
            title="Bad Case Processing"
            series={badCaseSeries}
          />
        </>
      )}
    </div>
  );
}
