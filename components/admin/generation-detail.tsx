'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type {
  GenerationDetailResponse,
  GenerationProgressStepInfo,
  GenerationRecordItem,
} from '@/lib/types';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type GenerationDetailProps = {
  jobId: string;
  onBack: () => void;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(ts: number | null): string {
  if (ts == null) return '-';
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const MM = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const HH = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const ss = String(d.getSeconds()).padStart(2, '0');
  return `${yyyy}-${MM}-${dd} ${HH}:${mm}:${ss}`;
}

function formatDuration(ms: number | null): string {
  if (ms == null) return '-';
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60_000);
  const seconds = ((ms % 60_000) / 1000).toFixed(1);
  return `${minutes}m ${seconds}s`;
}

function formatCost(cents: number): string {
  if (cents === 0) return '¥0.00';
  if (cents >= 100) {
    return `¥${(cents / 100).toFixed(2)}`;
  }
  return `${cents} cents`;
}

function computeDuration(createdAt: number, completedAt: number | null): number | null {
  if (completedAt == null) return null;
  return completedAt - createdAt;
}

function statusColor(status: string): string {
  switch (status) {
    case 'succeeded':
      return 'var(--green)';
    case 'failed':
      return 'var(--red)';
    case 'running':
      return 'var(--yellow)';
    default:
      return 'var(--muted)';
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'queued':
      return '队列中';
    case 'running':
      return '进行中';
    case 'succeeded':
      return '成功';
    case 'failed':
      return '失败';
    default:
      return status;
  }
}

function modeLabel(mode: string): string {
  return mode === 'config' ? '配置模式' : '对话模式';
}

// ---------------------------------------------------------------------------
// Collapsible JSON Block
// ---------------------------------------------------------------------------

function CollapsibleJsonBlock({
  title,
  data,
}: {
  title: string;
  data: unknown;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="analytics-json-block">
      <button
        className="analytics-json-block-header"
        type="button"
        onClick={() => setOpen((prev) => !prev)}
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span>{title}</span>
      </button>
      {open && (
        <pre className="analytics-json-block-content">
          {typeof data === 'string' ? data : JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Progress Timeline
// ---------------------------------------------------------------------------

function ProgressTimeline({
  steps,
}: {
  steps: GenerationProgressStepInfo[];
}) {
  if (steps.length === 0) {
    return <p style={{ color: 'var(--muted)' }}>无进度数据</p>;
  }

  return (
    <div className="analytics-timeline">
      {steps.map((step, index) => {
        const color = statusColor(step.status);
        const isLast = index === steps.length - 1;

        return (
          <div
            key={step.step}
            className="analytics-timeline-item"
          >
            <div className="analytics-timeline-connector">
              <div
                className="analytics-timeline-dot"
                style={{ backgroundColor: color }}
              />
              {!isLast && (
                <div className="analytics-timeline-line" />
              )}
            </div>
            <div className="analytics-timeline-content">
              <div className="analytics-timeline-label">
                {step.label}
                <span
                  className="analytics-timeline-status"
                  style={{ color }}
                >
                  {statusLabel(step.status)}
                </span>
              </div>
              <div className="analytics-timeline-meta">
                {step.timestamp != null && (
                  <span>
                    <Clock size={12} />
                    {formatTimestamp(step.timestamp)}
                  </span>
                )}
                {step.durationMs != null && (
                  <span>{formatDuration(step.durationMs)}</span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Result Check Card
// ---------------------------------------------------------------------------

function ResultCheckCard({ data }: { data: unknown }) {
  const check = data as {
    passed?: boolean;
    score?: number;
    missingElements?: string[];
    wrongElements?: string[];
    badCaseTags?: string[];
    summary?: string;
    retryPrompt?: string;
  } | null;

  if (!check) {
    return <p style={{ color: 'var(--muted)' }}>无检测结果</p>;
  }

  return (
    <div className="analytics-detail-card">
      <h4>检测结果</h4>
      <div className="analytics-detail-section">
        <div className="analytics-detail-row">
          <span className="analytics-detail-key">通过</span>
          <span style={{ color: check.passed ? 'var(--green)' : 'var(--red)' }}>
            {check.passed ? (
              <><CheckCircle2 size={14} /> 是</>
            ) : (
              <><AlertCircle size={14} /> 否</>
            )}
          </span>
        </div>
        <div className="analytics-detail-row">
          <span className="analytics-detail-key">评分</span>
          <span>{check.score != null ? check.score.toFixed(2) : '-'}</span>
        </div>
        {check.summary && (
          <div className="analytics-detail-row">
            <span className="analytics-detail-key">摘要</span>
            <span>{check.summary}</span>
          </div>
        )}
      </div>
      {check.missingElements && check.missingElements.length > 0 && (
        <div className="analytics-detail-section">
          <h5>缺失元素</h5>
          <div className="analytics-tag-list">
            {check.missingElements.map((el, i) => (
              <span key={i} className="analytics-tag analytics-tag-warn">{el}</span>
            ))}
          </div>
        </div>
      )}
      {check.wrongElements && check.wrongElements.length > 0 && (
        <div className="analytics-detail-section">
          <h5>错误元素</h5>
          <div className="analytics-tag-list">
            {check.wrongElements.map((el, i) => (
              <span key={i} className="analytics-tag analytics-tag-error">{el}</span>
            ))}
          </div>
        </div>
      )}
      {check.badCaseTags && check.badCaseTags.length > 0 && (
        <div className="analytics-detail-section">
          <h5>坏案例标签</h5>
          <div className="analytics-tag-list">
            {check.badCaseTags.map((tag, i) => (
              <span key={i} className="analytics-tag analytics-tag-error">{tag}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Retry Children Table
// ---------------------------------------------------------------------------

function RetryChildrenTable({ children }: { children: GenerationRecordItem[] }) {
  if (children.length === 0) return null;

  return (
    <div className="analytics-detail-card">
      <h4>重试子任务 ({children.length})</h4>
      <table className="analytics-table">
        <thead>
          <tr>
            <th>任务 ID</th>
            <th>用户</th>
            <th>状态</th>
            <th>提供商</th>
            <th>耗时</th>
            <th>费用</th>
            <th>创建时间</th>
          </tr>
        </thead>
        <tbody>
          {children.map((child) => (
            <tr key={child.id}>
              <td className="analytics-cell-id">{child.id.slice(0, 8)}...</td>
              <td>{child.username}</td>
              <td>
                <span
                  className={
                    child.status === 'succeeded'
                      ? 'analytics-badge-success'
                      : child.status === 'failed'
                        ? 'analytics-badge-failure'
                        : 'analytics-badge-pending'
                  }
                >
                  {statusLabel(child.status)}
                </span>
              </td>
              <td>{child.provider}</td>
              <td>{formatDuration(child.durationMs)}</td>
              <td>{formatCost(child.costCents)}</td>
              <td>{formatTimestamp(child.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function GenerationDetail({ jobId, onBack }: GenerationDetailProps) {
  const [data, setData] = useState<GenerationDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // ---- fetch job detail ----
  const fetchDetail = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/generations/${jobId}`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: GenerationDetailResponse = await res.json();
      setData(json);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setData(null);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [jobId]);

  // ---- retry handler ----
  const handleRetry = useCallback(async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      const res = await fetch(`/api/admin/generations/${jobId}/retry`, {
        method: 'POST',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await fetchDetail();
    } catch {
      // silently fail
    } finally {
      setRetrying(false);
    }
  }, [jobId, retrying, fetchDetail]);

  // ---- effect ----
  useEffect(() => {
    fetchDetail();
    return () => {
      abortRef.current?.abort();
    };
  }, [fetchDetail]);

  // ---- render: loading ----
  if (loading) {
    return (
      <div className="analytics-detail-page">
        <button className="analytics-back-btn" type="button" onClick={onBack}>
          <ArrowLeft size={16} />
          返回
        </button>
        <p style={{ color: 'var(--muted)', marginTop: 16 }}>加载中...</p>
      </div>
    );
  }

  // ---- render: no data ----
  if (!data) {
    return (
      <div className="analytics-detail-page">
        <button className="analytics-back-btn" type="button" onClick={onBack}>
          <ArrowLeft size={16} />
          返回
        </button>
        <p style={{ color: 'var(--red)', marginTop: 16 }}>无法加载任务详情</p>
      </div>
    );
  }

  const duration = computeDuration(data.createdAt, data.completedAt);

  return (
    <div className="analytics-detail-page">
      {/* ---- Header ---- */}
      <div className="analytics-detail-header">
        <button className="analytics-back-btn" type="button" onClick={onBack}>
          <ArrowLeft size={16} />
          返回
        </button>
        <h2>
          任务详情
          <span className="analytics-detail-job-id">{data.id}</span>
        </h2>
      </div>

      {/* ---- Basic Info Card ---- */}
      <div className="analytics-detail-card">
        <h4>基本信息</h4>
        <div className="analytics-detail-section">
          <div className="analytics-detail-row">
            <span className="analytics-detail-key">模式</span>
            <span>{modeLabel(data.mode)}</span>
          </div>
          <div className="analytics-detail-row">
            <span className="analytics-detail-key">状态</span>
            <span style={{ color: statusColor(data.status) }}>
              {data.status === 'succeeded' && <CheckCircle2 size={14} />}
              {data.status === 'failed' && <AlertCircle size={14} />}
              {' '}
              {statusLabel(data.status)}
            </span>
          </div>
          <div className="analytics-detail-row">
            <span className="analytics-detail-key">提供商</span>
            <span>{data.provider}</span>
          </div>
          <div className="analytics-detail-row">
            <span className="analytics-detail-key">车辆型号</span>
            <span>{data.displayVehicleModel || '-'}</span>
          </div>
          <div className="analytics-detail-row">
            <span className="analytics-detail-key">用户</span>
            <span>{data.username} ({data.userId.slice(0, 8)}...)</span>
          </div>
          <div className="analytics-detail-row">
            <span className="analytics-detail-key">创建时间</span>
            <span>{formatTimestamp(data.createdAt)}</span>
          </div>
          <div className="analytics-detail-row">
            <span className="analytics-detail-key">完成时间</span>
            <span>{formatTimestamp(data.completedAt)}</span>
          </div>
          <div className="analytics-detail-row">
            <span className="analytics-detail-key">总耗时</span>
            <span>{formatDuration(duration)}</span>
          </div>
          <div className="analytics-detail-row">
            <span className="analytics-detail-key">费用</span>
            <span>{formatCost(data.costCents)}</span>
          </div>
          <div className="analytics-detail-row">
            <span className="analytics-detail-key">用量单位</span>
            <span>{data.usageUnits}</span>
          </div>
          <div className="analytics-detail-row">
            <span className="analytics-detail-key">重试次数</span>
            <span>{data.retryCount}</span>
          </div>
          {data.retryParentId && (
            <div className="analytics-detail-row">
              <span className="analytics-detail-key">父重试任务</span>
              <span>{data.retryParentId}</span>
            </div>
          )}
        </div>
      </div>

      {/* ---- Input Section ---- */}
      <div className="analytics-detail-card">
        <h4>输入</h4>
        <div className="analytics-detail-section">
          {data.sourceImageUrl && (
            <div className="analytics-detail-row">
              <span className="analytics-detail-key">原图预览</span>
              <img
                className="analytics-img-preview"
                src={data.sourceImageUrl}
                alt="Source"
                loading="lazy"
              />
            </div>
          )}
          {data.standardJson != null && (
            <CollapsibleJsonBlock
              title="Standard JSON"
              data={data.standardJson}
            />
          )}
          {data.promptSummary && (
            <CollapsibleJsonBlock
              title="Prompt 摘要"
              data={data.promptSummary}
            />
          )}
        </div>
      </div>

      {/* ---- Progress Timeline ---- */}
      <div className="analytics-detail-card">
        <h4>进度时间线</h4>
        <div className="analytics-detail-section">
          <ProgressTimeline steps={data.progressSteps} />
        </div>
      </div>

      {/* ---- Output Section ---- */}
      <div className="analytics-detail-card">
        <h4>输出</h4>
        <div className="analytics-detail-section">
          {data.resultImageUrl && (
            <div className="analytics-detail-row">
              <span className="analytics-detail-key">结果图预览</span>
              <img
                className="analytics-img-preview"
                src={data.resultImageUrl}
                alt="Result"
                loading="lazy"
              />
            </div>
          )}
          {data.vehicleInfo != null && (
            <CollapsibleJsonBlock
              title="车辆信息"
              data={data.vehicleInfo}
            />
          )}
        </div>
        {data.resultCheck != null && (
          <ResultCheckCard data={data.resultCheck} />
        )}
      </div>

      {/* ---- Error / Failure Section ---- */}
      {data.failureReason && (
        <div className="analytics-alert">
          <AlertCircle size={16} />
          <span>失败原因: {data.failureReason}</span>
        </div>
      )}

      {/* ---- Retry Button ---- */}
      <div className="analytics-detail-actions">
        <button
          className="analytics-retry-btn"
          type="button"
          disabled={retrying}
          onClick={handleRetry}
        >
          <RefreshCw size={14} />
          {retrying ? '重试中...' : '重试任务'}
        </button>
      </div>

      {/* ---- Retry Children ---- */}
      {data.retryChildren && data.retryChildren.length > 0 && (
        <RetryChildrenTable>
          {data.retryChildren}
        </RetryChildrenTable>
      )}
    </div>
  );
}
