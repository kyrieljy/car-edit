'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import type {
  SuccessRateResponse,
  LatencyResponse,
  QueueStatusResponse,
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

function formatPercent(v: number): string {
  return `${v.toFixed(1)}%`;
}

function formatMs(v: number): string {
  return `${v}ms`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function HealthAnalytics() {
  const [hours, setHours] = useState(24);
  const [granularity, setGranularity] = useState('hour');
  const [successRateData, setSuccessRateData] = useState<SuccessRateResponse | null>(null);
  const [latencyData, setLatencyData] = useState<LatencyResponse | null>(null);
  const [queueData, setQueueData] = useState<QueueStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSuccessRate = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/admin/analytics/health/success-rate?hours=${hours}&granularity=${granularity}`
      );
      if (res.ok) {
        const data = await res.json() as SuccessRateResponse;
        setSuccessRateData(data);
      }
    } catch {
      // noop
    } finally {
      setLoading(false);
    }
  }, [hours, granularity]);

  const fetchLatency = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/admin/analytics/health/latency?hours=${hours}&granularity=${granularity}`
      );
      if (res.ok) {
        const data = await res.json() as LatencyResponse;
        setLatencyData(data);
      }
    } catch {
      // noop
    }
  }, [hours, granularity]);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/analytics/health/queue');
      if (res.ok) {
        const data = await res.json() as QueueStatusResponse;
        setQueueData(data);
      }
    } catch {
      // noop
    }
  }, []);

  useEffect(() => {
    void fetchSuccessRate();
  }, [fetchSuccessRate]);

  useEffect(() => {
    void fetchLatency();
  }, [fetchLatency]);

  useEffect(() => {
    void fetchQueue();
    const interval = setInterval(() => {
      void fetchQueue();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchQueue]);

  // Build success rate series grouped by provider
  const successRateSeries = successRateData
    ? Object.entries(
        successRateData.points.reduce<Record<string, Array<{ date: string; value: number }>>>((acc, p) => {
          const key = p.provider ?? 'all';
          if (!acc[key]) acc[key] = [];
          acc[key].push({ date: p.date, value: p.successRate });
          return acc;
        }, {})
      ).map(([name, data]) => ({ name, data }))
    : [];

  // Build latency series
  const latencyP50 = latencyData
    ? Object.entries(
        latencyData.points.reduce<Record<string, Array<{ date: string; value: number }>>>((acc, p) => {
          const key = p.provider ?? 'all';
          if (!acc[key]) acc[key] = [];
          acc[key].push({ date: p.date, value: p.p50 });
          return acc;
        }, {})
      ).map(([name, data]) => ({ name: `${name} P50`, data }))
    : [];

  const latencyP95 = latencyData
    ? Object.entries(
        latencyData.points.reduce<Record<string, Array<{ date: string; value: number }>>>((acc, p) => {
          const key = p.provider ?? 'all';
          if (!acc[key]) acc[key] = [];
          acc[key].push({ date: p.date, value: p.p95 });
          return acc;
        }, {})
      ).map(([name, data]) => ({ name: `${name} P95`, data }))
    : [];

  const latencyP99 = latencyData
    ? Object.entries(
        latencyData.points.reduce<Record<string, Array<{ date: string; value: number }>>>((acc, p) => {
          const key = p.provider ?? 'all';
          if (!acc[key]) acc[key] = [];
          acc[key].push({ date: p.date, value: p.p99 });
          return acc;
        }, {})
      ).map(([name, data]) => ({ name: `${name} P99`, data }))
    : [];

  const latencySeries = [...latencyP50, ...latencyP95, ...latencyP99];

  return (
    <div className="analytics-page">
      <div className="analytics-toolbar">
        <div className="analytics-range-selector">
          {[24, 48, 72].map((h) => (
            <button
              key={h}
              className={hours === h ? 'selected' : ''}
              onClick={() => setHours(h)}
            >
              {h}h
            </button>
          ))}
        </div>
        <GranularitySelector value={granularity} onChange={setGranularity} />
      </div>

      {queueData && queueData.alert && (
        <div className="analytics-anomaly-banner">
          <AlertTriangle size={16} />
          <span>Queue backlog alert: {queueData.queued} queued, {queueData.running} running</span>
        </div>
      )}

      {queueData && (
        <div className="analytics-stat-row">
          <StatCard label="Queued" value={queueData.queued} />
          <StatCard label="Running" value={queueData.running} />
        </div>
      )}

      {loading ? (
        <div className="analytics-loading">Loading...</div>
      ) : (
        <>
          <LineChartCard
            title="API Success Rate (%)"
            series={successRateSeries}
            valueFormatter={formatPercent}
          />

          <LineChartCard
            title="Latency Percentiles (ms)"
            series={latencySeries}
            valueFormatter={formatMs}
          />
        </>
      )}
    </div>
  );
}
