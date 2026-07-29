'use client';

import { useCallback, useEffect, useState } from 'react';
import type {
  RevenueTrendResponse,
  OrderConversionResponse,
  RenewalRateResponse,
} from '@/lib/types';
import {
  StatCard,
  LineChartCard,
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

function formatPercent(v: number): string {
  return `${v.toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function OrderAnalytics() {
  const [days, setDays] = useState(7);
  const [granularity, setGranularity] = useState('day');
  const [revenueData, setRevenueData] = useState<RevenueTrendResponse | null>(null);
  const [conversionData, setConversionData] = useState<OrderConversionResponse | null>(null);
  const [renewalData, setRenewalData] = useState<RenewalRateResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [revRes, convRes, renewRes] = await Promise.all([
        fetch(`/api/admin/analytics/orders/revenue-trend?days=${days}&granularity=${granularity}`),
        fetch(`/api/admin/analytics/orders/conversion?days=${days}`),
        fetch(`/api/admin/analytics/orders/renewal?days=90`),
      ]);

      if (revRes.ok) setRevenueData(await revRes.json() as RevenueTrendResponse);
      if (convRes.ok) setConversionData(await convRes.json() as OrderConversionResponse);
      if (renewRes.ok) setRenewalData(await renewRes.json() as RenewalRateResponse);
    } catch {
      // noop
    } finally {
      setLoading(false);
    }
  }, [days, granularity]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // Build revenue trend series
  const revenueSeries = revenueData
    ? [{ name: 'revenue', data: revenueData.points.map((p) => ({ date: p.date, value: p.count })) }]
    : [];

  // Build refund rate series
  const refundSeries = conversionData
    ? [{ name: 'refundRate', data: conversionData.refundRateSeries.map((r) => ({ date: r.date, value: r.rate })) }]
    : [];

  // Build renewal rate series
  const renewalSeries = renewalData
    ? [{ name: 'renewalRate', data: renewalData.series.map((r) => ({ date: r.month, value: r.rate })) }]
    : [];

  // Build order status pie chart
  const statusPie = conversionData
    ? conversionData.statusDistribution.map((s) => ({ name: s.status, value: s.count }))
    : [];

  return (
    <div className="analytics-page">
      <div className="analytics-toolbar">
        <TimeRangeSelector value={days} onChange={setDays} />
        <GranularitySelector value={granularity} onChange={setGranularity} />
      </div>

      {loading ? (
        <div className="analytics-loading">Loading...</div>
      ) : (
        <>
          <div className="analytics-stat-row">
            {revenueData && (
              <>
                <StatCard label="Daily Revenue" value={formatCents(revenueData.dailyRevenue)} sublabel="today" />
                <StatCard label="Monthly Revenue" value={formatCents(revenueData.monthlyRevenue)} sublabel="this month" />
                <StatCard label="ARPU" value={formatCents(revenueData.arpu)} sublabel="per paid user" />
              </>
            )}
          </div>

          <LineChartCard
            title="Revenue Trend (cents)"
            series={revenueSeries}
            valueFormatter={formatCents}
          />

          {conversionData && (
            <div className="analytics-stat-row">
              <StatCard
                label="Conversion Rate"
                value={formatPercent(conversionData.conversionRate)}
                sublabel={`${conversionData.paidUsers}/${conversionData.totalUsers} users`}
              />
            </div>
          )}

          <DonutChartCard
            title="Order Status Distribution"
            data={statusPie}
          />

          <LineChartCard
            title="Refund Rate Trend (%)"
            series={refundSeries}
            valueFormatter={formatPercent}
          />

          {renewalData && (
            <div className="analytics-stat-row">
              <StatCard
                label="Renewal Rate"
                value={formatPercent(renewalData.currentRate)}
                sublabel="overall"
              />
            </div>
          )}

          <LineChartCard
            title="Renewal Rate Trend (%)"
            series={renewalSeries}
            valueFormatter={formatPercent}
          />
        </>
      )}
    </div>
  );
}
