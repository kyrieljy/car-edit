'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import type {
  QuotaConsumptionTrendResponse,
  BalanceDistributionResponse,
  AlertListResponse,
  AlertRecord,
} from '@/lib/types';
import {
  LineChartCard,
  DonutChartCard,
  TimeRangeSelector,
  GranularitySelector,
} from './analytics-charts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(ts: number): string {
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const MM = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const HH = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${MM}-${dd} ${HH}:${mm}`;
}

const ALERT_TYPE_LABELS: Record<string, string> = {
  high_frequency: 'High Frequency',
  high_cost: 'High Cost',
};

const ALERT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  ignored: 'Ignored',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function QuotaAnalytics() {
  const [days, setDays] = useState(7);
  const [granularity, setGranularity] = useState('day');
  const [consumptionData, setConsumptionData] = useState<QuotaConsumptionTrendResponse | null>(null);
  const [balanceData, setBalanceData] = useState<BalanceDistributionResponse | null>(null);
  const [alertData, setAlertData] = useState<AlertListResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [consRes, balRes, alertRes] = await Promise.all([
        fetch(`/api/admin/analytics/quota/consumption-trend?days=${days}&granularity=${granularity}`),
        fetch('/api/admin/analytics/quota/balance-distribution'),
        fetch('/api/admin/analytics/alerts?limit=50'),
      ]);

      if (consRes.ok) setConsumptionData(await consRes.json() as QuotaConsumptionTrendResponse);
      if (balRes.ok) setBalanceData(await balRes.json() as BalanceDistributionResponse);
      if (alertRes.ok) setAlertData(await alertRes.json() as AlertListResponse);
    } catch {
      // noop
    } finally {
      setLoading(false);
    }
  }, [days, granularity]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const handleAlertAction = useCallback(async (alert: AlertRecord, action: 'confirmed' | 'ignored') => {
    try {
      const res = await fetch(`/api/admin/analytics/alerts/${alert.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: action }),
      });
      if (res.ok) {
        void fetchAll();
      }
    } catch {
      // noop
    }
  }, [fetchAll]);

  // Build consumption trend series (dual series)
  const consumptionSeries = consumptionData
    ? [
        { name: 'consumption', data: consumptionData.consumptionSeries.map((p) => ({ date: p.date, value: p.count })) },
        { name: 'adjustment', data: consumptionData.adjustmentSeries.map((p) => ({ date: p.date, value: p.count })) },
      ]
    : [];

  // Build balance distribution pie chart
  const balancePie = balanceData
    ? [
        { name: 'Exhausted', value: balanceData.exhausted },
        { name: 'Near Exhausted', value: balanceData.nearExhausted },
        { name: 'Sufficient', value: balanceData.sufficient },
      ]
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
          <LineChartCard
            title="Quota Consumption Trend"
            series={consumptionSeries}
          />

          <DonutChartCard
            title="Quota Balance Distribution"
            data={balancePie}
          />

          <div className="analytics-chart-card">
            <div className="analytics-chart-header">
              <h3>Anomaly Alerts</h3>
              {alertData && (
                <span className="analytics-alert-scan-time">
                  Last scan: {formatTimestamp(alertData.scannedAt)}
                </span>
              )}
            </div>
            <div className="analytics-alert-table-wrap">
              {alertData && alertData.alerts.length > 0 ? (
                <table className="analytics-alert-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Type</th>
                      <th>Value</th>
                      <th>Detected</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alertData.alerts.map((alert) => (
                      <tr key={alert.id}>
                        <td>{alert.username || alert.userId.slice(0, 8)}</td>
                        <td>{ALERT_TYPE_LABELS[alert.alertType] ?? alert.alertType}</td>
                        <td>{alert.alertValue}</td>
                        <td>{formatTimestamp(alert.detectedAt)}</td>
                        <td>
                          <span className={`analytics-alert-status analytics-alert-status-${alert.status}`}>
                            {ALERT_STATUS_LABELS[alert.status] ?? alert.status}
                          </span>
                        </td>
                        <td>
                          {alert.status === 'pending' && (
                            <div className="analytics-alert-actions">
                              <button
                                className="analytics-alert-btn confirm"
                                onClick={() => void handleAlertAction(alert, 'confirmed')}
                              >
                                <Check size={14} />
                              </button>
                              <button
                                className="analytics-alert-btn ignore"
                                onClick={() => void handleAlertAction(alert, 'ignored')}
                              >
                                <X size={14} />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="analytics-empty">No alerts detected</div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
