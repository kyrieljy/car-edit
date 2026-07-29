'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TrendingUp, TrendingDown, Users, Activity } from 'lucide-react';
import type {
  AnalyticsTrendResponse,
  ActivityResponse,
  RetentionResponse,
  ActiveUserItem,
} from '@/lib/types';
import {
  StatCard,
  LineChartCard,
  BarChartCard,
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

function toLocalDateStr(dateStr: string): string {
  if (!dateStr) return '';
  return dateStr.slice(0, 10);
}

function todayStr(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const MM = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${MM}-${dd}`;
}

function formatPercent(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

const PLAN_LABELS: Record<string, string> = {
  free: '免费版',
  pro: '专业版',
  max: '旗舰版',
  internal: '内部',
  prototype: '内测',
};

function planLabel(plan: string): string {
  return PLAN_LABELS[plan] ?? plan;
}

const RETENTION_COLORS: Record<number, string> = {
  1: '#3a82ff',
  7: '#f59e0b',
  30: '#48d18d',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type UserAnalyticsProps = {
  onOpenUserDetail: (userId: string) => void;
};

export default function UserAnalytics({ onOpenUserDetail }: UserAnalyticsProps) {
  const [days, setDays] = useState(7);
  const [granularity, setGranularity] = useState<string>('day');
  const [regData, setRegData] = useState<AnalyticsTrendResponse | null>(null);
  const [actData, setActData] = useState<ActivityResponse | null>(null);
  const [retData, setRetData] = useState<RetentionResponse | null>(null);
  const [activeItems, setActiveItems] = useState<ActiveUserItem[]>([]);
  const [activeLoading, setActiveLoading] = useState(false);

  const regAbortRef = useRef<AbortController | null>(null);
  const actAbortRef = useRef<AbortController | null>(null);
  const retAbortRef = useRef<AbortController | null>(null);
  const activeAbortRef = useRef<AbortController | null>(null);

  // ---- fetch registration trend ----
  const fetchRegistration = useCallback(async () => {
    regAbortRef.current?.abort();
    const controller = new AbortController();
    regAbortRef.current = controller;
    try {
      const params = new URLSearchParams();
      params.set('granularity', granularity);
      params.set('days', String(days));
      const res = await fetch(
        `/api/admin/analytics/users/registration-trend?${params.toString()}`,
        { signal: controller.signal },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: AnalyticsTrendResponse = await res.json();
      setRegData(json);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setRegData(null);
      }
    }
  }, [granularity, days]);

  // ---- fetch activity metrics ----
  const fetchActivity = useCallback(async () => {
    actAbortRef.current?.abort();
    const controller = new AbortController();
    actAbortRef.current = controller;
    try {
      const params = new URLSearchParams();
      params.set('granularity', granularity);
      params.set('days', String(days));
      const res = await fetch(
        `/api/admin/analytics/users/activity?${params.toString()}`,
        { signal: controller.signal },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: ActivityResponse = await res.json();
      setActData(json);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setActData(null);
      }
    }
  }, [granularity, days]);

  // ---- fetch retention cohorts ----
  const fetchRetention = useCallback(async () => {
    retAbortRef.current?.abort();
    const controller = new AbortController();
    retAbortRef.current = controller;
    try {
      const params = new URLSearchParams();
      params.set('days', String(days));
      params.set('periods', '1,7,30');
      const res = await fetch(
        `/api/admin/analytics/users/retention?${params.toString()}`,
        { signal: controller.signal },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: RetentionResponse = await res.json();
      setRetData(json);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setRetData(null);
      }
    }
  }, [days]);

  // ---- fetch active user list ----
  const fetchActiveList = useCallback(async () => {
    activeAbortRef.current?.abort();
    const controller = new AbortController();
    activeAbortRef.current = controller;
    setActiveLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('date', todayStr());
      const res = await fetch(
        `/api/admin/analytics/users/active-list?${params.toString()}`,
        { signal: controller.signal },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: { items: ActiveUserItem[] } = await res.json();
      setActiveItems(json.items ?? []);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setActiveItems([]);
      }
    } finally {
      if (!controller.signal.aborted) {
        setActiveLoading(false);
      }
    }
  }, []);

  // ---- effects ----
  useEffect(() => {
    fetchRegistration();
  }, [fetchRegistration]);

  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);

  useEffect(() => {
    fetchRetention();
  }, [fetchRetention]);

  useEffect(() => {
    fetchActiveList();
  }, [fetchActiveList]);

  // ---- derived chart series ----

  const regSeries = useMemo(() => {
    if (!regData) return [];
    return [
      {
        name: '注册数',
        data: regData.points.map((p) => ({
          date: toLocalDateStr(p.date),
          value: p.count,
        })),
      },
    ];
  }, [regData]);

  const activitySeries = useMemo(() => {
    if (!actData) return [];
    return [
      {
        name: 'DAU',
        color: '#3a82ff',
        data: actData.series.map((p) => ({
          date: toLocalDateStr(p.date),
          value: p.dau,
        })),
      },
      {
        name: 'WAU',
        color: '#f59e0b',
        data: actData.series.map((p) => ({
          date: toLocalDateStr(p.date),
          value: p.wau ?? 0,
        })),
      },
      {
        name: 'MAU',
        color: '#48d18d',
        data: actData.series.map((p) => ({
          date: toLocalDateStr(p.date),
          value: p.mau ?? 0,
        })),
      },
    ];
  }, [actData]);

  const retentionSeries = useMemo(() => {
    if (!retData || retData.cohorts.length === 0) return [];
    return retData.periods.map((p) => ({
      name: `${p}日留存`,
      color: RETENTION_COLORS[p] ?? '#3a82ff',
      data: retData.cohorts.map((c) => ({
        date: toLocalDateStr(c.cohortDate),
        value: c.retention[String(p)] ?? 0,
      })),
    }));
  }, [retData]);

  const cohortBarData = useMemo(() => {
    if (!retData) return [];
    return retData.cohorts.map((c) => ({
      label: toLocalDateStr(c.cohortDate),
      count: c.registerCount,
    }));
  }, [retData]);

  const changeRate = regData?.changeRate ?? null;
  const changeUp = changeRate != null && changeRate >= 0;

  return (
    <div className="analytics-section">
      {/* ---- Time range + granularity controls ---- */}
      <div className="analytics-chart-controls">
        <TimeRangeSelector value={days} onChange={setDays} />
        <GranularitySelector value={granularity} onChange={setGranularity} />
      </div>

      {/* ---- Activity stat cards ---- */}
      <div className="analytics-stat-row">
        <StatCard
          label="日活 DAU"
          value={actData ? actData.currentDau.toLocaleString() : '-'}
          sublabel="今日活跃用户"
        />
        <StatCard
          label="周活 WAU"
          value={actData ? actData.currentWau.toLocaleString() : '-'}
          sublabel="近7天活跃用户"
        />
        <StatCard
          label="月活 MAU"
          value={actData ? actData.currentMau.toLocaleString() : '-'}
          sublabel="近30天活跃用户"
        />
      </div>

      {/* ---- Registration trend with change rate ---- */}
      <div className="analytics-chart-section">
        <div className="analytics-chart-controls">
          <span>
            <Users size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            注册趋势
          </span>
          {changeRate != null ? (
            <span
              className={`analytics-change-indicator ${changeUp ? 'up' : 'down'}`}
            >
              {changeUp ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              环比 {changeUp ? '+' : ''}
              {(changeRate * 100).toFixed(1)}%
            </span>
          ) : (
            <span className="analytics-change-indicator">环比 -</span>
          )}
        </div>
        <LineChartCard
          title="注册数量趋势"
          series={regSeries}
          height={260}
          valueFormatter={(v) => v.toLocaleString()}
        />
      </div>

      {/* ---- Activity trend + Retention trend grid ---- */}
      <div className="analytics-chart-grid">
        <LineChartCard
          title="活跃度趋势 (DAU/WAU/MAU)"
          series={activitySeries}
          height={260}
          valueFormatter={(v) => v.toLocaleString()}
        />
        <LineChartCard
          title="留存率趋势"
          series={retentionSeries}
          height={260}
          valueFormatter={formatPercent}
        />
      </div>

      {/* ---- Cohort registration volume bar chart ---- */}
      <BarChartCard title="各批次注册人数" data={cohortBarData} height={260} />

      {/* ---- Active user list ---- */}
      <div className="analytics-active-list">
        <div className="analytics-chart-header">
          <h3>
            <Activity size={16} style={{ marginRight: 6, verticalAlign: 'middle' }} />
            活跃用户列表
          </h3>
        </div>
        <table className="analytics-table">
          <thead>
            <tr>
              <th>用户名</th>
              <th>套餐</th>
              <th>今日生成数</th>
              <th>最后活跃</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {activeLoading && activeItems.length === 0 && (
              <tr>
                <td colSpan={5} className="analytics-table-empty">
                  加载中...
                </td>
              </tr>
            )}
            {!activeLoading && activeItems.length === 0 && (
              <tr>
                <td colSpan={5} className="analytics-table-empty">
                  暂无数据
                </td>
              </tr>
            )}
            {activeItems.map((item) => (
              <tr key={item.userId} className="analytics-table-row">
                <td>{item.username}</td>
                <td>{planLabel(item.plan)}</td>
                <td>{item.todayGenerations}</td>
                <td>{item.lastActiveAt ? formatTimestamp(item.lastActiveAt) : '-'}</td>
                <td>
                  <button
                    className="analytics-detail-btn"
                    onClick={() => onOpenUserDetail(item.userId)}
                    type="button"
                  >
                    详情
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
