'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, ChevronLeft, ChevronRight, Search, RefreshCw } from 'lucide-react';
import type { GenerationListResponse, AnalyticsTimeseriesPoint } from '@/lib/types';
import {
  StatCard,
  LineChartCard,
  TimeRangeSelector,
  GranularitySelector,
} from './analytics-charts';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

const STATUS_OPTIONS = [
  { label: '全部', value: '' },
  { label: '队列中', value: 'queued' },
  { label: '进行中', value: 'running' },
  { label: '成功', value: 'succeeded' },
  { label: '失败', value: 'failed' },
] as const;

const MODE_OPTIONS = [
  { label: '全部', value: '' },
  { label: '配置模式', value: 'config' },
  { label: '对话模式', value: 'chat' },
] as const;

const PROVIDER_OPTIONS = [
  { label: '全部', value: '' },
  { label: 'FLUX', value: 'flux' },
  { label: 'Midjourney', value: 'midjourney' },
  { label: 'Kolors', value: 'kolors' },
] as const;

const SORT_COLUMNS = [
  { key: 'created_at', label: '创建时间' },
  { key: 'cost', label: '费用' },
  { key: 'duration', label: '耗时' },
] as const;

type SortColumn = (typeof SORT_COLUMNS)[number]['key'];
type SortOrder = 'asc' | 'desc';

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

function formatCost(cents: number): string {
  if (cents > 100) {
    return `¥${(cents / 100).toFixed(2)}`;
  }
  return `${cents} cents`;
}

function formatDuration(ms: number | null): string {
  if (ms == null) return '-';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function toLocalDateStr(dateStr: string): string {
  if (!dateStr) return '';
  return dateStr.slice(0, 10);
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type GenerationRecordsProps = {
  onOpenDetail: (id: string) => void;
};

export default function GenerationRecords({ onOpenDetail }: GenerationRecordsProps) {
  // ---- filter state ----
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [mode, setMode] = useState('');
  const [status, setStatus] = useState('');
  const [providerId, setProviderId] = useState('');
  const [userQuery, setUserQuery] = useState('');
  const [partCategory, setPartCategory] = useState('');

  // ---- sort state ----
  const [sortBy, setSortBy] = useState<SortColumn>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  // ---- pagination state ----
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // ---- data state ----
  const [data, setData] = useState<GenerationListResponse | null>(null);
  const [loading, setLoading] = useState(false);

  // ---- trend state ----
  const [trendDays, setTrendDays] = useState(7);
  const [trendGranularity, setTrendGranularity] = useState('day');
  const [trendData, setTrendData] = useState<AnalyticsTimeseriesPoint[]>([]);

  // ---- abort refs ----
  const listAbortRef = useRef<AbortController | null>(null);
  const trendAbortRef = useRef<AbortController | null>(null);

  // ---- build query string from filters ----
  const filterParams = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(pageSize));
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    if (mode) params.set('mode', mode);
    if (status) params.set('status', status);
    if (providerId) params.set('providerId', providerId);
    if (userQuery.trim()) params.set('userQuery', userQuery.trim());
    if (partCategory.trim()) params.set('partCategory', partCategory.trim());
    if (sortBy) params.set('sortBy', sortBy);
    if (sortOrder) params.set('sortOrder', sortOrder);
    return params.toString();
  }, [page, pageSize, startDate, endDate, mode, status, providerId, userQuery, partCategory, sortBy, sortOrder]);

  // ---- export query string (same filters but no pagination) ----
  const exportParams = useMemo(() => {
    const params = new URLSearchParams();
    if (startDate) params.set('startDate', startDate);
    if (endDate) params.set('endDate', endDate);
    if (mode) params.set('mode', mode);
    if (status) params.set('status', status);
    if (providerId) params.set('providerId', providerId);
    if (userQuery.trim()) params.set('userQuery', userQuery.trim());
    if (partCategory.trim()) params.set('partCategory', partCategory.trim());
    if (sortBy) params.set('sortBy', sortBy);
    if (sortOrder) params.set('sortOrder', sortOrder);
    return params.toString();
  }, [startDate, endDate, mode, status, providerId, userQuery, partCategory, sortBy, sortOrder]);

  // ---- fetch generation list ----
  const fetchList = useCallback(async () => {
    listAbortRef.current?.abort();
    const controller = new AbortController();
    listAbortRef.current = controller;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/generations?${filterParams}`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: GenerationListResponse = await res.json();
      setData(json);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setData(null);
      }
    } finally {
      if (controller.signal !== undefined && !controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [filterParams]);

  // ---- fetch trend data ----
  const fetchTrend = useCallback(async () => {
    trendAbortRef.current?.abort();
    const controller = new AbortController();
    trendAbortRef.current = controller;
    try {
      const params = new URLSearchParams();
      params.set('granularity', trendGranularity);
      params.set('days', String(trendDays));
      if (mode) params.set('mode', mode);
      const res = await fetch(`/api/admin/analytics/generations/trend?${params.toString()}`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setTrendData(json.points ?? []);
    } catch {
      setTrendData([]);
    }
  }, [trendGranularity, trendDays, mode]);

  // ---- effects ----
  useEffect(() => {
    fetchList();
  }, [fetchList]);

  useEffect(() => {
    fetchTrend();
  }, [fetchTrend]);

  // ---- reset page when filters change (except page/pageSize) ----
  useEffect(() => {
    setPage(1);
  }, [startDate, endDate, mode, status, providerId, userQuery, partCategory, sortBy, sortOrder]);

  // ---- handlers ----
  const handleSort = useCallback(
    (col: SortColumn) => {
      if (sortBy === col) {
        setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      } else {
        setSortBy(col);
        setSortOrder('desc');
      }
    },
    [sortBy],
  );

  const handleRefresh = useCallback(() => {
    fetchList();
    fetchTrend();
  }, [fetchList, fetchTrend]);

  const handleExport = useCallback(() => {
    const url = `/api/admin/generations/export?${exportParams}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `generations-export-${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [exportParams]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / pageSize)) : 1;
  const stats = data?.stats ?? null;

  // ---- sort indicator ----
  const sortIndicator = (col: SortColumn) => {
    if (sortBy !== col) return '';
    return sortOrder === 'asc' ? ' \u25B2' : ' \u25BC';
  };

  return (
    <div className="analytics-section">
      {/* ---- Filter Bar ---- */}
      <div className="analytics-filter-bar">
        <div className="analytics-filter-row">
          <label>
            开始日期
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </label>
          <label>
            结束日期
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </label>
          <label>
            模式
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              {MODE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            状态
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            提供商
            <select value={providerId} onChange={(e) => setProviderId(e.target.value)}>
              {PROVIDER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="analytics-filter-row">
          <label className="analytics-search-label">
            <Search size={14} />
            <input
              type="text"
              placeholder="搜索用户..."
              value={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
            />
          </label>
          <label>
            零件类别
            <input
              type="text"
              placeholder="零件类别"
              value={partCategory}
              onChange={(e) => setPartCategory(e.target.value)}
            />
          </label>
          <button className="analytics-export-btn" onClick={handleRefresh} type="button">
            <RefreshCw size={14} />
            刷新
          </button>
        </div>
      </div>

      {/* ---- Statistics Cards ---- */}
      <div className="analytics-stat-row">
        <StatCard
          label="总生成数"
          value={stats ? stats.totalCount.toLocaleString() : '-'}
        />
        <StatCard
          label="成功率"
          value={stats ? `${(stats.successRate * 100).toFixed(1)}%` : '-'}
        />
        <StatCard
          label="平均耗时"
          value={stats?.avgDurationMs != null ? formatDuration(stats.avgDurationMs) : '-'}
        />
        <StatCard
          label="平均费用"
          value={stats ? formatCost(stats.avgCostCents) : '-'}
        />
      </div>

      {/* ---- Trend Chart ---- */}
      <div className="analytics-chart-section">
        <div className="analytics-chart-controls">
          <TimeRangeSelector value={trendDays} onChange={setTrendDays} />
          <GranularitySelector value={trendGranularity} onChange={setTrendGranularity} />
        </div>
        <LineChartCard
          title="生成数量趋势"
          series={[
            {
              name: '生成数量',
              data: trendData.map((p) => ({ date: toLocalDateStr(p.date), value: p.count })),
            },
          ]}
          height={260}
        />
      </div>

      {/* ---- Data Table ---- */}
      <div className="analytics-table-wrapper">
        <table className="analytics-table">
          <thead>
            <tr>
              <th>任务 ID</th>
              <th>用户</th>
              <th>模式</th>
              <th>状态</th>
              <th>提供商</th>
              <th>车辆</th>
              <th
                className="analytics-sortable"
                onClick={() => handleSort('duration')}
              >
                耗时{sortIndicator('duration')}
              </th>
              <th
                className="analytics-sortable"
                onClick={() => handleSort('cost')}
              >
                费用{sortIndicator('cost')}
              </th>
              <th
                className="analytics-sortable"
                onClick={() => handleSort('created_at')}
              >
                创建时间{sortIndicator('created_at')}
              </th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {loading && !data && (
              <tr>
                <td colSpan={10} className="analytics-table-empty">
                  加载中...
                </td>
              </tr>
            )}
            {!loading && data && data.items.length === 0 && (
              <tr>
                <td colSpan={10} className="analytics-table-empty">
                  暂无数据
                </td>
              </tr>
            )}
            {data?.items.map((item) => (
              <tr
                key={item.id}
                className="analytics-table-row"
                onClick={() => onOpenDetail(item.id)}
              >
                <td className="analytics-cell-id">{item.id.slice(0, 8)}...</td>
                <td>{item.username}</td>
                <td>{item.mode === 'config' ? '配置' : '对话'}</td>
                <td>
                  <span
                    className={
                      item.status === 'succeeded'
                        ? 'analytics-badge-success'
                        : item.status === 'failed'
                          ? 'analytics-badge-failure'
                          : 'analytics-badge-pending'
                    }
                  >
                    {item.status === 'queued'
                      ? '队列中'
                      : item.status === 'running'
                        ? '进行中'
                        : item.status === 'succeeded'
                          ? '成功'
                          : '失败'}
                  </span>
                </td>
                <td>{item.provider}</td>
                <td>{item.displayVehicleModel || '-'}</td>
                <td>{formatDuration(item.durationMs)}</td>
                <td>{formatCost(item.costCents)}</td>
                <td>{formatTimestamp(item.createdAt)}</td>
                <td>
                  <button
                    className="analytics-detail-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenDetail(item.id);
                    }}
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

      {/* ---- Pagination ---- */}
      <div className="analytics-pagination">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
        >
          <ChevronLeft size={16} />
          上一页
        </button>
        <span className="analytics-page-indicator">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
        >
          下一页
          <ChevronRight size={16} />
        </button>
        <label className="analytics-page-size">
          每页
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          条
        </label>
      </div>

      {/* ---- Export Button ---- */}
      <div className="analytics-export-section">
        <button className="analytics-export-btn" onClick={handleExport} type="button">
          <Download size={14} />
          导出 CSV
        </button>
      </div>
    </div>
  );
}
