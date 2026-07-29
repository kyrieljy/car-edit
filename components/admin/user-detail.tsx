'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Plus,
  X,
  Tag,
  Clock,
  Receipt,
  Image as ImageIcon,
} from 'lucide-react';
import type {
  UserDetailResponse,
  GenerationRecordItem,
  AuditLog,
  EntitlementStatus,
} from '@/lib/types';
import { BarChartCard } from './analytics-charts';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

type UserDetailProps = {
  userId: string;
  onBack: () => void;
  onOpenGenerationDetail: (id: string) => void;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(ts: number): string {
  if (!ts) return '-';
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const MM = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const HH = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}-${MM}-${dd} ${HH}:${mm}`;
}

function formatDate(ts: number): string {
  if (!ts) return '-';
  const d = new Date(ts);
  const yyyy = d.getFullYear();
  const MM = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${MM}-${dd}`;
}

function formatDuration(ms: number | null): string {
  if (ms == null) return '-';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatCost(cents: number): string {
  if (cents > 100) {
    return `¥${(cents / 100).toFixed(2)}`;
  }
  return `${cents} cents`;
}

function formatQuota(value: number | 'unlimited'): string {
  if (value === 'unlimited') return '无限';
  return String(value);
}

// ---------------------------------------------------------------------------
// Tag badge color mapping
// ---------------------------------------------------------------------------

type BadgeColor = 'blue' | 'green' | 'yellow' | 'red' | 'muted';

function planTagColor(plan: string): BadgeColor {
  return 'blue';
}

function activityTagColor(activity: string): BadgeColor {
  const v = activity.toLowerCase();
  if (v === 'high' || v === 'active' || v === '高活跃' || v === '活跃') return 'green';
  if (v === 'medium' || v === '中等' || v === 'normal') return 'yellow';
  if (v === 'low' || v === 'inactive' || v === '低活跃' || v === '沉寂') return 'red';
  return 'muted';
}

function paymentTagColor(payment: string): BadgeColor {
  const v = payment.toLowerCase();
  if (v === 'paid' || v === '已付费' || v === '付费') return 'green';
  if (v === 'unpaid' || v === '未付费' || v === '免费') return 'red';
  return 'muted';
}

function valueTagColor(value: string): BadgeColor {
  const v = value.toLowerCase();
  if (v === 'high' || v === '高价值') return 'yellow';
  if (v === 'medium' || v === '中价值') return 'blue';
  if (v === 'low' || v === '低价值') return 'muted';
  return 'muted';
}

function statusLabel(status: string): string {
  if (status === 'active') return '正常';
  if (status === 'disabled') return '已禁用';
  return status;
}

function statusColor(status: string): BadgeColor {
  if (status === 'active') return 'green';
  if (status === 'disabled') return 'red';
  return 'muted';
}

function roleLabel(role: string): string {
  if (role === 'admin') return '管理员';
  if (role === 'user') return '用户';
  return role;
}

function modeLabel(mode: string): string {
  if (mode === 'config') return '配置';
  if (mode === 'chat') return '对话';
  return mode;
}

function generationStatusLabel(status: string): string {
  if (status === 'queued') return '队列中';
  if (status === 'running') return '进行中';
  if (status === 'succeeded') return '成功';
  if (status === 'failed') return '失败';
  return status;
}

function generationStatusColor(status: string): BadgeColor {
  if (status === 'succeeded') return 'green';
  if (status === 'failed') return 'red';
  if (status === 'running') return 'blue';
  return 'muted';
}

// ---------------------------------------------------------------------------
// Tag badge sub-component
// ---------------------------------------------------------------------------

function TagBadge({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: BadgeColor;
}) {
  return (
    <span className={`analytics-tag-badge analytics-tag-${color}`}>
      <span className="analytics-tag-badge-label">{label}</span>
      <span className="analytics-tag-badge-value">{value}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Info row sub-component
// ---------------------------------------------------------------------------

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="analytics-info-row">
      <span className="analytics-info-label">{label}</span>
      <span className="analytics-info-value">{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function UserDetail({
  userId,
  onBack,
  onOpenGenerationDetail,
}: UserDetailProps) {
  const [data, setData] = useState<UserDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---- tag management state ----
  const [manualTags, setManualTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [tagSaving, setTagSaving] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // ---- fetch user detail ----
  const fetchDetail = useCallback(async () => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: UserDetailResponse = await res.json();
      setData(json);
      setManualTags(json.tags?.manual ?? []);
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError((err as Error).message);
        setData(null);
      }
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [userId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  // ---- update manual tags ----
  const updateManualTags = useCallback(
    async (next: string[]) => {
      setTagSaving(true);
      try {
        const res = await fetch(`/api/admin/users/${userId}/tags`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tags: next }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setManualTags(next);
      } catch {
        // revert on failure by re-syncing from server state
        fetchDetail();
      } finally {
        setTagSaving(false);
      }
    },
    [userId, fetchDetail],
  );

  const handleAddTag = useCallback(() => {
    const trimmed = tagInput.trim();
    if (!trimmed) return;
    if (manualTags.includes(trimmed)) {
      setTagInput('');
      return;
    }
    const next = [...manualTags, trimmed];
    setManualTags(next);
    setTagInput('');
    updateManualTags(next);
  }, [tagInput, manualTags, updateManualTags]);

  const handleRemoveTag = useCallback(
    (tag: string) => {
      const next = manualTags.filter((t) => t !== tag);
      setManualTags(next);
      updateManualTags(next);
    },
    [manualTags, updateManualTags],
  );

  const handleTagInputKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleAddTag();
      }
    },
    [handleAddTag],
  );

  // ---- derived values ----
  const user = data?.user;
  const billing: EntitlementStatus | null = data?.billing ?? null;
  const tags = data?.tags;
  const usageTimeline = data?.usageTimeline ?? [];
  const generations: GenerationRecordItem[] = data?.generations ?? [];
  const generationTotal = data?.generationTotal ?? 0;
  const preferences = data?.preferences;
  const auditLogs: AuditLog[] = data?.auditLogs ?? [];

  return (
    <div className="analytics-detail-page">
      {/* ---- Header: back button + username + tag management ---- */}
      <div className="analytics-detail-header">
        <button
          type="button"
          className="analytics-back-btn"
          onClick={onBack}
        >
          <ArrowLeft size={16} />
          返回
        </button>
        <h2 className="analytics-detail-title">
          {user ? user.username : '用户详情'}
        </h2>
        {tags && (
          <div className="analytics-tag-manage">
            <div className="analytics-tag-badges">
              <TagBadge
                label="套餐"
                value={tags.auto.plan}
                color={planTagColor(tags.auto.plan)}
              />
              <TagBadge
                label="活跃"
                value={tags.auto.activity}
                color={activityTagColor(tags.auto.activity)}
              />
              <TagBadge
                label="付费"
                value={tags.auto.payment}
                color={paymentTagColor(tags.auto.payment)}
              />
              <TagBadge
                label="价值"
                value={tags.auto.value}
                color={valueTagColor(tags.auto.value)}
              />
            </div>
            <div className="analytics-tag-manual">
              {manualTags.map((tag) => (
                <span
                  key={tag}
                  className="analytics-tag-badge analytics-tag-mutable"
                >
                  <Tag size={11} />
                  {tag}
                  <button
                    type="button"
                    className="analytics-tag-remove"
                    onClick={() => handleRemoveTag(tag)}
                    disabled={tagSaving}
                    aria-label={`移除标签 ${tag}`}
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
              <div className="analytics-tag-input-wrap">
                <input
                  type="text"
                  className="analytics-tag-input"
                  placeholder="添加标签"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagInputKeyDown}
                  disabled={tagSaving}
                />
                <button
                  type="button"
                  className="analytics-tag-add-btn"
                  onClick={handleAddTag}
                  disabled={tagSaving || !tagInput.trim()}
                >
                  <Plus size={14} />
                  添加
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ---- Loading / Error states ---- */}
      {loading && !data && (
        <div className="analytics-detail-card">
          <div className="analytics-detail-empty">加载中...</div>
        </div>
      )}
      {error && !data && (
        <div className="analytics-detail-card">
          <div className="analytics-detail-empty">加载失败：{error}</div>
        </div>
      )}

      {data && (
        <>
          {/* ---- Basic Info ---- */}
          <div className="analytics-detail-card">
            <div className="analytics-detail-section">
              <h3 className="analytics-detail-section-title">基本信息</h3>
              <div className="analytics-info-grid">
                <InfoRow label="用户名" value={user?.username ?? '-'} />
                <InfoRow label="姓名" value={user?.name ?? '-'} />
                <InfoRow label="手机号" value={user?.phone || '-'} />
                <InfoRow label="邮箱" value={user?.email || '-'} />
                <InfoRow
                  label="角色"
                  value={
                    <span
                      className={`analytics-tag-badge analytics-tag-${user ? (user.role === 'admin' ? 'yellow' : 'muted') : 'muted'}`}
                    >
                      {user ? roleLabel(user.role) : '-'}
                    </span>
                  }
                />
                <InfoRow label="套餐" value={user?.plan ?? '-'} />
                <InfoRow
                  label="状态"
                  value={
                    <span
                      className={`analytics-tag-badge analytics-tag-${user ? statusColor(user.status) : 'muted'}`}
                    >
                      {user ? statusLabel(user.status) : '-'}
                    </span>
                  }
                />
                <InfoRow
                  label="注册时间"
                  value={user ? formatTimestamp(user.createdAt) : '-'}
                />
                <InfoRow
                  label="最后登录"
                  value={user ? formatTimestamp(user.lastLoginAt) : '-'}
                />
              </div>
            </div>
          </div>

          {/* ---- Billing Info ---- */}
          {billing && (
            <div className="analytics-detail-card">
              <div className="analytics-detail-section">
                <h3 className="analytics-detail-section-title">
                  <Receipt size={15} />
                  账单与额度
                </h3>
                <div className="analytics-info-grid">
                  <InfoRow
                    label="套餐"
                    value={billing.plan?.label ?? user?.plan ?? '-'}
                  />
                  <InfoRow
                    label="配置额度（已用）"
                    value={String(billing.configUsed)}
                  />
                  <InfoRow
                    label="配置额度（剩余）"
                    value={formatQuota(billing.configRemaining)}
                  />
                  <InfoRow
                    label="今日对话（已用）"
                    value={String(billing.chatUsedToday)}
                  />
                  <InfoRow
                    label="今日对话（剩余）"
                    value={formatQuota(billing.chatRemainingToday)}
                  />
                  <InfoRow
                    label="对话功能"
                    value={
                      billing.chatEnabled ? (
                        <span className="analytics-tag-badge analytics-tag-green">已开启</span>
                      ) : (
                        <span className="analytics-tag-badge analytics-tag-red">未开启</span>
                      )
                    }
                  />
                  {billing.subscription && (
                    <>
                      <InfoRow
                        label="订阅状态"
                        value={billing.subscription.status}
                      />
                      <InfoRow
                        label="订阅到期"
                        value={formatDate(billing.subscription.currentPeriodEnd)}
                      />
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ---- Usage Timeline ---- */}
          <div className="analytics-detail-card">
            <div className="analytics-detail-section">
              <h3 className="analytics-detail-section-title">
                <Clock size={15} />
                用量时间线
              </h3>
              {usageTimeline.length === 0 ? (
                <div className="analytics-detail-empty">暂无用量记录</div>
              ) : (
                <div className="analytics-timeline">
                  {usageTimeline.map((entry) => (
                    <div
                      key={entry.id}
                      className={`analytics-timeline-item analytics-timeline-${entry.type}`}
                    >
                      <div className="analytics-timeline-dot" />
                      <div className="analytics-timeline-content">
                        <div className="analytics-timeline-desc">
                          {entry.description}
                        </div>
                        <div className="analytics-timeline-meta">
                          <span
                            className={`analytics-timeline-amount ${entry.type === 'consumption' ? 'is-consumption' : 'is-adjustment'}`}
                          >
                            {entry.type === 'consumption' ? '-' : '+'}
                            {Math.abs(entry.amount)}
                          </span>
                          <span className="analytics-timeline-time">
                            {formatTimestamp(entry.createdAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ---- Generation Records ---- */}
          <div className="analytics-detail-card">
            <div className="analytics-detail-section">
              <div className="analytics-detail-section-head">
                <h3 className="analytics-detail-section-title">
                  <ImageIcon size={15} />
                  生成记录
                </h3>
                <span className="analytics-detail-section-count">
                  共 {generationTotal} 条记录
                </span>
              </div>
              {generations.length === 0 ? (
                <div className="analytics-detail-empty">暂无生成记录</div>
              ) : (
                <div className="analytics-table-wrapper">
                  <table className="analytics-table">
                    <thead>
                      <tr>
                        <th>任务 ID</th>
                        <th>模式</th>
                        <th>状态</th>
                        <th>费用</th>
                        <th>创建时间</th>
                        <th>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {generations.map((item) => (
                        <tr key={item.id} className="analytics-table-row">
                          <td className="analytics-cell-id">
                            {item.id.slice(0, 8)}...
                          </td>
                          <td>{modeLabel(item.mode)}</td>
                          <td>
                            <span
                              className={`analytics-tag-badge analytics-tag-${generationStatusColor(item.status)}`}
                            >
                              {generationStatusLabel(item.status)}
                            </span>
                          </td>
                          <td>{formatCost(item.costCents)}</td>
                          <td>{formatTimestamp(item.createdAt)}</td>
                          <td>
                            <button
                              type="button"
                              className="analytics-detail-btn"
                              onClick={() => onOpenGenerationDetail(item.id)}
                            >
                              详情
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* ---- Preferences ---- */}
          {preferences && (
            <div className="analytics-detail-card">
              <div className="analytics-detail-section">
                <h3 className="analytics-detail-section-title">
                  <Tag size={15} />
                  用户偏好
                </h3>
                <div className="analytics-preferences-grid">
                  <BarChartCard
                    title="热门车辆 TOP"
                    data={preferences.topVehicles ?? []}
                    height={260}
                    color="#614b00"
                  />
                  <BarChartCard
                    title="热门零件类别 TOP"
                    data={preferences.topPartCategories ?? []}
                    height={260}
                    color="#3a82ff"
                  />
                  <BarChartCard
                    title="热门车漆 TOP"
                    data={preferences.topPaints ?? []}
                    height={260}
                    color="#48d18d"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ---- Audit Logs ---- */}
          <div className="analytics-detail-card">
            <div className="analytics-detail-section">
              <h3 className="analytics-detail-section-title">
                <Clock size={15} />
                审计日志
              </h3>
              {auditLogs.length === 0 ? (
                <div className="analytics-detail-empty">暂无审计日志</div>
              ) : (
                <div className="analytics-audit-list">
                  {auditLogs.map((log) => (
                    <div key={log.id} className="analytics-audit-item">
                      <div className="analytics-audit-head">
                        <span className="analytics-audit-action">
                          {log.action}
                        </span>
                        <span className="analytics-audit-time">
                          {formatTimestamp(log.createdAt)}
                        </span>
                      </div>
                      {log.metadata && (
                        <pre className="analytics-audit-meta">
                          {formatMetadata(log.metadata)}
                        </pre>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Metadata formatter
// ---------------------------------------------------------------------------

function formatMetadata(metadata: string): string {
  if (!metadata) return '';
  try {
    const parsed = JSON.parse(metadata);
    return JSON.stringify(parsed, null, 2);
  } catch {
    return metadata;
  }
}
