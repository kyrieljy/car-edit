"use client"

import type React from "react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"
import {
  Activity,
  ArrowDown,
  ArrowUp,
  BadgeCheck,
  BarChart3,
  ChevronDown,
  ChevronsUpDown,
  Database,
  Eye,
  Grid2X2,
  Globe,
  ImageIcon,
  KeyRound,
  ListPlus,
  LogOut,
  Plus,
  Receipt,
  RefreshCw,
  ServerCog,
  Settings,
  ShieldCheck,
  Trash2,
  TrendingUp,
  UploadCloud,
  Users,
  UserCog,
  Wallet,
  Wrench,
  X,
  Zap,
  Loader2,
} from "lucide-react"
import { WorkflowDesigner } from "@/components/workflow-designer"
import GenerationRecords from "@/components/admin/generation-records"
import GenerationDetail from "@/components/admin/generation-detail"
import UserAnalytics from "@/components/admin/user-analytics"
import UserDetail from "@/components/admin/user-detail"
import FailureAnalytics from "@/components/admin/failure-analytics"
import OrderAnalytics from "@/components/admin/order-analytics"
import QuotaAnalytics from "@/components/admin/quota-analytics"
import HealthAnalytics from "@/components/admin/health-analytics"
import QualityAnalytics from "@/components/admin/quality-analytics"
import MessageBroadcaster from "@/components/admin/message-broadcaster"
import ReportGenerator from "@/components/admin/report-generator"
import { buildGenerationPrompt } from "@/lib/generation-core"
import type {
  AdminSummary,
  AccountAvatarPreset,
  AdminPaymentOrder,
  AuthUser,
  GenerationJob,
  GenerationStandardJson,
  GuardrailConfig,
  MembershipPlan,
  PartAsset,
  PartColorPolicy,
  PartAssetReference,
  PartBrand,
  PartCategory,
  PartReferenceRole,
  PromptTemplate,
  PromptTemplateScope,
  ProviderCapability,
  ProviderId,
  SiteConfig,
  WorkflowConfig,
  WorkflowNodeConfig,
} from "@/lib/types"

type AdminTab = "dashboard" | "assets" | "avatars" | "providers" | "prompts" | "workflows" | "guardrail" | "site-config" | "plans" | "cost-view" | "badcases" | "users" | "profiles" | "audit" | "orders" | "analytics-generations" | "analytics-users" | "analytics-failures" | "analytics-orders" | "analytics-quota" | "analytics-health" | "analytics-quality" | "ops-messages" | "ops-reports"
type AdminView = { type: "tab"; tab: AdminTab } | { type: "generation-detail"; jobId: string } | { type: "user-detail"; userId: string }
type AdminToast = { type: "success" | "error"; message: string } | null
type NotifyAdmin = (type: "success" | "error", message: string) => void

type NavItem = { id: AdminTab; label: string; sub: string; icon: React.ReactNode }

type NavGroup = {
  id: string
  label: string
  icon: React.ReactNode
  items: NavItem[]
}

// Standalone top-level item (not part of any group)
const dashboardItem: NavItem = {
  id: "dashboard",
  label: "数据看板",
  sub: "指标 / 状态 / 趋势",
  icon: <Database size={20} />,
}

// 5 groups by business function, 22 items total + 1 standalone = 23
const navGroups: NavGroup[] = [
  {
    id: "system-config",
    label: "系统配置",
    icon: <Settings size={18} />,
    items: [
      { id: "assets", label: "资源库", sub: "类型 / 品牌 / 配件", icon: <Grid2X2 size={20} /> },
      { id: "avatars", label: "头像预设", sub: "账号头像 / 排序 / 状态", icon: <ImageIcon size={20} /> },
      { id: "providers", label: "模型 API", sub: "全局模型接口", icon: <ServerCog size={20} /> },
      { id: "prompts", label: "提示词", sub: "模板 / 负面词 / 重试", icon: <ListPlus size={20} /> },
      { id: "workflows", label: "Workflow", sub: "配置 / 对话 / 检查", icon: <Activity size={20} /> },
      { id: "guardrail", label: "风控 SOP", sub: "检测 / 限制 / 追问", icon: <ShieldCheck size={20} /> },
      { id: "site-config", label: "域名配置", sub: "公网域名 / 生图链接", icon: <Globe size={20} /> },
    ],
  },
  {
    id: "business-ops",
    label: "商业运营",
    icon: <Wallet size={18} />,
    items: [
      { id: "plans", label: "会员配置", sub: "套餐 / 额度 / 价格", icon: <BadgeCheck size={20} /> },
      { id: "cost-view", label: "成本查看", sub: "供应商管理后台", icon: <Eye size={20} /> },
      { id: "orders", label: "订单", sub: "支付与订阅", icon: <Receipt size={20} /> },
    ],
  },
  {
    id: "user-security",
    label: "用户与安全",
    icon: <UserCog size={18} />,
    items: [
      { id: "users", label: "用户管理", sub: "账号 / 角色 / 套餐", icon: <Users size={20} /> },
      { id: "profiles", label: "用户画像", sub: "车辆 / 配件 / 偏好", icon: <Users size={20} /> },
      { id: "audit", label: "审计日志", sub: "后台操作 / 安全", icon: <Activity size={20} /> },
    ],
  },
  {
    id: "analytics",
    label: "数据分析",
    icon: <BarChart3 size={18} />,
    items: [
      { id: "analytics-generations", label: "生成记录", sub: "筛选 / 趋势 / 详情", icon: <BarChart3 size={20} /> },
      { id: "analytics-users", label: "用户分析", sub: "注册 / 活跃 / 留存", icon: <TrendingUp size={20} /> },
      { id: "analytics-failures", label: "失败分析", sub: "失败率 / 归因 / 排名", icon: <Activity size={20} /> },
      { id: "analytics-orders", label: "订单分析", sub: "收入 / 转化 / 续费", icon: <Receipt size={20} /> },
      { id: "analytics-quota", label: "额度监控", sub: "消耗 / 余额 / 告警", icon: <Database size={20} /> },
      { id: "analytics-health", label: "系统健康", sub: "成功率 / 延迟 / 队列", icon: <Activity size={20} /> },
      { id: "analytics-quality", label: "质量分析", sub: "评分 / Bad Case", icon: <BarChart3 size={20} /> },
      { id: "badcases", label: "失败样本", sub: "质量检查 / 失败样本", icon: <Eye size={20} /> },
    ],
  },
  {
    id: "ops-tools",
    label: "运维工具",
    icon: <Wrench size={18} />,
    items: [
      { id: "ops-messages", label: "消息推送", sub: "广播 / 筛选", icon: <Users size={20} /> },
      { id: "ops-reports", label: "报表导出", sub: "日报 / 周报 / 月报", icon: <Receipt size={20} /> },
    ],
  },
]

function findGroupIdByTab(tab: AdminTab): string | null {
  for (const group of navGroups) {
    if (group.items.some((item) => item.id === tab)) {
      return group.id
    }
  }
  return null
}

function adminTabTitle(tab: AdminTab) {
  return {
    dashboard: "数据看板",
    assets: "资源库管理",
    avatars: "头像预设",
    providers: "模型 API 配置",
    prompts: "提示词管理",
    workflows: "Workflow 管理",
    guardrail: "风控 SOP 配置",
    "site-config": "域名配置",
    plans: "会员配置",
    "cost-view": "成本查看",
    badcases: "失败样本记录",
    "analytics-generations": "生成记录分析",
    "analytics-users": "用户分析",
    "analytics-failures": "失败记录分析",
    "analytics-orders": "订单收入分析",
    "analytics-quota": "额度消耗监控",
    "analytics-health": "系统健康监控",
    "analytics-quality": "内容质量分析",
    "ops-messages": "消息推送",
    "ops-reports": "报表导出",
    users: "用户管理",
    profiles: "用户画像",
    orders: "订单管理",
    audit: "审计日志",
  }[tab]
}

type SubcategoryConfigEntry = {
  id: string
  labelZh: string
  labelEn: string
  sortOrder: number
  assets: Array<{ assetId: string; childLabelZh: string; childLabelEn: string }>
}

function SubcategoryConfigEditor({ config, onChange, categoryAssets }: {
  config: SubcategoryConfigEntry[]
  onChange: (config: SubcategoryConfigEntry[]) => void
  categoryAssets: Array<{ id: string; model?: string; brand?: string }>
}) {
  const addGroup = () => {
    onChange([...config, { id: "", labelZh: "", labelEn: "", sortOrder: config.length, assets: [] }])
  }
  const updateGroup = (index: number, patch: Partial<SubcategoryConfigEntry>) => {
    onChange(config.map((group, i) => (i === index ? { ...group, ...patch } : group)))
  }
  const removeGroup = (index: number) => {
    onChange(config.filter((_, i) => i !== index))
  }
  const moveGroup = (index: number, direction: -1 | 1) => {
    const target = index + direction
    if (target < 0 || target >= config.length) return
    const next = [...config]
    const temp = next[index]
    next[index] = next[target]
    next[target] = temp
    onChange(next.map((group, i) => ({ ...group, sortOrder: i })))
  }
  const addAsset = (groupIndex: number) => {
    const firstAsset = categoryAssets[0]
    onChange(config.map((group, i) => (i === groupIndex ? { ...group, assets: [...group.assets, { assetId: firstAsset?.id ?? "", childLabelZh: "", childLabelEn: "" }] } : group)))
  }
  const updateAsset = (groupIndex: number, assetIndex: number, patch: Partial<{ assetId: string; childLabelZh: string; childLabelEn: string }>) => {
    onChange(config.map((group, i) => (i === groupIndex ? { ...group, assets: group.assets.map((asset, j) => (j === assetIndex ? { ...asset, ...patch } : asset)) } : group)))
  }
  const removeAsset = (groupIndex: number, assetIndex: number) => {
    onChange(config.map((group, i) => (i === groupIndex ? { ...group, assets: group.assets.filter((_, j) => j !== assetIndex) } : group)))
  }

  return (
    <div className="subcategory-config-editor">
      <small className="admin-form-hint">细分类选项：定义分组及其关联配件</small>
      {config.map((group, groupIndex) => (
        <div key={groupIndex} className="subcategory-group-card">
          <div className="subcategory-group-header">
            <input value={group.labelZh} onChange={(event) => updateGroup(groupIndex, { labelZh: event.target.value })} placeholder="组中文名（如：单边单出）" />
            <div className="subcategory-group-actions">
              <button type="button" onClick={() => moveGroup(groupIndex, -1)} disabled={groupIndex === 0} aria-label="上移">
                <ArrowUp size={14} />
              </button>
              <button type="button" onClick={() => moveGroup(groupIndex, 1)} disabled={groupIndex === config.length - 1} aria-label="下移">
                <ArrowDown size={14} />
              </button>
              <button type="button" className="icon-danger" onClick={() => removeGroup(groupIndex)} aria-label="删除分组">
                <Trash2 size={14} />
              </button>
            </div>
          </div>
          <div className="subcategory-group-fields">
            <input value={group.id} onChange={(event) => updateGroup(groupIndex, { id: event.target.value })} placeholder="组 ID（如：single-side-single）" />
            <input value={group.labelEn} onChange={(event) => updateGroup(groupIndex, { labelEn: event.target.value })} placeholder="组英文名（如：Single side single）" />
          </div>
          <div className="subcategory-assets">
            {group.assets.map((asset, assetIndex) => (
              <div key={assetIndex} className="subcategory-asset-row">
                <select value={asset.assetId} onChange={(event) => updateAsset(groupIndex, assetIndex, { assetId: event.target.value })}>
                  {categoryAssets.map((catAsset) => (
                    <option key={catAsset.id} value={catAsset.id}>
                      {catAsset.id}{catAsset.brand || catAsset.model ? ` (${[catAsset.brand, catAsset.model].filter(Boolean).join(" ")})` : ""}
                    </option>
                  ))}
                </select>
                <input value={asset.childLabelZh} onChange={(event) => updateAsset(groupIndex, assetIndex, { childLabelZh: event.target.value })} placeholder="子标签中文（如：左）" />
                <input value={asset.childLabelEn} onChange={(event) => updateAsset(groupIndex, assetIndex, { childLabelEn: event.target.value })} placeholder="子标签英文（如：Left）" />
                <button type="button" className="icon-danger" onClick={() => removeAsset(groupIndex, assetIndex)} aria-label="删除配件">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            <button type="button" className="subcategory-add-asset" onClick={() => addAsset(groupIndex)}>
              <Plus size={14} />
              添加配件
            </button>
          </div>
        </div>
      ))}
      <button type="button" className="subcategory-add-group" onClick={addGroup}>
        <Plus size={14} />
        添加分组
      </button>
    </div>
  )
}

export function AdminConsole() {
  const [admin, setAdmin] = useState<AuthUser | null>(null)
  const [summary, setSummary] = useState<AdminSummary | null>(null)
  const [view, setView] = useState<AdminView>({ type: "tab", tab: "dashboard" })
  const [identifier, setIdentifier] = useState("admin")
  const [password, setPassword] = useState("")
  const [adminCode, setAdminCode] = useState("")
  const [notice, setNotice] = useState("")
  const [toast, setToast] = useState<AdminToast>(null)
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(navGroups[0].id)

  const tab = view.type === "tab" ? view.tab : null

  const openTab = useCallback((t: AdminTab) => {
    setView({ type: "tab", tab: t })
    const groupId = findGroupIdByTab(t)
    if (groupId) setExpandedGroupId(groupId)
  }, [])

  const toggleGroup = useCallback((groupId: string) => {
    setExpandedGroupId((prev) => (prev === groupId ? null : groupId))
  }, [])

  const openGenerationDetail = useCallback((jobId: string) => {
    setView({ type: "generation-detail", jobId })
  }, [])

  const openUserDetail = useCallback((userId: string) => {
    setView({ type: "user-detail", userId })
  }, [])

  const goBack = useCallback(() => {
    setView({ type: "tab", tab: "dashboard" })
  }, [])

  const notify = useCallback<NotifyAdmin>((type, message) => {
    setToast({ type, message })
  }, [])

  const loadSummary = useCallback(async () => {
    const response = await fetch("/api/admin/summary")
    if (response.status === 401) {
      setAdmin(null)
      setSummary(null)
      return
    }
    if (!response.ok) {
      setNotice("后台数据加载失败")
      return
    }
    setSummary(await response.json())
    setNotice("")
  }, [])

  const checkSession = useCallback(async () => {
    const response = await fetch("/api/auth/me")
    if (!response.ok) return
    const body = (await response.json()) as { user?: AuthUser }
    if (body.user?.role === "admin") {
      setAdmin(body.user)
      await loadSummary()
    }
  }, [loadSummary])

  useEffect(() => {
    void checkSession()
  }, [checkSession])

  const sendAdminCode = async () => {
    const response = await fetch("/api/auth/send-code", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, password, purpose: "admin" }),
    })
    const body = (await response.json().catch(() => ({}))) as { error?: string; devCode?: string }
    if (!response.ok) {
      setNotice(body.error || "验证码发送失败")
      return
    }
    if (body.devCode) {
      setAdminCode(body.devCode)
      setNotice("验证码已自动回写（开发模式）")
    } else {
      setNotice("管理员验证码已发送，请查收短信")
    }
  }

  const login = async () => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "password", identifier, password, adminCode }),
    })
    const body = await response.json()
    if (!response.ok) {
      setNotice(body.requireAdminCode ? "请输入管理员手机号验证码" : body.error || "登录失败")
      return
    }
    setAdmin(body.user)
    await loadSummary()
  }

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" })
    setAdmin(null)
    setSummary(null)
  }

  if (!admin) {
    return (
      <main className="admin-shell admin-clinical login-shell">
        <section className="clinical-login">
          <ClinicalBrand />
          <div className="clinical-login-copy">
            <span className="clinical-label">管理员控制台</span>
            <h1>改装效果管理后台</h1>
            <p>管理员登录需要账号密码和手机号验证码。默认管理员手机号：+86 18928268686 / +86 16698604646。</p>
          </div>
          <label className="clinical-field">
            <span>账号</span>
            <input value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="admin" />
          </label>
          <label className="clinical-field">
            <span>密码</span>
            <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Admin@1234" />
          </label>
          <label className="clinical-field code-field">
            <span>手机号验证码</span>
            <div>
              <input value={adminCode} onChange={(event) => setAdminCode(event.target.value)} placeholder="验证码" />
              <button type="button" onClick={sendAdminCode}>
                获取验证码
              </button>
            </div>
          </label>
          <button className="clinical-primary" onClick={login}>
            <KeyRound size={16} />
            登录后台
          </button>
          {notice && <small className="clinical-notice">{notice}</small>}
        </section>
      </main>
    )
  }

  if (!summary) {
    return (
      <main className="admin-shell admin-clinical loading-shell">
        <div className="clinical-loading">
          <Database size={18} />
          <span>正在加载后台数据...</span>
        </div>
      </main>
    )
  }

  return (
    <main className="admin-shell admin-clinical">
      <aside className="admin-sidebar">
        <ClinicalBrand />
        <nav>
          {/* Standalone top-level item: dashboard */}
          <button
            className={`nav-standalone${tab === "dashboard" ? " selected" : ""}`}
            onClick={() => openTab(dashboardItem.id)}
            title={dashboardItem.label}
          >
            <span className="nav-glyph">{dashboardItem.icon}</span>
            <span className="nav-copy">
              <strong>{dashboardItem.label}</strong>
              <em>{dashboardItem.sub}</em>
            </span>
          </button>

          <div className="nav-divider" />

          {/* Grouped nav items with accordion */}
          {navGroups.map((group) => (
            <div key={group.id} className="nav-group">
              <button
                className={`nav-group-header${expandedGroupId === group.id ? " expanded" : ""}`}
                onClick={() => toggleGroup(group.id)}
              >
                <span className="nav-group-icon">{group.icon}</span>
                <span className="nav-group-label">{group.label}</span>
                <span className="nav-group-count">{group.items.length}</span>
                <ChevronDown
                  size={14}
                  className="nav-group-chevron"
                  data-expanded={expandedGroupId === group.id}
                />
              </button>
              {expandedGroupId === group.id && (
                <div className="nav-group-items">
                  {group.items.map((item) => (
                    <button
                      key={item.id}
                      className={tab === item.id ? "selected" : ""}
                      onClick={() => openTab(item.id)}
                      title={item.label}
                    >
                      <span className="nav-glyph">{item.icon}</span>
                      <span className="nav-copy">
                        <strong>{item.label}</strong>
                        <em>{item.sub}</em>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
        <div className="admin-db-card">
          <div className="clinical-status-title">
            <span />
            <strong>系统状态</strong>
          </div>
          <StatusRow label="数据库" value="SQLite" />
          <StatusRow label="当前账号" value={admin.username || admin.name} />
          <StatusRow label="权限" value="管理员" accent />
        </div>
      </aside>

      <section className="admin-main">
        <header className="admin-topbar">
          <div className="clinical-breadcrumb">
            <span>AI CONSOLE</span>
            <span>/</span>
            <strong>
              {view.type === "generation-detail"
                ? "生成详情"
                : view.type === "user-detail"
                  ? "用户详情"
                  : adminTabTitle(tab ?? "dashboard")}
            </strong>
          </div>
          <div className="clinical-userbar">
            <span className="live-dot" />
            <span>LIVE</span>
            <div>
              <strong>{admin.username || "admin"}</strong>
              <small>管理员</small>
            </div>
            <button onClick={() => void loadSummary()} aria-label="刷新">
              <RefreshCw size={16} />
            </button>
            <a href="/" aria-label="返回前台">
              <Activity size={16} />
            </a>
            <button onClick={logout} aria-label="退出">
              <LogOut size={16} />
            </button>
          </div>
        </header>

        <div className="admin-content">
          {view.type === "generation-detail" ? (
            <>
              <section className="clinical-title">
                <span className="clinical-label">生成任务</span>
                <h1>生成详情</h1>
              </section>
              <GenerationDetail jobId={view.jobId} onBack={goBack} />
            </>
          ) : view.type === "user-detail" ? (
            <>
              <section className="clinical-title">
                <span className="clinical-label">用户管理</span>
                <h1>用户详情</h1>
              </section>
              <UserDetail
                userId={view.userId}
                onBack={goBack}
                onOpenGenerationDetail={openGenerationDetail}
              />
            </>
          ) : (
            <>
              <section className="clinical-title">
                <span className="clinical-label">后台模块</span>
                <h1>{adminTabTitle(tab ?? "dashboard")}</h1>
              </section>

              {tab === "dashboard" && <DashboardPanel summary={summary} />}
              {tab === "assets" && (
                <>
                  <AssetManagerV2 summary={summary} onChanged={() => void loadSummary()} notify={notify} />
                  <ClassicPaintManager summary={summary} onChanged={() => void loadSummary()} notify={notify} />
                </>
              )}
              {tab === "avatars" && <AvatarPresetManager summary={summary} onChanged={() => void loadSummary()} notify={notify} />}
              {tab === "providers" && <ProviderManagerV3 summary={summary} onChanged={() => void loadSummary()} notify={notify} />}
              {tab === "prompts" && <PromptTemplateManagerV2 summary={summary} onChanged={() => void loadSummary()} notify={notify} />}
              {tab === "workflows" && <WorkflowDesigner summary={summary} onChanged={() => void loadSummary()} notify={notify} />}
              {tab === "guardrail" && <GuardrailManager summary={summary} onChanged={() => void loadSummary()} />}
              {tab === "site-config" && <DomainConfigManager summary={summary} onChanged={() => void loadSummary()} notify={notify} />}
              {tab === "plans" && <PlanManagerV2 summary={summary} onChanged={() => void loadSummary()} notify={notify} />}
              {tab === "cost-view" && <CostViewPanel summary={summary} />}
              {tab === "badcases" && <BadCaseOpsTable summary={summary} />}
              {tab === "analytics-generations" && (
                <GenerationRecords onOpenDetail={openGenerationDetail} />
              )}
              {tab === "analytics-users" && (
                <UserAnalytics onOpenUserDetail={openUserDetail} />
              )}
              {tab === "analytics-failures" && <FailureAnalytics />}
              {tab === "analytics-orders" && <OrderAnalytics />}
              {tab === "analytics-quota" && <QuotaAnalytics />}
              {tab === "analytics-health" && <HealthAnalytics />}
              {tab === "analytics-quality" && <QualityAnalytics />}
              {tab === "ops-messages" && <MessageBroadcaster />}
              {tab === "ops-reports" && <ReportGenerator />}
              {tab === "users" && (
                <>
                  <UsersOpsTable summary={summary} onChanged={() => void loadSummary()} notify={notify} onOpenUserDetail={openUserDetail} />
                  <SmsRecordsTable summary={summary} />
                </>
              )}
              {tab === "profiles" && <UserProfilesOpsTable summary={summary} />}
              {tab === "orders" && <AdminOrdersTable />}
              {tab === "audit" && <AuditOpsTable summary={summary} />}
              {notice && <div className="notice admin-notice">{notice}</div>}
            </>
          )}
        </div>
        {toast && <AdminToastOverlayV2 toast={toast} onClose={() => setToast(null)} />}
      </section>
    </main>
  )
}

function ClinicalBrand() {
  return (
    <a className="brand-row admin-brand" href="/">
      <span className="brand-symbol" aria-hidden="true">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M22 12h-4l-3 8L9 4l-3 8H2" />
        </svg>
      </span>
      <div>
        <strong>MODLAB</strong>
        <small>改装效果控制台</small>
      </div>
    </a>
  )
}

function StatusRow({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="status-row">
      <span>{label}</span>
      <strong className={accent ? "accent" : ""}>{value}</strong>
    </div>
  )
}

function Stat({ label, value, delta, progress }: { label: string; value: number; delta: string; progress: number }) {
  return (
    <div className="stat-card">
      <span>{label}</span>
      <div>
        <strong>{value}</strong>
        <em>{delta}</em>
      </div>
      <i>
        <b style={{ width: `${progress}%` }} />
      </i>
    </div>
  )
}

function DashboardPanel({ summary }: { summary: AdminSummary }) {
  const activeProviderCount = summary.providers.filter((provider) => provider.enabled).length
  const activePlanCount = summary.plans.filter((plan) => plan.active).length
  return (
    <section className="dashboard-panel">
      <div className="stat-row">
        <Stat label="用户" value={summary.stats.users} delta="+2" progress={58} />
        <Stat label="启用配件" value={summary.stats.activeAssets} delta="+10" progress={76} />
        <Stat label="生成记录" value={summary.stats.generations} delta="+1" progress={48} />
      </div>
      <div className="dashboard-grid">
        <article className="admin-panel dashboard-card">
          <PanelHeading label="模型接口" title="模型接口状态" count={`${activeProviderCount} 个启用`} />
          <div className="dashboard-list">
            {summary.providers.map((provider) => (
              <StatusRow key={provider.id} label={provider.label} value={provider.enabled ? "启用" : "停用"} accent={provider.enabled} />
            ))}
          </div>
        </article>
        <article className="admin-panel dashboard-card">
          <PanelHeading label="WORKFLOW" title="生图流程状态" count={`${summary.workflows.length} 个流程`} />
          <div className="dashboard-list">
            {summary.workflows.map((workflow) => (
              <StatusRow key={workflow.id} label={workflow.mode === "config" ? "配置模式" : "对话模式"} value={workflow.enabled ? "启用" : "停用"} accent={workflow.enabled} />
            ))}
          </div>
        </article>
        <article className="admin-panel dashboard-card">
          <PanelHeading label="MEMBERSHIP" title="会员套餐" count={`${activePlanCount} 个启用`} />
          <div className="dashboard-list">
            {summary.plans.map((plan) => (
              <StatusRow key={plan.id} label={plan.label} value={`¥${(plan.priceCents / 100).toFixed(2)}`} accent={plan.active} />
            ))}
          </div>
        </article>
      </div>
    </section>
  )
}

function PanelHeading({ label, title, count }: { label: string; title: string; count?: string }) {
  return (
    <div className="clinical-panel-heading">
      <div>
        <span className="clinical-label">{label}</span>
        <h2>{title}</h2>
      </div>
      {count && <strong>{count}</strong>}
    </div>
  )
}

function AdminToastOverlayV2({ toast, onClose }: { toast: NonNullable<AdminToast>; onClose: () => void }) {
  return (
    <div className="admin-toast-overlay" role="alert" aria-live="assertive">
      <div className={toast.type === "success" ? "admin-toast-card success" : "admin-toast-card error"}>
        <span className="admin-toast-icon">{toast.type === "success" ? "\u2713" : "\u00d7"}</span>
        <strong>{toast.type === "success" ? "操作成功" : "操作失败"}</strong>
        <p>{toast.message}</p>
        <button type="button" onClick={onClose}>
          关闭
        </button>
      </div>
    </div>
  )
}

async function readAdminError(response: Response, fallback: string) {
  const body = await response.json().catch(() => ({}))
  return typeof body.error === "string" ? body.error : fallback
}

function moveIdBefore(ids: string[], draggedId: string, targetId: string) {
  if (!draggedId || !targetId || draggedId === targetId) return null
  const next = [...ids]
  const from = next.indexOf(draggedId)
  const to = next.indexOf(targetId)
  if (from < 0 || to < 0) return null
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

function moveIdToIndex(ids: string[], draggedId: string, targetIndex: number) {
  if (!draggedId) return null
  const withoutDragged = ids.filter((id) => id !== draggedId)
  if (withoutDragged.length === ids.length) return null
  const next = [...withoutDragged]
  next.splice(Math.max(0, Math.min(targetIndex, next.length)), 0, draggedId)
  return next
}

function orderItemsByPreview<T extends { id: string }>(items: T[], previewOrder: string[] | null) {
  if (!previewOrder) return items
  const orderIndex = new Map(previewOrder.map((id, index) => [id, index]))
  return [...items].sort((left, right) => (orderIndex.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (orderIndex.get(right.id) ?? Number.MAX_SAFE_INTEGER))
}

type AssetReferenceDraft = Pick<PartAssetReference, "url" | "role" | "view" | "priority" | "promptHint" | "uploadToModel" | "active">

const partColorPolicyOptions: Array<{ id: PartColorPolicy; label: string; description: string }> = [
  { id: "part_reference_color", label: "参考图颜色", description: "跟随配件参考图材质和颜色。" },
  { id: "body_color", label: "与车同色", description: "配件外露漆面跟随车身颜色。" },
  { id: "exposed_carbon", label: "裸碳", description: "只在该配件上显示碳纤维纹理。" },
]

const referenceRoleOptions: PartReferenceRole[] = [
  "full_part_reference",
  "shape_reference",
  "install_context",
  "material_reference",
  "color_reference",
  "avoid_upload",
]

function defaultColorPolicyForCategory(categoryId: string): PartColorPolicy {
  return categoryId === "hood" ? "body_color" : "part_reference_color"
}

function defaultAllowedColorPoliciesForCategory(categoryId: string): PartColorPolicy[] {
  return categoryId === "hood" ? ["body_color", "exposed_carbon"] : [defaultColorPolicyForCategory(categoryId)]
}

const categoryReferenceGuides: Record<string, string[]> = {
  wheels: ["side_full_vehicle", "wheel_closeup", "product_front"],
  calipers: ["side_full_vehicle", "wheel_closeup", "product_front"],
  "rear-wing": ["rear_three_quarter_installed", "rear_full_installed", "side_rear_installed"],
  spoiler: ["rear_three_quarter_installed", "rear_full_installed", "side_rear_installed"],
  "front-bumper": ["front_three_quarter_installed", "front_full_installed", "side_front_installed"],
  exhaust: ["rear_full_installed", "rear_three_quarter_installed", "tip_closeup"],
  hood: ["front_three_quarter_installed", "front_full_installed", "product_closeup"],
  lights: ["front_or_rear_three_quarter", "light_closeup", "installed_closeup"],
  wrap: ["front_three_quarter", "side_full_vehicle", "rear_three_quarter"],
  grille: ["front_full_installed", "front_three_quarter_installed", "product_closeup"],
}

const defaultReferenceViews = ["product_reference", "installed_reference", "detail_closeup"]

function referenceGuideKey(categoryId: string) {
  const normalized = categoryId.toLowerCase()
  if (normalized.includes("wing") || normalized.includes("spoiler")) return "rear-wing"
  if (normalized.includes("front") || normalized.includes("lip") || normalized.includes("splitter")) return "front-bumper"
  if (normalized.includes("light") || normalized.includes("lamp")) return "lights"
  return normalized
}

function recommendedViewsForCategory(categoryId: string) {
  return categoryReferenceGuides[referenceGuideKey(categoryId)] ?? defaultReferenceViews
}

function splitListText(value: string) {
  return value.split(/[\n,，、;；]/).map((item) => item.trim()).filter(Boolean)
}

function referenceRoleLabel(role: PartAssetReference["role"]) {
  return {
    shape_reference: "形状参考",
    material_reference: "材质参考",
    color_reference: "颜色参考",
    install_context: "安装效果",
    full_part_reference: "完整参考",
    avoid_upload: "不上传",
  }[role]
}

function promptTestStatusLabel(status: PartAsset["promptTestStatus"]) {
  return {
    untested: "未测试",
    pass: "通过",
    weak: "较弱",
    fail: "失败",
  }[status ?? "untested"]
}

type AssetQaIssueId =
  | "missing_keywords"
  | "missing_generation_refs"
  | "no_uploadable_refs"
  | "prompt_untested"
  | "prompt_weak"
  | "prompt_fail"
  | "not_generation_ready"
  | "active_incomplete"
  | "high_risk_refs"

type AssetQaIssue = {
  id: AssetQaIssueId
  label: string
  severity: "warn" | "danger" | "info"
}

const assetQaFilterOptions: Array<{ id: "all" | AssetQaIssueId; label: string }> = [
  { id: "all", label: "全部 QA 状态" },
  { id: "missing_keywords", label: "缺关键词" },
  { id: "missing_generation_refs", label: "缺生图参考图" },
  { id: "no_uploadable_refs", label: "无可上传参考图" },
  { id: "prompt_untested", label: "Prompt 未测试" },
  { id: "prompt_weak", label: "Prompt 较弱" },
  { id: "prompt_fail", label: "Prompt 失败" },
  { id: "not_generation_ready", label: "未验收" },
  { id: "active_incomplete", label: "启用但不完整" },
  { id: "high_risk_refs", label: "高风险参考图不足" },
]

function assetQaIssues(asset: PartAsset, category?: PartCategory): AssetQaIssue[] {
  const references = asset.generationReferences ?? []
  const activeReferences = references.filter((reference) => reference.active !== false && reference.url)
  const uploadableReferences = activeReferences.filter((reference) => reference.uploadToModel !== false && reference.role !== "avoid_upload")
  const issues: AssetQaIssue[] = []
  if (!asset.keywords?.trim()) issues.push({ id: "missing_keywords", label: "缺关键词", severity: "danger" })
  if (!activeReferences.length) issues.push({ id: "missing_generation_refs", label: "缺生图参考图", severity: "warn" })
  if (activeReferences.length && !uploadableReferences.length) issues.push({ id: "no_uploadable_refs", label: "无可上传参考图", severity: "danger" })
  if ((asset.promptTestStatus ?? "untested") === "untested") issues.push({ id: "prompt_untested", label: "Prompt 未测", severity: "info" })
  if (asset.promptTestStatus === "weak") issues.push({ id: "prompt_weak", label: "Prompt 较弱", severity: "warn" })
  if (asset.promptTestStatus === "fail") issues.push({ id: "prompt_fail", label: "Prompt 失败", severity: "danger" })
  if (!asset.generationReady) issues.push({ id: "not_generation_ready", label: "未验收", severity: "warn" })
  if (category?.referenceHighRisk && uploadableReferences.length < 2) issues.push({ id: "high_risk_refs", label: "高风险图不足", severity: "danger" })
  const activeIncomplete =
    asset.active &&
    (!asset.model.trim() ||
      !asset.variant.trim() ||
      !asset.imageUrl ||
      asset.imageUrl === "/placeholder.svg" ||
      !asset.keywords?.trim() ||
      !asset.promptHint?.trim() ||
      !uploadableReferences.length ||
      !asset.generationReady ||
      asset.promptTestStatus === "fail")
  if (activeIncomplete) issues.push({ id: "active_incomplete", label: "启用但不完整", severity: "danger" })
  return issues
}

function defaultReferenceRole(categoryId: string, index: number): PartAssetReference["role"] {
  const key = referenceGuideKey(categoryId)
  if (key === "wrap") return "color_reference"
  if (index === 0) return "full_part_reference"
  if (index === 1) return "install_context"
  return "shape_reference"
}

function defaultReferencePromptHint(categoryId: string, view: string) {
  const key = referenceGuideKey(categoryId)
  if (key === "hood") return "只参考机盖的轮廓、隆起筋线、开孔位置、碳纤维纹理和安装缝隙；若用户选择了车身颜色，机盖外露漆面必须跟随车身同色。"
  if (key === "rear-wing") return "只参考尾翼的宽度、高度、支架位置、安装点和材质；必须安装在原车后备箱盖对应位置，不改变车尾结构和背景。"
  if (key === "exhaust") return "只参考尾嘴数量、形状、口径、材质和后杠下方安装位置；不要改变车身、轮毂、背景或车牌。"
  if (key === "front-bumper") return "只参考前唇或前包围的下沿轮廓、材质、厚度和安装位置；不要改变大灯、机盖、轮毂或背景。"
  if (key === "calipers") return "只参考卡钳颜色、体积和安装位置；不要更换轮毂样式，不要改变车身颜色或背景。"
  if (key === "wheels") return "只参考轮毂造型、颜色、边缘深度和尺寸比例；保留原车角度、背景、车身颜色和未选配件。"
  if (key === "wrap") return "只参考车身颜色和漆面质感；不要改变车型、配件、背景、车牌和拍摄角度。"
  return `只参考这张图中配件的外观、材质、比例和安装方式；参考视角：${view}。`
}

function parseGenerationReferenceDrafts(text: string): AssetReferenceDraft[] {
  try {
    const parsed = JSON.parse(text || "[]")
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item, index) => ({
        url: String(item.url || "").trim(),
        role: item.role || "shape_reference",
        view: String(item.view || "product").trim() || "product",
        priority: Number.isFinite(Number(item.priority)) ? Number(item.priority) : (index + 1) * 10,
        promptHint: String(item.promptHint || "").trim(),
        uploadToModel: item.uploadToModel !== false,
        active: item.active !== false,
      }))
      .filter((item) => item.url)
  } catch {
    return []
  }
}

function AssetManagerV2({ summary, onChanged, notify }: { summary: AdminSummary; onChanged: () => void; notify: NotifyAdmin }) {
  const [categoryId, setCategoryId] = useState(summary.categories[0]?.id ?? "wheels")
  const [categorySearch, setCategorySearch] = useState("")
  const [brandSearch, setBrandSearch] = useState("")
  const [assetSearch, setAssetSearch] = useState("")
  const [editingCategoryId, setEditingCategoryId] = useState("")
  const [categoryForm, setCategoryForm] = useState({ id: "", labelZh: "", labelEn: "", description: "", sortOrder: "10", aliases: "", chatEnabled: true, referenceHighRisk: false, configType: "brand_resource" as "brand_resource" | "resource" | "resource_subcategory", assetImageVisible: true, subcategoryConfig: [] as Array<{ id: string; labelZh: string; labelEn: string; sortOrder: number; assets: Array<{ assetId: string; childLabelZh: string; childLabelEn: string }> }> })
  const [editingBrandId, setEditingBrandId] = useState("")
  const [brandForm, setBrandForm] = useState({ id: "", categoryId, label: "", sortOrder: "10", active: true })
  const [assetBrandId, setAssetBrandId] = useState("")
  const [editingAssetId, setEditingAssetId] = useState("")
  const [model, setModel] = useState("")
  const [variant, setVariant] = useState("")
  const [keywords, setKeywords] = useState("")
  const [color, setColor] = useState("")
  const [finish, setFinish] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [imageCrop, setImageCrop] = useState("")
  const [promptHint, setPromptHint] = useState("")
  const [defaultColorPolicy, setDefaultColorPolicy] = useState<PartColorPolicy>(defaultColorPolicyForCategory(categoryId))
  const [allowedColorPolicies, setAllowedColorPolicies] = useState<PartColorPolicy[]>(defaultAllowedColorPoliciesForCategory(categoryId))
  const [generationReferencesText, setGenerationReferencesText] = useState("[]")
  const [promptTestStatus, setPromptTestStatus] = useState<"untested" | "pass" | "weak" | "fail">("untested")
  const [generationReady, setGenerationReady] = useState(false)
  const [recommendedViewsText, setRecommendedViewsText] = useState("")
  const [badCaseNotes, setBadCaseNotes] = useState("")
  const [previewImage, setPreviewImage] = useState<{ url: string; label: string } | null>(null)
  const [assetPanelsOpen, setAssetPanelsOpen] = useState({ basic: true, advanced: false, quality: false })
  const [assetBrandFilterId, setAssetBrandFilterId] = useState("")
  const [assetQaFilter, setAssetQaFilter] = useState<"all" | AssetQaIssueId>("all")
  const [dragState, setDragState] = useState<{ kind: "category" | "brand" | "asset"; id: string } | null>(null)
  const [categoryOrderPreview, setCategoryOrderPreview] = useState<string[] | null>(null)
  const [brandOrderPreview, setBrandOrderPreview] = useState<string[] | null>(null)
  const [assetOrderPreview, setAssetOrderPreview] = useState<string[] | null>(null)
  const dragStateRef = useRef<{ kind: "category" | "brand" | "asset"; id: string } | null>(null)
  const dragOrderRef = useRef<string[]>([])
  const dragBaseOrderRef = useRef<string[]>([])
  const dragCleanupRef = useRef<(() => void) | null>(null)
  const dragClearTimerRef = useRef<number | null>(null)

  const categoryBrands = useMemo(() => summary.brands.filter((brand) => brand.categoryId === categoryId), [summary.brands, categoryId])
  const categoryById = useMemo(() => new Map(summary.categories.map((category) => [category.id, category])), [summary.categories])
  const selectedCategory = categoryById.get(categoryId)
  const selectedCategoryConfigType = selectedCategory?.configType ?? "brand_resource"
  const brandResourceCategories = useMemo(() => summary.categories.filter((category) => (category.configType ?? "brand_resource") === "brand_resource"), [summary.categories])
  const activeCategoryBrands = useMemo(() => categoryBrands.filter((brand) => brand.active), [categoryBrands])
  const assetFormBrands = useMemo(() => (editingAssetId ? categoryBrands : activeCategoryBrands), [activeCategoryBrands, categoryBrands, editingAssetId])
  const visibleAssets = useMemo(() => summary.assets.filter((asset) => asset.categoryId === categoryId), [summary.assets, categoryId])
  const categoryQuery = categorySearch.trim().toLowerCase()
  const brandQuery = brandSearch.trim().toLowerCase()
  const assetQuery = assetSearch.trim().toLowerCase()
  const filteredCategories = useMemo(
    () => summary.categories.filter((category) => `${category.id} ${category.labelZh} ${category.labelEn} ${category.label} ${category.description}`.toLowerCase().includes(categoryQuery)),
    [summary.categories, categoryQuery],
  )
  const filteredBrands = useMemo(
    () => categoryBrands.filter((brand) => `${brand.id} ${brand.label}`.toLowerCase().includes(brandQuery)),
    [categoryBrands, brandQuery],
  )
  const filteredAssets = useMemo(
    () =>
      visibleAssets.filter((asset) => {
        const matchesBrand = !assetBrandFilterId || asset.brandId === assetBrandFilterId
        const matchesSearch = `${asset.brand} ${asset.model} ${asset.variant} ${asset.keywords ?? ""} ${asset.color} ${asset.finish}`.toLowerCase().includes(assetQuery)
        const matchesQa = assetQaFilter === "all" || assetQaIssues(asset, categoryById.get(asset.categoryId)).some((issue) => issue.id === assetQaFilter)
        return matchesBrand && matchesSearch && matchesQa
      }),
    [visibleAssets, assetBrandFilterId, assetQuery, assetQaFilter, categoryById],
  )
  const displayedCategories = useMemo(() => orderItemsByPreview(filteredCategories, categoryOrderPreview), [filteredCategories, categoryOrderPreview])
  const displayedBrands = useMemo(() => orderItemsByPreview(filteredBrands, brandOrderPreview), [filteredBrands, brandOrderPreview])
  const displayedAssets = useMemo(() => orderItemsByPreview(filteredAssets, assetOrderPreview), [filteredAssets, assetOrderPreview])
  const generationReferenceDrafts = useMemo(() => parseGenerationReferenceDrafts(generationReferencesText), [generationReferencesText])
  const categoryRecommendedViews = useMemo(() => recommendedViewsForCategory(categoryId), [categoryId])
  const manualRecommendedViews = useMemo(() => splitListText(recommendedViewsText), [recommendedViewsText])
  const displayedRecommendedViews = manualRecommendedViews.length ? manualRecommendedViews : categoryRecommendedViews

  useEffect(() => {
    if (!previewImage) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setPreviewImage(null)
    }
    window.addEventListener("keydown", closeOnEscape)
    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [previewImage])

  const toggleAllowedColorPolicy = (policy: PartColorPolicy) => {
    setAllowedColorPolicies((current) => {
      const next = current.includes(policy) ? current.filter((item) => item !== policy) : [...current, policy]
      const normalized = next.length ? next : [policy]
      if (!normalized.includes(defaultColorPolicy)) setDefaultColorPolicy(normalized[0])
      return normalized
    })
  }

  useEffect(() => {
    if (!summary.categories.some((category) => category.id === categoryId)) {
      setCategoryId(summary.categories[0]?.id ?? "wheels")
    }
  }, [summary.categories, categoryId])

  useEffect(() => {
    setBrandForm((current) => ({ ...current, categoryId }))
    setAssetBrandFilterId("")
    if (!assetFormBrands.some((brand) => brand.id === assetBrandId)) {
      setAssetBrandId(assetFormBrands[0]?.id ?? "")
    }
  }, [categoryId, assetFormBrands, assetBrandId])

  useEffect(() => {
    if (editingAssetId) return
    const defaults = defaultAllowedColorPoliciesForCategory(categoryId)
    setDefaultColorPolicy(defaultColorPolicyForCategory(categoryId))
    setAllowedColorPolicies(defaults)
  }, [categoryId, editingAssetId])

  const readError = async (response: Response, fallback: string) => {
    const body = await response.json().catch(() => ({}))
    return typeof body.error === "string" ? body.error : fallback
  }

  const formatGenerationReferences = (references: PartAssetReference[] | undefined) =>
    JSON.stringify(
      (references ?? []).map((reference) => ({
        url: reference.url,
        role: reference.role,
        view: reference.view,
        priority: reference.priority,
        promptHint: reference.promptHint,
        uploadToModel: reference.uploadToModel,
        active: reference.active,
      })),
      null,
      2,
    )

  const parseGenerationReferences = () => {
    try {
      const parsed = JSON.parse(generationReferencesText || "[]")
      if (!Array.isArray(parsed)) throw new Error("生图参考图必须是数组")
      return parseGenerationReferenceDrafts(generationReferencesText)
    } catch (error) {
      notify("error", error instanceof Error ? error.message : "生图参考图 JSON 格式错误")
      return null
    }
  }

  const clearDragPreview = () => {
    if (dragClearTimerRef.current) {
      window.clearTimeout(dragClearTimerRef.current)
      dragClearTimerRef.current = null
    }
    dragCleanupRef.current?.()
    dragCleanupRef.current = null
    dragStateRef.current = null
    dragOrderRef.current = []
    dragBaseOrderRef.current = []
    setDragState(null)
    setCategoryOrderPreview(null)
    setBrandOrderPreview(null)
    setAssetOrderPreview(null)
  }

  const scheduleClearDragPreview = () => {
    if (dragClearTimerRef.current) window.clearTimeout(dragClearTimerRef.current)
    dragClearTimerRef.current = window.setTimeout(() => {
      dragClearTimerRef.current = null
      clearDragPreview()
    }, 160)
  }

  const previewCategoryMove = (targetId: string) => {
    const currentDrag = dragStateRef.current
    if (currentDrag?.kind !== "category" || categoryQuery) return
    setCategoryOrderPreview((current) => moveIdBefore(current ?? filteredCategories.map((category) => category.id), currentDrag.id, targetId) ?? current)
  }

  const previewBrandMove = (targetId: string) => {
    const currentDrag = dragStateRef.current
    if (currentDrag?.kind !== "brand" || brandQuery) return
    setBrandOrderPreview((current) => moveIdBefore(current ?? filteredBrands.map((brand) => brand.id), currentDrag.id, targetId) ?? current)
  }

  const previewAssetMove = (targetId: string) => {
    const currentDrag = dragStateRef.current
    if (currentDrag?.kind !== "asset" || assetQuery) return
    setAssetOrderPreview((current) => moveIdBefore(current ?? filteredAssets.map((asset) => asset.id), currentDrag.id, targetId) ?? current)
  }

  const sameOrder = (left: string[], right: string[]) => left.length === right.length && left.every((id, index) => id === right[index])

  const setPreviewOrder = (kind: "category" | "brand" | "asset", orderedIds: string[]) => {
    dragOrderRef.current = orderedIds
    if (kind === "category") setCategoryOrderPreview(orderedIds)
    if (kind === "brand") setBrandOrderPreview(orderedIds)
    if (kind === "asset") setAssetOrderPreview(orderedIds)
  }

  const updatePointerSort = (clientY: number) => {
    const currentDrag = dragStateRef.current
    if (!currentDrag) return
    const rows = Array.from(document.querySelectorAll<HTMLElement>(`[data-sort-kind="${currentDrag.kind}"][data-sort-id]`))
    const otherRows = rows.filter((row) => row.dataset.sortId !== currentDrag.id)
    let insertIndex = otherRows.length
    for (let index = 0; index < otherRows.length; index += 1) {
      const rect = otherRows[index].getBoundingClientRect()
      if (clientY < rect.top + rect.height / 2) {
        insertIndex = index
        break
      }
    }
    const nextOrder = moveIdToIndex(dragOrderRef.current, currentDrag.id, insertIndex)
    if (!nextOrder || sameOrder(nextOrder, dragOrderRef.current)) return
    setPreviewOrder(currentDrag.kind, nextOrder)
  }

  const startPointerSort = (
    event: React.PointerEvent<HTMLButtonElement>,
    kind: "category" | "brand" | "asset",
    id: string,
    orderedIds: string[],
  ) => {
    if (event.button !== 0 || orderedIds.length < 2) return
    event.preventDefault()
    event.stopPropagation()
    dragCleanupRef.current?.()
    const nextDrag = { kind, id }
    dragStateRef.current = nextDrag
    dragBaseOrderRef.current = orderedIds
    dragOrderRef.current = orderedIds
    setDragState(nextDrag)
    setPreviewOrder(kind, orderedIds)

    const handleMove = (pointerEvent: PointerEvent) => {
      pointerEvent.preventDefault()
      updatePointerSort(pointerEvent.clientY)
    }
    const handleEnd = () => {
      dragCleanupRef.current?.()
      dragCleanupRef.current = null
      void finishDragSort()
    }
    window.addEventListener("pointermove", handleMove, { passive: false })
    window.addEventListener("pointerup", handleEnd, { once: true })
    window.addEventListener("pointercancel", handleEnd, { once: true })
    dragCleanupRef.current = () => {
      window.removeEventListener("pointermove", handleMove)
      window.removeEventListener("pointerup", handleEnd)
      window.removeEventListener("pointercancel", handleEnd)
    }
  }

  const saveCategoryOrder = async (orderedIds: string[]) => {
    const response = await fetch("/api/admin/categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds }),
    })
    if (!response.ok) {
      notify("error", await readError(response, "类型排序保存失败"))
      clearDragPreview()
      return
    }
    notify("success", "类型排序已保存")
    onChanged()
    scheduleClearDragPreview()
  }

  const saveBrandOrder = async (orderedIds: string[]) => {
    const response = await fetch("/api/admin/brands", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId, orderedIds }),
    })
    if (!response.ok) {
      notify("error", await readError(response, "品牌排序保存失败"))
      clearDragPreview()
      return
    }
    notify("success", "品牌排序已保存")
    onChanged()
    scheduleClearDragPreview()
  }

  const saveAssetOrder = async (orderedIds: string[]) => {
    const response = await fetch("/api/admin/assets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId, brandId: assetBrandFilterId, orderedIds }),
    })
    if (!response.ok) {
      notify("error", await readError(response, "配件排序保存失败"))
      clearDragPreview()
      return
    }
    notify("success", "配件排序已保存")
    onChanged()
    scheduleClearDragPreview()
  }

  const finishDragSort = async () => {
    const currentDrag = dragStateRef.current
    if (!currentDrag) {
      clearDragPreview()
      return
    }
    const orderedIds = dragOrderRef.current
    const baseOrder = dragBaseOrderRef.current
    if (!orderedIds.length || sameOrder(orderedIds, baseOrder)) {
      clearDragPreview()
      return
    }
    if (currentDrag.kind === "category") {
      await saveCategoryOrder(orderedIds)
      return
    }
    if (currentDrag.kind === "brand") {
      await saveBrandOrder(orderedIds)
      return
    }
    await saveAssetOrder(orderedIds)
  }

  const reorderCategoriesByDrop = async (draggedId: string, targetId: string) => {
    if (categoryQuery) {
      notify("error", "请先清空类型搜索，再拖拽排序。")
      return
    }
    const orderedIds = moveIdBefore(summary.categories.map((category) => category.id), draggedId, targetId)
    if (!orderedIds) return
    const response = await fetch("/api/admin/categories", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds }),
    })
    if (!response.ok) {
      notify("error", await readError(response, "类型排序保存失败"))
      return
    }
    notify("success", "类型排序已保存")
    onChanged()
  }

  const reorderBrandsByDrop = async (draggedId: string, targetId: string) => {
    if (brandQuery) {
      notify("error", "请先清空品牌搜索，再拖拽排序。")
      return
    }
    const orderedIds = moveIdBefore(categoryBrands.map((brand) => brand.id), draggedId, targetId)
    if (!orderedIds) return
    const response = await fetch("/api/admin/brands", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId, orderedIds }),
    })
    if (!response.ok) {
      notify("error", await readError(response, "品牌排序保存失败"))
      return
    }
    notify("success", "品牌排序已保存")
    onChanged()
  }

  const reorderAssetsByDrop = async (draggedId: string, targetId: string) => {
    if (assetQuery) {
      notify("error", "请先清空配件搜索，再拖拽排序。")
      return
    }
    const orderedIds = moveIdBefore(filteredAssets.map((asset) => asset.id), draggedId, targetId)
    if (!orderedIds) return
    const response = await fetch("/api/admin/assets", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ categoryId, brandId: assetBrandFilterId, orderedIds }),
    })
    if (!response.ok) {
      notify("error", await readError(response, "配件排序保存失败"))
      return
    }
    notify("success", "配件排序已保存")
    onChanged()
  }

  const resetCategoryForm = () => {
    setEditingCategoryId("")
    setCategoryForm({ id: "", labelZh: "", labelEn: "", description: "", sortOrder: "10", aliases: "", chatEnabled: true, referenceHighRisk: false, configType: "brand_resource", assetImageVisible: true, subcategoryConfig: [] })
  }

  const editCategory = (category: PartCategory) => {
    setEditingCategoryId(category.id)
    setCategoryId(category.id)
    setCategoryForm({
      id: category.id,
      labelZh: category.labelZh || category.label,
      labelEn: category.labelEn || category.label,
      description: category.description,
      sortOrder: String(category.sortOrder),
      aliases: (category.aliases ?? []).join(", "),
      chatEnabled: category.chatEnabled ?? true,
      referenceHighRisk: category.referenceHighRisk ?? false,
      configType: category.configType ?? "brand_resource",
      assetImageVisible: category.assetImageVisible ?? true,
      subcategoryConfig: (category.subcategoryConfig ?? []).map((group) => ({
        id: group.id,
        labelZh: group.labelZh,
        labelEn: group.labelEn ?? "",
        sortOrder: group.sortOrder,
        assets: (group.assets ?? []).map((asset) => ({ assetId: asset.assetId, childLabelZh: asset.childLabelZh ?? "", childLabelEn: asset.childLabelEn ?? "" })),
      })),
    })
  }

  const saveCategory = async () => {
    const response = await fetch(editingCategoryId ? `/api/admin/categories/${editingCategoryId}` : "/api/admin/categories", {
      method: editingCategoryId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingCategoryId ? undefined : categoryForm.id,
        labelZh: categoryForm.labelZh,
        labelEn: categoryForm.labelEn,
        description: categoryForm.description,
        sortOrder: Number(categoryForm.sortOrder),
        aliases: categoryForm.aliases.split(/[\n,，、;；]/).map((item) => item.trim()).filter(Boolean),
        chatEnabled: categoryForm.chatEnabled,
        referenceHighRisk: categoryForm.referenceHighRisk,
        configType: categoryForm.configType,
        assetImageVisible: categoryForm.assetImageVisible,
        subcategoryConfig: categoryForm.subcategoryConfig,
      }),
    })
    if (!response.ok) {
      notify("error", await readError(response, "类型保存失败"))
      return
    }
    const body = (await response.json()) as PartCategory
    setCategoryId(body.id)
    resetCategoryForm()
    notify("success", editingCategoryId ? "类型已更新" : "类型已新增")
    onChanged()
  }

  const removeCategory = async (category: PartCategory) => {
    if (!window.confirm(`删除类型「${category.labelZh || category.labelEn || category.label}」？该类型下有品牌或配件时会被阻止。`)) return
    const response = await fetch(`/api/admin/categories/${category.id}`, { method: "DELETE" })
    if (!response.ok) {
      notify("error", await readError(response, "类型删除失败"))
      return
    }
    if (categoryId === category.id) setCategoryId(summary.categories.find((item) => item.id !== category.id)?.id ?? "")
    notify("success", "类型已删除")
    onChanged()
  }

  const resetBrandForm = () => {
    setEditingBrandId("")
    setBrandForm({ id: "", categoryId, label: "", sortOrder: "10", active: true })
  }

  const editBrand = (brand: PartBrand) => {
    setEditingBrandId(brand.id)
    setCategoryId(brand.categoryId)
    setBrandForm({ id: brand.id, categoryId: brand.categoryId, label: brand.label, sortOrder: String(brand.sortOrder), active: brand.active })
  }

  const saveBrand = async () => {
    const response = await fetch(editingBrandId ? `/api/admin/brands/${editingBrandId}` : "/api/admin/brands", {
      method: editingBrandId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editingBrandId ? undefined : brandForm.id,
        categoryId: brandForm.categoryId,
        label: brandForm.label,
        active: brandForm.active,
      }),
    })
    if (!response.ok) {
      notify("error", await readError(response, "品牌保存失败"))
      return
    }
    const body = (await response.json()) as PartBrand
    setCategoryId(body.categoryId)
    setAssetBrandId(body.id)
    resetBrandForm()
    notify("success", editingBrandId ? "品牌已更新" : "品牌已新增")
    onChanged()
  }

  const removeBrand = async (brand: PartBrand) => {
    if (!window.confirm(`删除品牌「${brand.label}」？已有配件引用时会自动停用。`)) return
    const response = await fetch(`/api/admin/brands/${brand.id}`, { method: "DELETE" })
    if (!response.ok) {
      notify("error", await readError(response, "品牌删除失败"))
      return
    }
    const body = (await response.json()) as { disabled?: boolean }
    notify("success", body.disabled ? "品牌已有配件引用，已改为停用" : "品牌已删除")
    onChanged()
  }

  const uploadImage = async (file: File | undefined) => {
    if (!file) return
    const formData = new FormData()
    formData.append("file", file)
    const response = await fetch("/api/admin/uploads", { method: "POST", body: formData })
    if (!response.ok) {
      notify("error", await readError(response, "图片上传失败"))
      return
    }
    const body = (await response.json()) as { imageUrl: string }
    setImageUrl(body.imageUrl)
    notify("success", "图片已上传")
  }

  const removePrimaryImage = () => {
    setImageUrl("")
    notify("success", "配件示例图已删除，保存配件后生效")
  }

  const uploadGenerationReference = async (file: File | undefined) => {
    if (!file) return
    const formData = new FormData()
    formData.append("file", file)
    const response = await fetch("/api/admin/uploads", { method: "POST", body: formData })
    if (!response.ok) {
      notify("error", await readError(response, "参考图上传失败"))
      return
    }
    const body = (await response.json()) as { imageUrl: string }
    const current = parseGenerationReferences()
    if (!current) return
    const nextView = categoryRecommendedViews[current.length] ?? defaultReferenceViews[Math.min(current.length, defaultReferenceViews.length - 1)]
    const next = [
      ...current,
      {
        url: body.imageUrl,
        role: defaultReferenceRole(categoryId, current.length),
        view: nextView,
        priority: (current.length + 1) * 10,
        promptHint: defaultReferencePromptHint(categoryId, nextView),
        uploadToModel: true,
        active: true,
      },
    ]
    setGenerationReferencesText(JSON.stringify(next, null, 2))
    notify("success", "生图参考图已添加")
  }

  const removeGenerationReference = (index: number) => {
    const current = parseGenerationReferences()
    if (!current) return
    const next = current.filter((_, itemIndex) => itemIndex !== index)
    setGenerationReferencesText(JSON.stringify(next, null, 2))
    notify("success", "参考图已删除，保存配件后生效")
  }

  const updateGenerationReference = (index: number, patch: Partial<AssetReferenceDraft>) => {
    const current = parseGenerationReferences()
    if (!current) return
    const next = current.map((reference, itemIndex) => (itemIndex === index ? { ...reference, ...patch } : reference))
    setGenerationReferencesText(JSON.stringify(next, null, 2))
  }

  const resetAssetForm = () => {
    setEditingAssetId("")
    setModel("")
    setVariant("")
    setKeywords("")
    setColor("")
    setFinish("")
    setImageUrl("")
    setImageCrop("")
    setPromptHint("")
    setDefaultColorPolicy(defaultColorPolicyForCategory(categoryId))
    setAllowedColorPolicies(defaultAllowedColorPoliciesForCategory(categoryId))
    setGenerationReferencesText("[]")
    setPromptTestStatus("untested")
    setGenerationReady(false)
    setRecommendedViewsText("")
    setBadCaseNotes("")
    setAssetBrandId(activeCategoryBrands[0]?.id ?? "")
  }

  const editAsset = (asset: PartAsset) => {
    setEditingAssetId(asset.id)
    setCategoryId(asset.categoryId)
    setAssetBrandFilterId(asset.brandId)
    setAssetBrandId(asset.brandId)
    setModel(asset.model)
    setVariant(asset.variant)
    setKeywords(asset.keywords ?? "")
    setColor(asset.color)
    setFinish(asset.finish)
    setImageUrl(asset.imageUrl)
    setImageCrop(asset.imageCrop ?? "")
    setPromptHint(asset.promptHint)
    setDefaultColorPolicy(asset.defaultColorPolicy ?? defaultColorPolicyForCategory(asset.categoryId))
    setAllowedColorPolicies(asset.allowedColorPolicies?.length ? asset.allowedColorPolicies : defaultAllowedColorPoliciesForCategory(asset.categoryId))
    setGenerationReferencesText(formatGenerationReferences(asset.generationReferences))
    setPromptTestStatus(asset.promptTestStatus ?? "untested")
    setGenerationReady(Boolean(asset.generationReady))
    setRecommendedViewsText((asset.recommendedViews ?? []).join(", "))
    setBadCaseNotes(asset.badCaseNotes ?? "")
  }

  const createAssetItem = async () => {
    const selectedBrand = summary.brands.find((brand) => brand.id === assetBrandId)
    if (!selectedBrand) {
      notify("error", "请先选择或创建品牌")
      return
    }
    const generationReferences = parseGenerationReferences()
    if (!generationReferences) return
    const cleanKeywords = keywords.trim()
    if (!cleanKeywords) {
      notify("error", "关键字必填")
      return
    }
    const payload = {
      categoryId,
      brandId: selectedBrand.id,
      brand: selectedBrand.label,
      model: model || "Custom Part",
      variant: variant || "Default",
      keywords: cleanKeywords,
      color: color || "Custom",
      finish: finish || "custom finish",
      imageUrl: imageUrl || "/placeholder.svg",
      imageCrop,
      promptHint: promptHint || "Install this part naturally on the uploaded vehicle while preserving lighting and perspective.",
      defaultColorPolicy,
      allowedColorPolicies: allowedColorPolicies.includes(defaultColorPolicy) ? allowedColorPolicies : [defaultColorPolicy, ...allowedColorPolicies],
      generationReferences,
      promptTestStatus,
      generationReady,
      recommendedViews: manualRecommendedViews.length ? manualRecommendedViews : categoryRecommendedViews,
      badCaseNotes,
    }
    const response = await fetch(editingAssetId ? `/api/admin/assets/${editingAssetId}` : "/api/admin/assets", {
      method: editingAssetId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    if (!response.ok) {
      notify("error", await readError(response, "配件保存失败"))
      return
    }
    resetAssetForm()
    notify("success", editingAssetId ? "配件已更新" : "配件已新增")
    onChanged()
  }

  return (
    <div className="asset-admin-stack">
      <section className="admin-panel taxonomy-grid">
        <div className="taxonomy-card">
          <PanelHeading label="资源流程" title="类型管理" count={`${summary.categories.length} 个类型`} />
          <input value={categorySearch} onChange={(event) => setCategorySearch(event.target.value)} placeholder="搜索类型 ID / 名称 / 描述" />
          <div className={dragState?.kind === "category" ? "taxonomy-list drag-active" : "taxonomy-list"}>
            {displayedCategories.map((category) => {
              const brandCount = summary.brands.filter((brand) => brand.categoryId === category.id).length
              const assetCount = summary.assets.filter((asset) => asset.categoryId === category.id).length
              return (
                <motion.article
                  layout
                  transition={{ type: "spring", stiffness: 520, damping: 42, mass: 0.7 }}
                  key={category.id}
                  data-sort-kind="category"
                  data-sort-id={category.id}
                  className={`${category.id === categoryId ? "taxonomy-row selected" : "taxonomy-row"} ${dragState?.kind === "category" && dragState.id === category.id ? "dragging" : ""}`}
                >
                  <button
                    type="button"
                    className="drag-handle"
                    draggable={false}
                    disabled={Boolean(categoryQuery)}
                    onPointerDown={(event) => startPointerSort(event, "category", category.id, filteredCategories.map((item) => item.id))}
                    aria-label="拖拽排序"
                    title="按住拖拽排序"
                  >
                    <ChevronsUpDown size={15} />
                  </button>
                  <button type="button" className="taxonomy-main" onClick={() => editCategory(category)}>
                    <strong>{category.labelZh}</strong>
                    <span>{category.labelEn} / {category.id}</span>
                    <small>{brandCount} 品牌 / {assetCount} 配件</small>
                    <small className="config-type-badge">{category.configType === "resource_subcategory" ? "资源-细分类" : category.configType === "resource" ? "资源" : "品牌-资源"}</small>
                  </button>
                  <button type="button" className="icon-danger" onClick={() => void removeCategory(category)} aria-label="删除类型">
                    <Trash2 size={15} />
                  </button>
                </motion.article>
              )
            })}
          </div>
          <form className="admin-form compact" onSubmit={(event) => { event.preventDefault(); void saveCategory() }}>
            <label>
              类型 ID
              <input value={categoryForm.id} onChange={(event) => setCategoryForm((current) => ({ ...current, id: event.target.value }))} disabled={Boolean(editingCategoryId)} placeholder="wheels" />
            </label>
            <label>
              类型名称
              <input value={categoryForm.labelZh} onChange={(event) => setCategoryForm((current) => ({ ...current, labelZh: event.target.value }))} placeholder="轮毂" required />
            </label>
            <label>
              类型英文名称
              <input value={categoryForm.labelEn} onChange={(event) => setCategoryForm((current) => ({ ...current, labelEn: event.target.value }))} placeholder="Wheels" required />
            </label>
            <label>
              描述
              <input value={categoryForm.description} onChange={(event) => setCategoryForm((current) => ({ ...current, description: event.target.value }))} placeholder="轮毂、卡钳、尾翼等一级类型" />
            </label>
            <label>
              对话别名
              <textarea value={categoryForm.aliases} onChange={(event) => setCategoryForm((current) => ({ ...current, aliases: event.target.value }))} placeholder="轮毂, 轮圈, rim" rows={3} />
            </label>
            <label>
              排序
              <input type="number" value={categoryForm.sortOrder} onChange={(event) => setCategoryForm((current) => ({ ...current, sortOrder: event.target.value }))} />
            </label>
            <label className="inline-check">
              <input type="checkbox" checked={categoryForm.chatEnabled} onChange={(event) => setCategoryForm((current) => ({ ...current, chatEnabled: event.target.checked }))} />
              对话模式参与识别
            </label>
            <label className="inline-check">
              <input type="checkbox" checked={categoryForm.referenceHighRisk} onChange={(event) => setCategoryForm((current) => ({ ...current, referenceHighRisk: event.target.checked }))} />
              高风险参考图
            </label>
            <label>
              配置类型
              <select value={categoryForm.configType} onChange={(event) => setCategoryForm((current) => ({ ...current, configType: event.target.value as "brand_resource" | "resource" | "resource_subcategory" }))}>
                <option value="brand_resource">品牌-资源</option>
                <option value="resource">资源</option>
                <option value="resource_subcategory">资源-细分类</option>
              </select>
            </label>
            {categoryForm.configType === "resource" && (
              <label className="inline-check">
                <input type="checkbox" checked={categoryForm.assetImageVisible} onChange={(event) => setCategoryForm((current) => ({ ...current, assetImageVisible: event.target.checked }))} />
                是否显示图片
              </label>
            )}
            {categoryForm.configType === "resource_subcategory" && (
              <SubcategoryConfigEditor
                config={categoryForm.subcategoryConfig}
                onChange={(subcategoryConfig) => setCategoryForm((current) => ({ ...current, subcategoryConfig }))}
                categoryAssets={summary.assets.filter((asset) => asset.categoryId === (editingCategoryId || categoryForm.id))}
              />
            )}
            <div className="taxonomy-actions">
              <button type="submit">{editingCategoryId ? "保存类型" : "新增类型"}</button>
              <button type="button" onClick={resetCategoryForm}>
                <ListPlus size={15} />
                新建
              </button>
            </div>
          </form>
        </div>

        {selectedCategoryConfigType === "brand_resource" && (
        <div className="taxonomy-card">
          <PanelHeading label="资源流程" title="品牌管理" count={`${categoryBrands.length} 个品牌`} />
          <div className="admin-toolbar">
            <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              {brandResourceCategories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.labelZh || category.labelEn || category.label}
                </option>
              ))}
            </select>
          </div>
          <input value={brandSearch} onChange={(event) => setBrandSearch(event.target.value)} placeholder="搜索品牌 ID / 名称" />
          <div className={dragState?.kind === "brand" ? "taxonomy-list drag-active" : "taxonomy-list"}>
            {displayedBrands.map((brand) => (
              <motion.article
                layout
                transition={{ type: "spring", stiffness: 520, damping: 42, mass: 0.7 }}
                  key={brand.id}
                  data-sort-kind="brand"
                  data-sort-id={brand.id}
                  className={`${brand.id === assetBrandId ? "taxonomy-row selected" : "taxonomy-row"} ${dragState?.kind === "brand" && dragState.id === brand.id ? "dragging" : ""}`}
              >
                <button
                  type="button"
                  className="drag-handle"
                  draggable={false}
                  disabled={Boolean(brandQuery)}
                  onPointerDown={(event) => startPointerSort(event, "brand", brand.id, filteredBrands.map((item) => item.id))}
                  aria-label="拖拽排序"
                  title="按住拖拽排序"
                >
                  <ChevronsUpDown size={15} />
                </button>
                <button type="button" className="taxonomy-main" onClick={() => editBrand(brand)}>
                  <strong>{brand.label}</strong>
                  <span>{brand.id}</span>
                  <small>{brand.active ? "启用" : "停用"}</small>
                </button>
                <button type="button" className="icon-danger" onClick={() => void removeBrand(brand)} aria-label="删除品牌">
                  <Trash2 size={15} />
                </button>
              </motion.article>
            ))}
          </div>
          <form className="admin-form compact" onSubmit={(event) => { event.preventDefault(); void saveBrand() }}>
            <label>
              所属类型
              <select value={brandForm.categoryId} onChange={(event) => setBrandForm((current) => ({ ...current, categoryId: event.target.value }))}>
                {brandResourceCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.labelZh || category.labelEn || category.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              品牌 ID
              <input value={brandForm.id} onChange={(event) => setBrandForm((current) => ({ ...current, id: event.target.value }))} disabled={Boolean(editingBrandId)} placeholder="wheels-bbs" />
            </label>
            <label>
              品牌名称
              <input value={brandForm.label} onChange={(event) => setBrandForm((current) => ({ ...current, label: event.target.value }))} placeholder="BBS" />
            </label>
            <label className="inline-check">
              <input type="checkbox" checked={brandForm.active} onChange={(event) => setBrandForm((current) => ({ ...current, active: event.target.checked }))} />
              启用品牌
            </label>
            <div className="taxonomy-actions">
              <button type="submit">{editingBrandId ? "保存品牌" : "新增品牌"}</button>
              <button type="button" onClick={resetBrandForm}>
                <ListPlus size={15} />
                新建
              </button>
            </div>
          </form>
        </div>
        )}
      </section>

      <section className="admin-panel two-column-panel">
        <div>
          <PanelHeading label="资源流程" title="配件管理" count={`${filteredAssets.length} 个配件`} />
          <div className="admin-toolbar">
            <select value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              {summary.categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.labelZh || category.labelEn || category.label}
                </option>
              ))}
            </select>
            <input value={assetSearch} onChange={(event) => setAssetSearch(event.target.value)} placeholder="搜索品牌 / 型号 / 款式 / 颜色" />
            <select value={assetQaFilter} onChange={(event) => setAssetQaFilter(event.target.value as "all" | AssetQaIssueId)} aria-label="资产 QA 筛选">
              {assetQaFilterOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          {selectedCategoryConfigType === "brand_resource" && (
          <div className="brand-tags">
            <button type="button" className={!assetBrandFilterId ? "selected" : ""} onClick={() => setAssetBrandFilterId("")}>
              显示全部
            </button>
            {categoryBrands.map((brand) => (
              <button key={brand.id} type="button" className={brand.id === assetBrandFilterId ? "selected" : ""} onClick={() => setAssetBrandFilterId(brand.id)}>
                {brand.label}
              </button>
            ))}
          </div>
          )}
          <div className={dragState?.kind === "asset" ? "asset-table drag-active" : "asset-table"}>
            {displayedAssets.map((asset) => (
              <AssetRow
                key={asset.id}
                asset={asset}
                qaIssues={assetQaIssues(asset, categoryById.get(asset.categoryId))}
                onChanged={onChanged}
                onEdit={() => editAsset(asset)}
                sortKind="asset"
                dragging={dragState?.kind === "asset" && dragState.id === asset.id}
                dragDisabled={Boolean(assetQuery)}
                onPointerDown={(event) => startPointerSort(event, "asset", asset.id, filteredAssets.map((item) => item.id))}
              />
            ))}
          </div>
        </div>

        <form className="admin-form asset-editor-form" onSubmit={(event) => { event.preventDefault(); void createAssetItem() }}>
          <PanelHeading label={editingAssetId ? "编辑 // 配件" : "新增 // 配件"} title={editingAssetId ? "编辑配件资源" : "上传配件资源"} />
          <section className={`asset-optional-panel asset-basic-panel ${assetPanelsOpen.basic ? "open" : ""}`}>
            <button
              type="button"
              className="asset-optional-summary"
              aria-expanded={assetPanelsOpen.basic}
              onClick={() => setAssetPanelsOpen((current) => ({ ...current, basic: !current.basic }))}
            >
              <span>基础设置</span>
              <small>{selectedCategoryConfigType === "brand_resource" ? "品牌、型号、展示图、Prompt Hint、参考图" : "型号、展示图、Prompt Hint、参考图"}</small>
            </button>
            <div className="asset-optional-content">
              <div className="asset-optional-content-inner">
                <div className="asset-basic-panel-body">
          {selectedCategoryConfigType === "brand_resource" && (
          <label>
            所属品牌
            <select value={assetBrandId} onChange={(event) => setAssetBrandId(event.target.value)}>
              {assetFormBrands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.label}
                </option>
              ))}
            </select>
          </label>
          )}
          <label>
            型号
            <input value={model} onChange={(event) => setModel(event.target.value)} placeholder="LM-R / GT Wing" />
          </label>
          <label>
            款式
            <input value={variant} onChange={(event) => setVariant(event.target.value)} placeholder="DB-BKBD" />
          </label>
          <label>
            关键字 *
            <input required value={keywords} onChange={(event) => setKeywords(event.target.value)} placeholder="HD14BMWF80-OE, Seibon OE, RSCBMW001" />
            <small>对话模式只按这里维护的关键字匹配资产；多个关键字用中英文逗号、顿号、分号或换行分隔。</small>
          </label>
          <label>
            颜色
            <input value={color} onChange={(event) => setColor(event.target.value)} placeholder="Diamond Black" />
          </label>
          <label>
            Finish
            <input value={finish} onChange={(event) => setFinish(event.target.value)} placeholder="diamond-cut rim" />
          </label>
          <label className="upload-field">
            图片上传
            <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void uploadImage(event.target.files?.[0])} />
          </label>
          <label>
            图片 URL
            <input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} placeholder="/uploads/parts/example.png" />
          </label>
          {imageUrl && (
            <div className="upload-preview image-manage-preview">
              <img src={imageUrl} alt="配件预览" />
              <span>{imageUrl}</span>
              <div className="image-preview-actions">
                <button type="button" aria-label="查看原图" title="查看原图" onClick={() => setPreviewImage({ url: imageUrl, label: "配件示例图" })}>
                  <Eye size={14} />
                </button>
                <button type="button" className="danger" aria-label="删除示例图" title="删除示例图" onClick={removePrimaryImage}>
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          )}
          <label>
            裁剪定位
            <input value={imageCrop} onChange={(event) => setImageCrop(event.target.value)} placeholder="25% 25%" />
          </label>
          <label>
            配件专属 Prompt Hint
            <textarea
              value={promptHint}
              onChange={(event) => setPromptHint(event.target.value)}
              placeholder="可选。只写这个配件最容易丢失或画错的关键特征，例如安装位置、材质、颜色跟随规则。"
            />
          </label>
          <div className="asset-color-policy-card">
            <label>
              配色策略 / Color policy
              <select value={defaultColorPolicy} onChange={(event) => setDefaultColorPolicy(event.target.value as PartColorPolicy)}>
                {partColorPolicyOptions
                  .filter((option) => allowedColorPolicies.includes(option.id))
                  .map((option) => (
                    <option key={option.id} value={option.id}>
                      默认：{option.label}
                    </option>
                  ))}
              </select>
            </label>
            <div className="asset-policy-checks">
              <span>允许用户选择 / Allowed options</span>
              {partColorPolicyOptions.map((option) => (
                <label key={option.id} className="inline-check">
                  <input type="checkbox" checked={allowedColorPolicies.includes(option.id)} onChange={() => toggleAllowedColorPolicy(option.id)} />
                  {option.label}
                  <small>{option.description}</small>
                </label>
              ))}
            </div>
            <small>机盖建议允许“与车同色”和“裸碳”；普通碳件通常只保留“参考图颜色”。</small>
          </div>
          <div className="asset-reference-card">
            <div className="asset-reference-head">
              <div>
                <strong>生图参考图</strong>
                <span>可选。未上传时自动使用上面的展示图。</span>
              </div>
              <em>{generationReferenceDrafts.length} 张</em>
            </div>
            <label className="upload-field compact-upload reference-upload-button">
              <UploadCloud size={14} />
              <span>上传参考图</span>
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void uploadGenerationReference(event.target.files?.[0])} />
            </label>
            {generationReferenceDrafts.length > 0 ? (
              <div className="asset-reference-list">
                {generationReferenceDrafts.map((reference, index) => (
                  <div key={`${reference.url}-${index}`} className="asset-reference-chip">
                    <button type="button" className="reference-thumb-button" aria-label={`查看参考图 ${index + 1}`} onClick={() => setPreviewImage({ url: reference.url, label: `参考图 ${index + 1}` })}>
                      <img src={reference.url} alt="" />
                    </button>
                    <div className="asset-reference-editor">
                      <div className="asset-reference-editor-row">
                        <label>
                          Role
                          <select value={reference.role} onChange={(event) => updateGenerationReference(index, { role: event.target.value as PartReferenceRole })}>
                            {referenceRoleOptions.map((role) => (
                              <option key={role} value={role}>
                                {referenceRoleLabel(role)}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label>
                          View
                          <input value={reference.view} onChange={(event) => updateGenerationReference(index, { view: event.target.value })} placeholder="front_three_quarter" />
                        </label>
                        <label>
                          Priority
                          <input type="number" value={reference.priority} onChange={(event) => updateGenerationReference(index, { priority: Number(event.target.value) || 0 })} />
                        </label>
                      </div>
                      <label className="inline-check asset-reference-upload-check">
                        <input type="checkbox" checked={reference.uploadToModel} onChange={(event) => updateGenerationReference(index, { uploadToModel: event.target.checked })} />
                        上传给模型接口
                      </label>
                      <label>
                        Prompt hint
                        <textarea value={reference.promptHint} onChange={(event) => updateGenerationReference(index, { promptHint: event.target.value })} placeholder="只写这张参考图需要强调的可视特征。" />
                      </label>
                    </div>
                    <div className="asset-reference-actions">
                      <button type="button" aria-label={`查看参考图 ${index + 1}`} title="查看" onClick={() => setPreviewImage({ url: reference.url, label: `参考图 ${index + 1}` })}>
                        <Eye size={13} />
                      </button>
                      <button type="button" className="danger" aria-label={`删除参考图 ${index + 1}`} title="删除" onClick={() => removeGenerationReference(index)}>
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="asset-reference-empty">普通配件可以不传；机盖、尾翼、排气、灯罩、前唇建议补已安装角度图。</p>
            )}
            <div className="asset-view-guide">
              <span>系统推荐视角</span>
              <div>
                {displayedRecommendedViews.map((view) => (
                  <em key={view}>{view}</em>
                ))}
              </div>
            </div>
          </div>
                </div>
              </div>
            </div>
          </section>
          <section className={`asset-optional-panel ${assetPanelsOpen.advanced ? "open" : ""}`}>
            <button
              type="button"
              className="asset-optional-summary"
              aria-expanded={assetPanelsOpen.advanced}
              onClick={() => setAssetPanelsOpen((current) => ({ ...current, advanced: !current.advanced }))}
            >
              <span>高级设置</span>
              <small>generationReferences JSON，默认不用编辑</small>
            </button>
            <div className="asset-optional-content">
              <div className="asset-optional-content-inner">
            <label>
              生图参考图 JSON
              <textarea value={generationReferencesText} onChange={(event) => setGenerationReferencesText(event.target.value)} />
            </label>
            <label>
              覆盖推荐适用视角
              <input value={recommendedViewsText} onChange={(event) => setRecommendedViewsText(event.target.value)} placeholder={categoryRecommendedViews.join(", ")} />
            </label>
              </div>
            </div>
          </section>
          <section className={`asset-optional-panel ${assetPanelsOpen.quality ? "open" : ""}`}>
            <button
              type="button"
              className="asset-optional-summary"
              aria-expanded={assetPanelsOpen.quality}
              onClick={() => setAssetPanelsOpen((current) => ({ ...current, quality: !current.quality }))}
            >
              <span>质检记录</span>
              <small>{promptTestStatusLabel(promptTestStatus)} / {generationReady ? "已验收" : "未验收"}</small>
            </button>
            <div className="asset-optional-content">
              <div className="asset-optional-content-inner">
            <label>
              Prompt 测试状态
              <select value={promptTestStatus} onChange={(event) => setPromptTestStatus(event.target.value as typeof promptTestStatus)}>
                <option value="untested">未测试</option>
                <option value="pass">通过</option>
                <option value="weak">较弱</option>
                <option value="fail">失败</option>
              </select>
            </label>
            <label className="inline-check">
              <input type="checkbox" checked={generationReady} onChange={(event) => setGenerationReady(event.target.checked)} />
              生图已验收
            </label>
            <label>
              失败样本 / 入库备注
              <textarea value={badCaseNotes} onChange={(event) => setBadCaseNotes(event.target.value)} placeholder="例如：机盖需要补同车型安装图；尾翼在 45 度图中容易被忽略。" />
            </label>
              </div>
            </div>
          </section>
          <div className="asset-form-actions">
            <button type="submit">
              <UploadCloud size={16} />
              {editingAssetId ? "保存配件" : "新增配件"}
            </button>
            {editingAssetId && (
              <button type="button" className="secondary" onClick={resetAssetForm}>
                取消编辑
              </button>
            )}
          </div>
        </form>
      </section>
      {previewImage && (
        <div className="admin-image-lightbox" role="dialog" aria-modal="true" aria-label={previewImage.label} onClick={() => setPreviewImage(null)}>
          <div className="admin-image-lightbox-panel" onClick={(event) => event.stopPropagation()}>
            <header>
              <div>
                <strong>{previewImage.label}</strong>
                <span>{previewImage.url}</span>
              </div>
              <button type="button" onClick={() => setPreviewImage(null)} aria-label="关闭预览">
                <X size={18} />
              </button>
            </header>
            <img src={previewImage.url} alt={previewImage.label} />
          </div>
        </div>
      )}
    </div>
  )
}

function AssetRow({
  asset,
  qaIssues = [],
  onChanged,
  onEdit,
  sortKind,
  dragging = false,
  dragDisabled = false,
  onPointerDown,
}: {
  asset: PartAsset
  qaIssues?: AssetQaIssue[]
  onChanged: () => void
  onEdit?: () => void
  sortKind?: string
  dragging?: boolean
  dragDisabled?: boolean
  onPointerDown?: React.PointerEventHandler<HTMLButtonElement>
}) {
  const toggle = async () => {
    const response = await fetch(`/api/admin/assets/${asset.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !asset.active }),
    })
    if (response.ok) onChanged()
  }

  return (
    <motion.article
      layout
      transition={{ type: "spring", stiffness: 520, damping: 42, mass: 0.7 }}
      data-sort-kind={sortKind}
      data-sort-id={asset.id}
      className={`${asset.active ? "admin-asset-row" : "admin-asset-row disabled"} ${dragging ? "dragging" : ""}`}
    >
      <AdminAssetPreview asset={asset} />
      <div>
        <strong>
          {asset.brand} {asset.model}
        </strong>
        <span>
          {asset.variant} / {asset.finish}
        </span>
        <span>
          关键字: {asset.keywords || "-"}
        </span>
        <span>
          生图参考 {(asset.generationReferences ?? []).length} 张 / {promptTestStatusLabel(asset.promptTestStatus)} / {asset.generationReady ? "已验收" : "未验收"}
        </span>
        {qaIssues.length > 0 && (
          <div className="asset-qa-badges" aria-label="资产 QA 状态">
            {qaIssues.slice(0, 4).map((issue) => (
              <em key={issue.id} className={`asset-qa-badge ${issue.severity}`}>
                {issue.label}
              </em>
            ))}
            {qaIssues.length > 4 && <em className="asset-qa-badge info">+{qaIssues.length - 4}</em>}
          </div>
        )}
        <small>{asset.promptHint}</small>
      </div>
      <button
        type="button"
        className="drag-handle asset-drag-handle"
        draggable={false}
        disabled={dragDisabled}
        onPointerDown={onPointerDown}
        aria-label="拖拽排序"
        title="按住拖拽排序"
      >
        <ChevronsUpDown size={15} />
      </button>
      <div className="admin-asset-actions">
        {onEdit && <button type="button" onClick={onEdit}>编辑</button>}
        <button type="button" onClick={toggle}>{asset.active ? "停用" : "启用"}</button>
      </div>
    </motion.article>
  )
}

function AdminAssetPreview({ asset }: { asset: PartAsset }) {
  if (asset.imageUrl.endsWith("bbs-lmr-options.png")) {
    const [x = "50%", y = "50%"] = (asset.imageCrop || "50% 50%").split(" ")
    const cropX = Number.parseFloat(x)
    const cropY = Number.parseFloat(y)
    return (
      <span className="admin-wheel-crop">
        <img
          src={asset.imageUrl}
          alt={asset.model}
          style={
            {
              "--wheel-x": `${Number.isFinite(cropX) ? -cropX / 2 : -25}%`,
              "--wheel-y": `${Number.isFinite(cropY) ? -cropY / 2 : -25}%`,
            } as React.CSSProperties
          }
        />
      </span>
    )
  }
  return <img src={asset.imageUrl} alt={asset.model} />
}

const classicPaintMaterials = ["gloss", "metallic", "matte", "satin", "pearl", "chrome", "gradient"] as const

type ClassicPaintDraft = {
  id: string
  brand: string
  label: string
  labelZh: string
  labelEn: string
  brandAliases: string
  colorCode: string
  hex: string
  material: AdminSummary["classicPaints"][number]["material"]
  prompt: string
  active: boolean
  isDefault: boolean
  sortOrder: string
}

function emptyClassicPaintDraft(): ClassicPaintDraft {
  return {
    id: "",
    brand: "",
    label: "",
    labelZh: "",
    labelEn: "",
    brandAliases: "",
    colorCode: "",
    hex: "#1b4f9c",
    material: "metallic",
    prompt: "",
    active: true,
    isDefault: false,
    sortOrder: "100",
  }
}

function parseClassicPaintAliases(value: string) {
  const seen = new Set<string>()
  return value
    .split(/[\n,，、;；]+/)
    .map((item) => item.replace(/\s+/g, " ").trim())
    .filter((item) => {
      const key = item.toLowerCase()
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
}

function ClassicPaintManager({ summary, onChanged, notify }: { summary: AdminSummary; onChanged: () => void; notify: NotifyAdmin }) {
  const [editingId, setEditingId] = useState("")
  const [draft, setDraft] = useState<ClassicPaintDraft>(() => emptyClassicPaintDraft())
  const sortedPaints = useMemo(
    () => [...summary.classicPaints].sort((a, b) => Number(Boolean(b.isDefault)) - Number(Boolean(a.isDefault)) || a.brand.localeCompare(b.brand) || a.sortOrder - b.sortOrder || (a.labelEn || a.label).localeCompare(b.labelEn || b.label)),
    [summary.classicPaints],
  )

  const edit = (paint: AdminSummary["classicPaints"][number]) => {
    setEditingId(paint.id)
    setDraft({
      id: paint.id,
      brand: paint.brand,
      label: paint.label,
      labelZh: paint.labelZh,
      labelEn: paint.labelEn,
      brandAliases: (paint.brandAliases ?? []).join(", "),
      colorCode: paint.colorCode,
      hex: paint.hex,
      material: paint.material,
      prompt: paint.prompt,
      active: paint.active,
      isDefault: Boolean(paint.isDefault),
      sortOrder: String(paint.sortOrder),
    })
  }

  const reset = () => {
    setEditingId("")
    setDraft(emptyClassicPaintDraft())
  }

  const save = async () => {
    const payload = {
      id: draft.id,
      brand: draft.brand,
      label: draft.label || draft.labelEn || draft.labelZh,
      labelZh: draft.labelZh,
      labelEn: draft.labelEn,
      brandAliases: parseClassicPaintAliases(draft.brandAliases),
      colorCode: draft.colorCode,
      hex: draft.hex,
      material: draft.material,
      prompt: draft.prompt,
      active: draft.active,
      isDefault: draft.isDefault,
      sortOrder: Number(draft.sortOrder) || 100,
    }
    const response = await fetch(editingId ? `/api/admin/classic-paints/${editingId}` : "/api/admin/classic-paints", {
      method: editingId ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      notify("error", typeof body.error === "string" ? body.error : "经典色保存失败")
      return
    }
    notify("success", "经典色已保存")
    reset()
    onChanged()
  }

  const remove = async (paint: AdminSummary["classicPaints"][number]) => {
    const response = await fetch(`/api/admin/classic-paints/${paint.id}`, { method: "DELETE" })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      notify("error", typeof body.error === "string" ? body.error : "经典色删除失败")
      return
    }
    notify("success", "经典色已停用/删除")
    if (editingId === paint.id) reset()
    onChanged()
  }

  return (
    <section className="admin-panel classic-paint-panel">
      <PanelHeading label="车辆颜色" title="品牌经典色色卡" count={`${sortedPaints.length} 个色卡`} />
      <div className="classic-paint-layout">
        <form
          className="admin-form classic-paint-form"
          onSubmit={(event) => {
            event.preventDefault()
            void save()
          }}
        >
          <label>
            ID
            <input value={draft.id} placeholder="bmw-isle-of-man-green-metallic" onChange={(event) => setDraft((current) => ({ ...current, id: event.target.value }))} disabled={Boolean(editingId)} />
          </label>
          <label>
            品牌
            <input value={draft.brand} placeholder="BMW" onChange={(event) => setDraft((current) => ({ ...current, brand: event.target.value }))} />
          </label>
          <label className="wide-field">
            品牌识别关键字
            <textarea value={draft.brandAliases} placeholder="BMW, 宝马, M3, M4；或 Porsche, 911, 718" onChange={(event) => setDraft((current) => ({ ...current, brandAliases: event.target.value }))} />
          </label>
          <label>
            中文名
            <input value={draft.labelZh} placeholder="宝马阿布扎比蓝" onChange={(event) => setDraft((current) => ({ ...current, labelZh: event.target.value }))} />
          </label>
          <label>
            英文名
            <input value={draft.labelEn} placeholder="BMW Abu Dhabi Blue" onChange={(event) => setDraft((current) => ({ ...current, labelEn: event.target.value }))} />
          </label>
          <label>
            色号
            <input value={draft.colorCode} placeholder="C4G" onChange={(event) => setDraft((current) => ({ ...current, colorCode: event.target.value }))} />
          </label>
          <label>
            HEX
            <input value={draft.hex} placeholder="#1f4d3a" onChange={(event) => setDraft((current) => ({ ...current, hex: event.target.value }))} />
          </label>
          <label>
            车漆材质
            <select value={draft.material} onChange={(event) => setDraft((current) => ({ ...current, material: event.target.value as ClassicPaintDraft["material"] }))}>
              {classicPaintMaterials.map((material) => (
                <option key={material} value={material}>
                  {material}
                </option>
              ))}
            </select>
          </label>
          <label>
            排序
            <input value={draft.sortOrder} inputMode="numeric" onChange={(event) => setDraft((current) => ({ ...current, sortOrder: event.target.value }))} />
          </label>
          <label className="check-line">
            <input type="checkbox" checked={draft.active} onChange={(event) => setDraft((current) => ({ ...current, active: event.target.checked }))} />
            启用
          </label>
          <label className="check-line">
            <input type="checkbox" checked={draft.isDefault} onChange={(event) => setDraft((current) => ({ ...current, isDefault: event.target.checked }))} />
            默认经典色清单
          </label>
          <label className="wide-field">
            Prompt
            <textarea value={draft.prompt} placeholder="将车身漆面改为..." onChange={(event) => setDraft((current) => ({ ...current, prompt: event.target.value }))} />
          </label>
          <div className="classic-paint-actions">
            <button type="submit">{editingId ? "保存修改" : "新增经典色"}</button>
            {editingId && <button type="button" onClick={reset}>取消编辑</button>}
          </div>
        </form>
        <div className="classic-paint-list">
          {sortedPaints.map((paint) => (
            <article key={paint.id} className={paint.active ? "classic-paint-row" : "classic-paint-row disabled"}>
              <span className="classic-paint-swatch" style={{ background: paint.hex }} />
              <div>
                <strong>{paint.brand} {paint.labelZh || paint.label}</strong>
                <span>{paint.labelEn || paint.label} / {paint.colorCode || "-"} / {paint.material} / {paint.hex}{paint.isDefault ? " / Default" : ""}{paint.brandAliases?.length ? ` / 关键字: ${paint.brandAliases.join(", ")}` : ""}</span>
                <small>{paint.prompt}</small>
              </div>
              <button type="button" onClick={() => edit(paint)}>编辑</button>
              <button type="button" onClick={() => void remove(paint)}>{paint.active ? "停用" : "删除"}</button>
            </article>
          ))}
          {!sortedPaints.length && <div className="admin-empty">暂无经典色配置</div>}
        </div>
      </div>
    </section>
  )
}

type ProviderFormValue = { label: string; baseUrl: string; modelName: string; apiKey: string; consoleUrl: string; enabled: boolean; capabilities: ProviderCapability[] }
type ProviderTestResult = {
  id: string
  label: string
  modelName: string
  capabilities: ProviderCapability[]
  status: 'available' | 'unavailable' | 'skipped'
  latencyMs: number
  detail: string
}
type PromptTemplateForm = {
  id: string
  scope: PromptTemplateScope
  title: string
  body: string
  assetId: string
  combinationKey: string
  active: boolean
  sortOrder: number
}

function buildProviderForm(providers: AdminSummary["providers"]): Record<string, ProviderFormValue> {
  return Object.fromEntries(providers.map((provider) => [provider.id, providerToFormValue(provider)]))
}

function providerToFormValue(provider: AdminSummary["providers"][number]): ProviderFormValue {
  return {
    baseUrl: provider.baseUrl,
    label: provider.label,
    modelName: provider.modelName,
    apiKey: "",
    consoleUrl: provider.consoleUrl,
    enabled: provider.enabled,
    capabilities: provider.capabilities.length ? provider.capabilities : ["image_generation"],
  }
}

function providerPayloadFromForm(form: HTMLFormElement, fallback: ProviderFormValue): ProviderFormValue {
  const data = new FormData(form)
  const capabilities = data
    .getAll("capabilities")
    .map(String)
    .filter((item): item is ProviderCapability => ["llm", "vision", "image_generation", "embedding"].includes(item))
  return {
    label: String(data.get("label") ?? fallback.label).trim(),
    baseUrl: String(data.get("baseUrl") ?? fallback.baseUrl).trim(),
    modelName: String(data.get("modelName") ?? fallback.modelName).trim(),
    apiKey: String(data.get("apiKey") ?? ""),
    consoleUrl: String(data.get("consoleUrl") ?? fallback.consoleUrl).trim(),
    enabled: data.get("enabled") === "on",
    capabilities,
  }
}

function getActiveProviderId(providers: AdminSummary["providers"]): ProviderId {
  return (providers.find((provider) => provider.active)?.id ?? "mock") as ProviderId
}

const providerCapabilityGroups: Array<{ id: ProviderCapability; label: string; helper: string }> = [
  { id: "image_generation", label: "生图 / 修图模型", helper: "用于配置模式和对话模式的最终图片生成。" },
  { id: "vision", label: "多模态识别模型", helper: "用于车辆识别、配件图片识别、结果检查。" },
  { id: "llm", label: "大语言模型", helper: "用于对话需求解析、追问生成，不能用于生图或图片识别。" },
  { id: "embedding", label: "向量模型", helper: "预留给后续检索和相似资产匹配。" },
]

const providerCapabilityLabels: Record<ProviderCapability, string> = {
  llm: "LLM",
  vision: "Vision",
  image_generation: "Image",
  embedding: "向量模型",
}

const providerCapabilityShortLabels: Record<ProviderCapability, string> = {
  llm: "LLM",
  vision: "识别",
  image_generation: "生图",
  embedding: "向量",
}
function emptyPromptForm(scope: PromptTemplateScope): PromptTemplateForm {
  return { id: "", scope, title: "", body: "", assetId: "", combinationKey: "", active: true, sortOrder: 10 }
}

function promptTemplateToForm(template: PromptTemplate): PromptTemplateForm {
  return {
    id: template.id,
    scope: template.scope,
    title: template.title,
    body: template.body,
    assetId: template.assetId,
    combinationKey: template.combinationKey,
    active: template.active,
    sortOrder: template.sortOrder,
  }
}

function ProviderManagerV3({ summary, onChanged, notify }: { summary: AdminSummary; onChanged: () => void; notify: NotifyAdmin }) {
  const emptyProviderForm: ProviderFormValue = {
    label: "",
    baseUrl: "",
    modelName: "",
    apiKey: "",
    consoleUrl: "",
    enabled: true,
    capabilities: ["image_generation"],
  }
  const [form, setForm] = useState<Record<string, ProviderFormValue>>(() => buildProviderForm(summary.providers))
  const [showCreate, setShowCreate] = useState(false)
  const [newProvider, setNewProvider] = useState<ProviderFormValue>(emptyProviderForm)
  const [editingProviderId, setEditingProviderId] = useState<ProviderId | null>(null)
  const [testResults, setTestResults] = useState<ProviderTestResult[] | null>(null)
  const [testLoading, setTestLoading] = useState(false)

  useEffect(() => {
    setForm(buildProviderForm(summary.providers))
  }, [summary.providers])

  const providerFormValue = (id: ProviderId) => {
    const provider = summary.providers.find((item) => item.id === id)
    return provider ? providerToFormValue(provider) : undefined
  }

  const resetProviderForm = (id: ProviderId) => {
    const cleanValue = providerFormValue(id)
    if (!cleanValue) return
    setForm((current) => ({ ...current, [id]: cleanValue }))
  }

  const startEditingProvider = (id: ProviderId) => {
    resetProviderForm(id)
    setEditingProviderId(id)
  }

  const cancelEditingProvider = (id: ProviderId) => {
    resetProviderForm(id)
    setEditingProviderId(null)
  }

  const updateProviderForm = (id: ProviderId, patch: Partial<ProviderFormValue>) => {
    const defaults = providerFormValue(id) ?? emptyProviderForm
    setForm((current) => ({ ...current, [id]: { ...defaults, ...current[id], ...patch } }))
  }

  const toggleCapability = (id: ProviderId, capability: ProviderCapability, checked: boolean) => {
    const current = form[id]?.capabilities ?? []
    const capabilities = checked ? Array.from(new Set([...current, capability])) : current.filter((item) => item !== capability)
    updateProviderForm(id, { capabilities })
  }

  const toggleNewCapability = (capability: ProviderCapability, checked: boolean) => {
    setNewProvider((current) => ({
      ...current,
      capabilities: checked ? Array.from(new Set([...current.capabilities, capability])) : current.capabilities.filter((item) => item !== capability),
    }))
  }

  const saveProvider = async (id: ProviderId, payload: ProviderFormValue) => {
    if (!payload?.label.trim()) {
      notify("error", "请输入模型备注名称。")
      return
    }
    if (!payload.modelName.trim()) {
      notify("error", "请输入模型名称。")
      return
    }
    if (!payload.capabilities.length) {
      notify("error", "请至少勾选一个模型能力。")
      return
    }
    const response = await fetch("/api/admin/provider-configs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...payload }),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      notify("error", body.error || "模型 API 保存失败。")
      return
    }
    notify("success", "模型 API 已保存。")
    setForm((current) => ({ ...current, [id]: { ...payload, apiKey: "" } }))
    setEditingProviderId(null)
    onChanged()
  }

  const createProvider = async () => {
    if (!newProvider.label.trim()) {
      notify("error", "请输入模型备注名称。")
      return
    }
    if (!newProvider.modelName.trim()) {
      notify("error", "请输入模型名称。")
      return
    }
    if (!newProvider.capabilities.length) {
      notify("error", "请至少勾选一个模型能力。")
      return
    }
    const response = await fetch("/api/admin/provider-configs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newProvider),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      notify("error", body.error || "新增模型 API 失败。")
      return
    }
    notify("success", "新增模型 API 成功，可在 Workflow 节点中选择。")
    setNewProvider(emptyProviderForm)
    setShowCreate(false)
    onChanged()
  }

  const runProviderTest = async () => {
    setTestLoading(true)
    try {
      const response = await fetch("/api/admin/provider-configs/test-all", { method: "POST" })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        notify("error", body.error || "测试请求失败。")
        return
      }
      setTestResults(body.results ?? [])
    } catch {
      notify("error", "测试请求失败，请检查网络连接。")
    } finally {
      setTestLoading(false)
    }
  }

  return (
    <section className="admin-panel provider-manager">
      <div className="provider-create-row">
        <button type="button" onClick={() => setShowCreate((current) => !current)}>
          <ListPlus size={16} />
          新增模型 API
        </button>
        <button type="button" className="provider-test-button" onClick={() => void runProviderTest()} disabled={testLoading}>
          {testLoading ? <Loader2 size={16} className="spin" /> : <Zap size={16} />}
          {testLoading ? "测试中..." : "一键测试所有模型"}
        </button>
      </div>
      {showCreate && (
        <article className="provider-card provider-create-card">
          <PanelHeading label="新增模型" title="新建模型 API" />
          <ProviderFields
            value={newProvider}
            onChange={(patch) => setNewProvider((current) => ({ ...current, ...patch }))}
            onToggleCapability={toggleNewCapability}
          />
          <button type="button" onClick={() => void createProvider()}>
            <BadgeCheck size={16} />
            保存新增
          </button>
        </article>
      )}
      <div className="provider-sections">
        {providerCapabilityGroups.map((group) => {
          const providers = summary.providers.filter((provider) => provider.capabilities.includes(group.id))
          return (
            <section className="provider-section" key={group.id}>
              <div className="provider-section-title">
                <div>
                  <span>{providerCapabilityLabels[group.id]}</span>
                  <strong>{group.label}</strong>
                </div>
                <b>{providers.length} 个模型</b>
              </div>
              <div className="provider-grid">
                {providers.map((provider) => {
                  const isEditing = editingProviderId === provider.id
                  const persisted = providerToFormValue(provider)
                  const current = isEditing ? form[provider.id] ?? persisted : persisted
                  return (
                    <article className={provider.enabled ? "provider-card provider-summary-card" : "provider-card provider-summary-card provider-disabled"} key={`${group.id}-${provider.id}`}>
                      <PanelHeading label="模型 API" title={current.label || provider.label} />
                      <div className="provider-summary-meta">
                        <span>{provider.enabled ? "已启用" : "已停用"}</span>
                        <span>{provider.hasApiKey ? `Key ${provider.maskedKey}` : "未配置 Key"}</span>
                      </div>
                      <div className="provider-summary-lines">
                        <p>
                          <strong>URL</strong>
                          <span>{current.baseUrl || "未配置"}</span>
                        </p>
                        <p>
                          <strong>Model</strong>
                          <span>{current.modelName || "未配置"}</span>
                        </p>
                      </div>
                      <CapabilityPills capabilities={current.capabilities} />
                      {isEditing ? (
                        <form
                          className="provider-edit-form"
                          onSubmit={(event) => {
                            event.preventDefault()
                            const payload = providerPayloadFromForm(event.currentTarget, current)
                            setForm((draft) => ({ ...draft, [provider.id]: payload }))
                            void saveProvider(provider.id, payload)
                          }}
                        >
                          <ProviderFields
                            value={current}
                            onChange={(patch) => updateProviderForm(provider.id, patch)}
                            onToggleCapability={(capability, checked) => toggleCapability(provider.id, capability, checked)}
                          />
                          <div className="provider-card-actions">
                            <button type="submit">
                              <BadgeCheck size={16} />
                              保存
                            </button>
                            <button type="button" className="provider-secondary-button" onClick={() => cancelEditingProvider(provider.id)}>
                              取消
                            </button>
                          </div>
                        </form>
                      ) : (
                        <button type="button" className="provider-edit-button" onClick={() => startEditingProvider(provider.id)}>
                          编辑
                        </button>
                      )}
                    </article>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>
      {testResults && createPortal(<ProviderTestModal results={testResults} onClose={() => setTestResults(null)} />, document.body)}
    </section>
  )
}

function ProviderTestModal({ results, onClose }: { results: ProviderTestResult[]; onClose: () => void }) {
  const availableCount = results.filter((item) => item.status === "available").length
  const unavailableCount = results.filter((item) => item.status === "unavailable").length
  const skippedCount = results.filter((item) => item.status === "skipped").length
  const statusLabel: Record<ProviderTestResult["status"], string> = { available: "可用", unavailable: "不可用", skipped: "跳过" }
  const statusClass: Record<ProviderTestResult["status"], string> = { available: "provider-test-status-ok", unavailable: "provider-test-status-fail", skipped: "provider-test-status-skip" }
  return createPortal(
    <AnimatePresence>
      <motion.div className="provider-test-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
        <motion.div className="provider-test-modal" initial={{ scale: 0.95, y: 10 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 10 }} onClick={(event: React.MouseEvent) => event.stopPropagation()}>
          <div className="provider-test-modal-header">
            <div>
              <h3>模型可用性测试结果</h3>
              <p className="provider-test-summary">
                共 {results.length} 个模型 — <span className="provider-test-count-ok">{availableCount} 可用</span>，<span className="provider-test-count-fail">{unavailableCount} 不可用</span>，<span className="provider-test-count-skip">{skippedCount} 跳过</span>
              </p>
            </div>
            <button type="button" className="provider-test-close" onClick={onClose}>
              <X size={18} />
            </button>
          </div>
          <div className="provider-test-table-wrap">
            <table className="provider-test-table">
              <thead>
                <tr>
                  <th>模型备注名称</th>
                  <th>模型名称</th>
                  <th>能力</th>
                  <th>状态</th>
                  <th>耗时</th>
                  <th>详情</th>
                </tr>
              </thead>
              <tbody>
                {results.map((item) => (
                  <tr key={item.id}>
                    <td>{item.label}</td>
                    <td>{item.modelName}</td>
                    <td>{item.capabilities.map((capability) => providerCapabilityShortLabels[capability]).join(" / ")}</td>
                    <td>
                      <span className={`provider-test-status ${statusClass[item.status]}`}>{statusLabel[item.status]}</span>
                    </td>
                    <td>{item.latencyMs > 0 ? `${item.latencyMs}ms` : "-"}</td>
                    <td>{item.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  )
}

function ProviderFields({
  value,
  onChange,
  onToggleCapability,
}: {
  value: ProviderFormValue
  onChange: (patch: Partial<ProviderFormValue>) => void
  onToggleCapability: (capability: ProviderCapability, checked: boolean) => void
}) {
  return (
    <>
      <label>
        系统备注名称
        <input name="label" value={value.label} onChange={(event) => onChange({ label: event.target.value })} placeholder="例如：OpenAI Image 2.0" />
      </label>
      <label>
        API URL
        <input name="baseUrl" value={value.baseUrl} onChange={(event) => onChange({ baseUrl: event.target.value })} placeholder="https://api.example.com/v1" />
      </label>
      <label>
        模型名称
        <input name="modelName" value={value.modelName} onChange={(event) => onChange({ modelName: event.target.value })} placeholder="gpt-image / vision / llm model" />
      </label>
      <label>
        API Key
        <input name="apiKey" value={value.apiKey} onChange={(event) => onChange({ apiKey: event.target.value })} placeholder="留空则保持原 Key" />
      </label>
      <label>
        管理后台链接
        <input name="consoleUrl" value={value.consoleUrl} onChange={(event) => onChange({ consoleUrl: event.target.value })} placeholder="https://console.example.com" />
      </label>
      <div className="provider-capability-list">
        {providerCapabilityGroups.map((capability) => (
          <label className={value.capabilities.includes(capability.id) ? "provider-capability-chip selected" : "provider-capability-chip"} key={capability.id}>
            <input
              type="checkbox"
              name="capabilities"
              value={capability.id}
              checked={value.capabilities.includes(capability.id)}
              onChange={(event) => onToggleCapability(capability.id, event.target.checked)}
            />
            {providerCapabilityShortLabels[capability.id]}
          </label>
        ))}
      </div>
      <label className="check-line">
        <input type="checkbox" name="enabled" checked={value.enabled} onChange={(event) => onChange({ enabled: event.target.checked })} />
        启用模型接口
      </label>
    </>
  )
}

function CapabilityPills({ capabilities }: { capabilities: ProviderCapability[] }) {
  return (
    <div className="provider-summary-capabilities">
      {capabilities.map((capability) => (
        <span key={capability}>{providerCapabilityShortLabels[capability]}</span>
      ))}
    </div>
  )
}

const promptScopesV2: Array<{ id: PromptTemplateScope; label: string; helper: string }> = [
  { id: "config_base", label: "配置模式 Prompt", helper: "配置模式生成时使用的基础系统提示词。" },
  { id: "part", label: "配件 Prompt", helper: "绑定到单个配件，生成时随配件自动注入。" },
  { id: "combo", label: "组合 Prompt", helper: "多个配件或分类同时选中时触发，用于处理组合关系。" },
  { id: "chat_recommendation", label: "对话推荐 Prompt", helper: "前台对话框下拉展示的推荐提示词，由运营在这里维护。" },
  { id: "chat_optimizer", label: "用户输入优化 Prompt", helper: "后续用于重写用户自然语言输入，提升出图质量。" },
  { id: "negative", label: "Negative Prompt", helper: "统一负面约束，避免变形、水印、文字、跑题。" },
]

const generationPromptScopes: Array<{ id: PromptTemplateScope; label: string; helper: string }> = [
  { id: "base", label: "Base Prompt", helper: "所有生图共用，负责保留原车、背景、角度、光线和照片质感。" },
  { id: "config_mode", label: "配置模式 Prompt", helper: "配置模式专用，强调严格执行用户选择的资产库配件。" },
  { id: "chat_mode", label: "对话模式 Prompt", helper: "对话模式专用，强调使用用户上传的配件参考图。" },
  { id: "chat_parser", label: "对话解析 Prompt", helper: "对话模式专用，把自然语言解析为标准 JSON，不明确时返回追问。" },
  { id: "vehicle_recognition", label: "车辆识别提示词", helper: "图片识别 Workflow 使用，判断车辆、车型、视角和图片质量。" },
  { id: "part_recognition", label: "配件识别提示词", helper: "图片识别 Workflow 使用，识别用户上传的配件参考图类别。" },
  { id: "category", label: "分类 Prompt", helper: "轮毂、卡钳、尾翼、前唇等配件类别的通用规则。" },
  { id: "part", label: "单配件 Prompt", helper: "绑定到资产库单个配件，配置模式生成时自动注入。" },
  { id: "combo", label: "组合 Prompt", helper: "处理轮毂+卡钳、轮毂+车高等高风险组合关系。" },
  { id: "negative", label: "Negative Prompt", helper: "防止变形、水印、换背景、换车型等问题。" },
  { id: "result_check", label: "结果检查 Prompt", helper: "用于检查生成图是否包含核心元素并保持原图一致性。" },
  { id: "retry", label: "失败重试 Prompt", helper: "第一次检查失败后，用于强化缺失元素并修复坏图。" },
  { id: "chat_recommendation", label: "对话推荐 Prompt", helper: "前台对话框下拉展示的推荐提示词。" },
  { id: "chat_optimizer", label: "用户输入优化 Prompt", helper: "后续用于把用户自然语言改写成更稳定的生图指令。" },
]

function PromptTemplateManagerV2({ summary }: { summary: AdminSummary; onChanged: () => void; notify: NotifyAdmin }) {
  const [scope, setScope] = useState<PromptTemplateScope>("base")
  const [selectedId, setSelectedId] = useState("")
  const [form, setForm] = useState<PromptTemplateForm>(() => emptyPromptForm("base"))
  const [notice, setNotice] = useState("")
  const scopedTemplates = useMemo(
    () => summary.promptTemplates.filter((template) => template.scope === scope).sort((a, b) => a.sortOrder - b.sortOrder || b.updatedAt - a.updatedAt),
    [scope, summary.promptTemplates],
  )
  const activeScope = generationPromptScopes.find((item) => item.id === scope) ?? generationPromptScopes[0]
  const previewWorkflows = useMemo(
    () => summary.workflows.filter((workflow) => workflow.mode === "config" || workflow.mode === "chat"),
    [summary.workflows],
  )
  const [previewWorkflowId, setPreviewWorkflowId] = useState("")
  const selectedPreviewWorkflow = useMemo(
    () => previewWorkflows.find((workflow) => workflow.id === previewWorkflowId) ?? previewWorkflows[0],
    [previewWorkflowId, previewWorkflows],
  )
  const finalPromptPreview = useMemo(
    () => (selectedPreviewWorkflow ? buildPromptModuleFinalPreview(selectedPreviewWorkflow, summary) : null),
    [selectedPreviewWorkflow, summary],
  )

  useEffect(() => {
    if (selectedId && scopedTemplates.some((template) => template.id === selectedId)) return
    const first = scopedTemplates[0]
    setSelectedId(first?.id ?? "")
    setForm(first ? promptTemplateToForm(first) : emptyPromptForm(scope))
  }, [scope, scopedTemplates, selectedId])

  useEffect(() => {
    if (!previewWorkflows.length) {
      if (previewWorkflowId) setPreviewWorkflowId("")
      return
    }
    if (!previewWorkflows.some((workflow) => workflow.id === previewWorkflowId)) {
      setPreviewWorkflowId(previewWorkflows[0].id)
    }
  }, [previewWorkflowId, previewWorkflows])

  const selectTemplate = (template: PromptTemplate) => {
    setSelectedId(template.id)
    setForm(promptTemplateToForm(template))
    setNotice("")
  }

  return (
    <section className="admin-panel prompt-template-manager">
      <div className="prompt-scope-tabs">
        {generationPromptScopes.map((item) => {
          const count = summary.promptTemplates.filter((template) => template.scope === item.id).length
          return (
            <button
              key={item.id}
              className={scope === item.id ? "active" : ""}
              type="button"
              onClick={() => {
                setScope(item.id)
                setSelectedId("")
                setForm(emptyPromptForm(item.id))
                setNotice("")
              }}
            >
              <span>{item.label}</span>
              <small>{count} 条</small>
            </button>
          )
        })}
      </div>

      <div className="prompt-panel">
        <div>
          <PanelHeading label="PROMPT" title={activeScope.label} count={`${scopedTemplates.length} 条`} />
          <p className="prompt-helper">{activeScope.helper}</p>
          <div className="prompt-list">
            {scopedTemplates.map((template) => (
              <article key={template.id} className={template.id === form.id ? "selected" : ""} onClick={() => selectTemplate(template)}>
                <strong>{template.title || "未命名 Prompt"}</strong>
                <span>{template.active ? "启用" : "停用"} / 排序 {template.sortOrder}</span>
                <small>{template.body.slice(0, 110) || "暂无内容"}</small>
              </article>
            ))}
            {!scopedTemplates.length && (
              <article>
                <strong>暂无 Prompt</strong>
                <small>当前 scope 没有 Git seed 模板。</small>
              </article>
            )}
          </div>
        </div>

        <form
          className="admin-form wide"
          onSubmit={(event) => {
            event.preventDefault()
          }}
        >
          <PanelHeading label="Git seed" title={activeScope.label} />
          <label>
            标题
            <input value={form.title} readOnly placeholder="例如：BBS LM-R 轮毂安装 Prompt" />
          </label>
          {scope === "part" && (
            <label>
              绑定配件
              <select value={form.assetId} disabled>
                <option value="">请选择配件</option>
                {summary.assets.map((asset) => (
                  <option key={asset.id} value={asset.id}>
                    {asset.brand} {asset.model} {asset.variant}
                  </option>
                ))}
              </select>
            </label>
          )}
          {scope === "combo" && (
            <label>
              组合 Key
              <input value={form.combinationKey} readOnly placeholder="例如：wheels,brakes 或资产 ID 组合" />
            </label>
          )}
          <label>
            Prompt 内容
            <textarea value={form.body} readOnly placeholder="请输入后台内置 Prompt..." />
          </label>
          <div className="prompt-form-row">
            <label>
              排序
              <input type="number" value={form.sortOrder} readOnly />
            </label>
            <label className="check-line">
              <input type="checkbox" checked={form.active} readOnly />
              启用
            </label>
          </div>
          {notice && <small className="form-note">{notice}</small>}
        </form>
      </div>

      {finalPromptPreview && selectedPreviewWorkflow && (
        <section className="workflow-debug-panel prompt-final-preview">
          <div className="workflow-debug-head">
            <div>
              <strong>最终 Prompt 预览 / 调试</strong>
              <span>{finalPromptPreview.note}</span>
              <small>当前预览 Workflow：{selectedPreviewWorkflow.title}</small>
            </div>
            <select value={selectedPreviewWorkflow.id} onChange={(event) => setPreviewWorkflowId(event.target.value)}>
              {previewWorkflows.map((workflow) => (
                <option key={workflow.id} value={workflow.id}>
                  {workflow.title} / {workflowModePreviewLabel(workflow.mode)}
                </option>
              ))}
            </select>
          </div>

          <div className="workflow-prompt-id-list">
            {finalPromptPreview.templateIds.map((id) => (
              <span key={id}>{id}</span>
            ))}
          </div>

          <label>
            生图 Prompt
            <textarea readOnly value={finalPromptPreview.prompt} />
          </label>

          <div className="workflow-debug-split">
            <label>
              Negative Prompt
              <textarea readOnly value={finalPromptPreview.negativePrompt} />
            </label>
            <label>
              Result Check / Retry Prompt
              <textarea readOnly value={[finalPromptPreview.resultCheckPrompt, finalPromptPreview.retryPrompt].filter(Boolean).join("\n\n---\n\n")} />
            </label>
          </div>
        </section>
      )}
    </section>
  )
}

function promptPreviewWorkflowPromptIds(workflow: WorkflowConfig, templates: Array<{ id: string }>) {
  const nodePromptIds = workflow.nodes.map((node) => node.promptTemplateId).filter(Boolean)
  const requiredPromptIds =
    workflow.mode === "config"
      ? ["tpl_base_photo_edit", "tpl_config_mode_default", "tpl_config_base_default", "tpl_negative_default"]
      : workflow.mode === "chat"
        ? ["tpl_base_photo_edit", "tpl_chat_mode_default", "tpl_negative_default"]
        : []
  const availableIds = new Set(templates.map((template) => template.id))
  return Array.from(new Set([...workflow.promptTemplateIds, ...requiredPromptIds, ...nodePromptIds])).filter((id) => availableIds.has(id))
}

function buildPromptModuleFinalPreview(workflow: WorkflowConfig, summary: AdminSummary) {
  if (workflow.mode !== "config" && workflow.mode !== "chat") return null
  const preset = summary.prompts.find((prompt) => prompt.active) ?? summary.prompts[0]
  if (!preset) return null

  const promptIds = promptPreviewWorkflowPromptIds(workflow, summary.promptTemplates)
  const workflowTemplateIds = new Set(promptIds)
  const templates = summary.promptTemplates.filter(
    (template) => workflowTemplateIds.has(template.id) || template.scope === "part" || template.scope === "category" || template.scope === "combo",
  )
  const build = buildGenerationPrompt({
    spec: samplePromptPreviewSpec(workflow.mode, summary),
    preset,
    templates,
  })

  return {
    prompt: build.prompt,
    negativePrompt: build.negativePrompt,
    resultCheckPrompt: promptPreviewBodyByNodeType(workflow.nodes, summary.promptTemplates, "result_check"),
    retryPrompt: promptPreviewBodyByNodeType(workflow.nodes, summary.promptTemplates, "retry"),
    templateIds: Array.from(new Set([...promptIds, ...build.usedTemplateIds])),
    note: "使用示例车辆、示例颜色和示例配件生成；真实生图时会替换为用户上传图片、当前配置 JSON 和实际资源图。",
  }
}

function promptPreviewBodyByNodeType(nodes: WorkflowNodeConfig[], templates: PromptTemplate[], nodeType: WorkflowNodeConfig["type"]) {
  const promptTemplateId = nodes.find((node) => node.type === nodeType)?.promptTemplateId
  if (!promptTemplateId) return ""
  return templates.find((template) => template.id === promptTemplateId && template.active)?.body || ""
}

function samplePromptPreviewSpec(mode: "config" | "chat", summary: AdminSummary): GenerationStandardJson {
  const asset = summary.assets.find((item) => item.categoryId === "wheels") ?? summary.assets[0]
  const category = asset ? summary.categories.find((item) => item.id === asset.categoryId) : undefined
  const part: GenerationStandardJson["parts"][number] | null = asset
    ? {
        category: asset.categoryId,
        categoryLabel: category?.labelZh || category?.label || asset.categoryId,
        source: mode === "config" ? "asset_library" : "uploaded_reference",
        assetId: mode === "config" ? asset.id : "",
        brand: mode === "config" ? asset.brand : "",
        model: mode === "config" ? asset.model : "",
        variant: mode === "config" ? asset.variant : "",
        color: asset.color || "参考图颜色",
        finish: asset.finish || "参考图材质",
        colorPolicy: asset.defaultColorPolicy ?? "part_reference_color",
        colorPolicyPrompt:
          asset.defaultColorPolicy === "exposed_carbon"
            ? `Use exposed carbon only on ${category?.label || asset.categoryId}.`
            : asset.defaultColorPolicy === "body_color"
              ? `Paint-match ${category?.label || asset.categoryId} to the source vehicle body color.`
              : `Use the selected part reference color only for ${category?.label || asset.categoryId}.`,
        referenceImageUrl: mode === "config" ? asset.imageUrl : "user-upload://part-reference-1",
        referenceImages:
          mode === "config"
            ? (asset.generationReferences ?? []).map((reference) => ({
                url: reference.url,
                role: reference.role,
                view: reference.view,
                promptHint: reference.promptHint,
                priority: reference.priority,
                uploadToModel: reference.uploadToModel,
              }))
            : [
                {
                  url: "user-upload://part-reference-1",
                  role: "full_part_reference",
                  view: "uploaded",
                  promptHint: "用户上传参考图",
                  priority: 10,
                  uploadToModel: true,
                },
              ],
        instruction:
          mode === "config"
            ? asset.promptHint
            : "严格使用用户上传参考图中的配件外观，并自然安装到车辆对应位置。",
      }
    : null

  return {
    mode,
    vehicle: {
      model: "示例车辆：BMW M3",
      view: "前侧 45 度",
      sourceImageUrl: "user-upload://vehicle.jpg",
      confidence: 0.86,
    },
    paint: {
      action: "change",
      target: "纳多灰",
      prompt: "车身颜色指令：改为纳多灰，保持原图真实漆面反光、环境映射和车身钣金缝隙。",
    },
    stance: {
      value: 66,
      label: "齐平姿态，车身降低，轮胎与轮拱间隙更紧凑",
      prompt: "车高姿态指令：齐平姿态，车身降低，轮胎与轮拱间隙更紧凑，不改变车身结构和透视。",
    },
    parts: part ? [part] : [],
    style: {
      keywords: ["真实汽车摄影修图", "OEM+ 改装", "自然安装"],
      userText: mode === "config" ? "示例：使用后台配置生成改装效果。" : "示例：按我上传的配件参考图改装。",
      contextMode: "original",
    },
    constraints: {
      preserveBackground: true,
      preserveCameraAngle: true,
      preserveLighting: true,
      preserveLicensePlateShape: true,
      preserveVehicleIdentity: true,
      preserveUnselectedParts: true,
      selectedOnly: true,
    },
  }
}

function workflowModePreviewLabel(mode: WorkflowConfig["mode"]) {
  if (mode === "config") return "配置模式"
  if (mode === "chat") return "对话模式"
  return "识别模式"
}

function GuardrailManager({ summary, onChanged }: { summary: AdminSummary; onChanged: () => void }) {
  const [form, setForm] = useState<GuardrailConfig>(summary.guardrailConfig)
  const [notice, setNotice] = useState("")

  useEffect(() => {
    setForm(summary.guardrailConfig)
  }, [summary.guardrailConfig])

  const save = async () => {
    const response = await fetch("/api/admin/guardrail", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    const body = await response.json()
    if (!response.ok) {
      setNotice(body.error || "保存失败")
      return
    }
    setNotice("风控配置已保存")
    onChanged()
  }

  return (
    <section className="admin-panel guardrail-panel">
      <form className="admin-form wide" onSubmit={(event) => { event.preventDefault(); void save() }}>
        <PanelHeading label="风控 // SOP" title="对话与生成限制" />
        <label>
          SOP Workflow
          <textarea value={form.sop} onChange={(event) => setForm((current) => ({ ...current, sop: event.target.value }))} />
        </label>
        <label>
          合法需求说明
          <textarea value={form.allowedDescription} onChange={(event) => setForm((current) => ({ ...current, allowedDescription: event.target.value }))} />
        </label>
        <label>
          禁止词
          <textarea value={form.blockedTerms} onChange={(event) => setForm((current) => ({ ...current, blockedTerms: event.target.value }))} />
        </label>
        <label>
          对话模式推荐 Prompt（每行一个）
          <textarea value={form.recommendedPrompts} onChange={(event) => setForm((current) => ({ ...current, recommendedPrompts: event.target.value }))} />
        </label>
        <label>
          检测 Provider
          <select value={form.provider} onChange={(event) => setForm((current) => ({ ...current, provider: event.target.value as GuardrailConfig["provider"] }))}>
            <option value="mock">Mock 检测</option>
            {summary.providers.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.label}
              </option>
            ))}
          </select>
        </label>
        <label className="check-line">
          <input type="checkbox" checked={form.mockMode} onChange={(event) => setForm((current) => ({ ...current, mockMode: event.target.checked }))} />
          使用 Mock 检测
        </label>
        <label className="check-line">
          <input type="checkbox" checked={form.mockFailUploads} onChange={(event) => setForm((current) => ({ ...current, mockFailUploads: event.target.checked }))} />
          模拟上传检测失败
        </label>
        <button type="submit">
          <ShieldCheck size={16} />
          保存风控配置
        </button>
        {notice && <small className="form-note">{notice}</small>}
      </form>
      <div className="guardrail-copy">
        <PanelHeading label="流程" title="生成 SOP" />
        <p>1. 识别车型、颜色、改件、风格和视角。</p>
        <p>2. 将需求结构化为 JSON，并匹配后台资产库。</p>
        <p>3. 组装基础 Prompt、配件 Prompt、组合 Prompt 和 Negative Prompt。</p>
        <p>4. 调用当前全局模型，结果失败时自动强化缺失元素并重试一次。</p>
      </div>
    </section>
  )
}

function DomainConfigManager({ summary, onChanged, notify }: { summary: AdminSummary; onChanged: () => void; notify: NotifyAdmin }) {
  const [form, setForm] = useState<SiteConfig>(summary.siteConfig)
  const [effectiveBaseUrl, setEffectiveBaseUrl] = useState("")

  useEffect(() => {
    setForm(summary.siteConfig)
    void fetchEffectiveBaseUrl()
  }, [summary.siteConfig])

  const fetchEffectiveBaseUrl = async () => {
    try {
      const response = await fetch("/api/admin/site-config")
      if (response.ok) {
        const body = await response.json()
        setEffectiveBaseUrl(body.effectiveBaseUrl || "")
      }
    } catch {
      // Keep the last known effective URL on fetch failure.
    }
  }

  const samplePath = "/uploads/vehicle-1722345678901-a3b4c5d6.jpg"
  const sampleUrl = effectiveBaseUrl
    ? new URL(samplePath, effectiveBaseUrl).toString()
    : "(需配置公网域名后可见示例)"

  const save = async () => {
    const response = await fetch("/api/admin/site-config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publicAssetBaseUrl: form.publicAssetBaseUrl }),
    })
    const body = await response.json()
    if (!response.ok) {
      notify("error", body.error || "保存失败")
      return
    }
    setForm({ id: body.id, publicAssetBaseUrl: body.publicAssetBaseUrl, updatedAt: body.updatedAt })
    setEffectiveBaseUrl(body.effectiveBaseUrl || "")
    notify("success", "域名已保存")
    onChanged()
  }

  return (
    <section className="admin-panel guardrail-panel">
      <form className="admin-form wide" onSubmit={(event) => { event.preventDefault(); void save() }}>
        <PanelHeading label="域名 // 公网" title="PUBLIC_ASSET_BASE_URL" />
        <label>
          公网域名
          <input
            type="text"
            value={form.publicAssetBaseUrl}
            placeholder="https://example.com"
            onChange={(event) => setForm((current) => ({ ...current, publicAssetBaseUrl: event.target.value }))}
          />
        </label>
        <div className="guardrail-copy">
          <PanelHeading label="当前生效" title="生图 API 使用的域名" />
          <p>{effectiveBaseUrl || "(未配置 — 无数据库域名且无环境变量，Nano-Banana / Gemini 将无法调用)"}</p>
        </div>
        <div className="guardrail-copy">
          <PanelHeading label="拼接示例" title="生图 API 图片链接" />
          <p>域名：{effectiveBaseUrl || "(未配置)"}</p>
          <p>路径：{samplePath}</p>
          <p>结果：{sampleUrl}</p>
        </div>
        <small className="form-note">
          配置后，调用 Nano-Banana / Gemini 等需要公网图片 URL 的生图 Provider 时，将使用此域名拼接图片链接。留空则回退到环境变量 PROVIDER_PUBLIC_BASE_URL / NEXT_PUBLIC_APP_URL / APP_URL / SITE_URL。
        </small>
        <button type="submit">
          <Globe size={16} />
          保存域名配置
        </button>
      </form>
    </section>
  )
}

function normalizePlanDraft(plan: MembershipPlan): MembershipPlan {
  const next: MembershipPlan = {
    ...plan,
    label: plan.label.trim(),
    priceCents: Math.max(0, Math.round(Number(plan.priceCents) || 0)),
    configLimit: Math.max(0, Math.round(Number(plan.configLimit) || 0)),
    chatDailyLimit: Math.max(0, Math.round(Number(plan.chatDailyLimit) || 0)),
  }

  if (next.configUnlimited) {
    next.configLimit = 0
  }

  if (!next.chatEnabled) {
    next.chatUnlimited = false
    next.chatDailyLimit = 0
  } else if (next.chatUnlimited) {
    next.chatDailyLimit = 0
  }

  return next
}

function planValidationError(plan: MembershipPlan) {
  if (!plan.label.trim()) return "请填写套餐名称"
  if (!plan.configUnlimited && plan.configLimit <= 0) return "配置模式未设置不限时，请填写大于 0 的配置生成次数"
  if (plan.chatEnabled && !plan.chatUnlimited && plan.chatDailyLimit <= 0) return "已开放对话模式且未设置不限时，请填写大于 0 的每日对话次数"
  return ""
}

function centsToYuanInput(priceCents: number) {
  const amount = priceCents / 100
  return Number.isInteger(amount) ? String(amount) : String(Number(amount.toFixed(2)))
}

function yuanInputToCents(value: string) {
  if (value.trim() === "") return 0
  const amount = Number(value)
  if (!Number.isFinite(amount)) return 0
  return Math.max(0, Math.round(amount * 100))
}

function PlanManagerV2({ summary, onChanged, notify }: { summary: AdminSummary; onChanged: () => void; notify: NotifyAdmin }) {
  const dirtyPlanIdsRef = useRef<Set<string>>(new Set())
  const [dirtyPlanIds, setDirtyPlanIds] = useState<Set<string>>(() => new Set())
  const [plans, setPlans] = useState<Record<string, MembershipPlan>>(() => Object.fromEntries(summary.plans.map((plan) => [plan.id, plan])))

  useEffect(() => {
    setPlans((current) =>
      Object.fromEntries(
        summary.plans.map((plan) => {
          const isDirty = dirtyPlanIdsRef.current.has(plan.id)
          return [plan.id, isDirty ? current[plan.id] ?? plan : plan]
        }),
      ),
    )
  }, [summary.plans])

  const markDirty = (planId: string) => {
    const next = new Set(dirtyPlanIdsRef.current)
    next.add(planId)
    dirtyPlanIdsRef.current = next
    setDirtyPlanIds(next)
  }

  const clearDirty = (planId: string) => {
    const next = new Set(dirtyPlanIdsRef.current)
    next.delete(planId)
    dirtyPlanIdsRef.current = next
    setDirtyPlanIds(next)
  }

  const updatePlan = (plan: MembershipPlan, updater: (current: MembershipPlan) => MembershipPlan) => {
    setPlans((current) => {
      const base = current[plan.id] ?? plan
      return { ...current, [plan.id]: normalizePlanDraft(updater(base)) }
    })
    markDirty(plan.id)
  }

  const save = async (plan: MembershipPlan) => {
    const payload = normalizePlanDraft(plan)
    const validation = planValidationError(payload)
    if (validation) {
      notify("error", validation)
      return
    }

    const response = await fetch("/api/admin/plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      notify("error", typeof body.error === "string" ? body.error : "套餐保存失败")
      return
    }
    const savedPlan = body as MembershipPlan
    clearDirty(plan.id)
    setPlans((current) => ({ ...current, [plan.id]: savedPlan }))
    notify("success", "套餐保存成功")
    onChanged()
  }

  return (
    <section className="admin-panel provider-grid">
      {summary.plans.map((plan) => {
        const form = plans[plan.id] ?? plan
        const isDirty = dirtyPlanIds.has(plan.id)
        const configLimitDisabled = form.configUnlimited
        const chatLimitDisabled = !form.chatEnabled || form.chatUnlimited
        return (
          <article className="provider-card" key={plan.id}>
            <PanelHeading label={isDirty ? "会员套餐（未保存）" : "会员套餐"} title={form.label || "未命名套餐"} />
            <label>
              套餐名称
              <input value={form.label} onChange={(event) => updatePlan(plan, (current) => ({ ...current, label: event.target.value }))} />
            </label>
            <label>
              价格（元）
              <input
                type="number"
                min={0}
                step="0.01"
                value={centsToYuanInput(form.priceCents)}
                onChange={(event) => updatePlan(plan, (current) => ({ ...current, priceCents: yuanInputToCents(event.target.value) }))}
              />
            </label>
            <label>
              配置模式次数
              <input
                type="number"
                min={1}
                disabled={configLimitDisabled}
                placeholder={configLimitDisabled ? "不限" : "请输入次数"}
                value={configLimitDisabled ? "" : form.configLimit > 0 ? form.configLimit : ""}
                onChange={(event) => updatePlan(plan, (current) => ({ ...current, configLimit: event.target.value === "" ? 0 : Number(event.target.value) }))}
              />
            </label>
            <label>
              每日对话次数
              <input
                type="number"
                min={1}
                disabled={chatLimitDisabled}
                placeholder={!form.chatEnabled ? "未开放" : form.chatUnlimited ? "不限" : "请输入次数"}
                value={chatLimitDisabled ? "" : form.chatDailyLimit > 0 ? form.chatDailyLimit : ""}
                onChange={(event) => updatePlan(plan, (current) => ({ ...current, chatDailyLimit: event.target.value === "" ? 0 : Number(event.target.value) }))}
              />
            </label>
            <label className="check-line">
              <input
                type="checkbox"
                checked={form.configUnlimited}
                onChange={(event) => updatePlan(plan, (current) => ({ ...current, configUnlimited: event.target.checked }))}
              />
              配置模式次数不限
            </label>
            <label className="check-line">
              <input
                type="checkbox"
                checked={form.chatEnabled}
                onChange={(event) =>
                  updatePlan(plan, (current) => ({
                    ...current,
                    chatEnabled: event.target.checked,
                    chatUnlimited: event.target.checked ? current.chatUnlimited : false,
                    chatDailyLimit: event.target.checked ? current.chatDailyLimit : 0,
                  }))
                }
              />
              开放对话模式
            </label>
            <label className="check-line">
              <input
                type="checkbox"
                checked={form.chatEnabled && form.chatUnlimited}
                disabled={!form.chatEnabled}
                onChange={(event) => updatePlan(plan, (current) => ({ ...current, chatUnlimited: event.target.checked }))}
              />
              对话次数不限
            </label>
            <label className="check-line">
              <input type="checkbox" checked={form.active} onChange={(event) => updatePlan(plan, (current) => ({ ...current, active: event.target.checked }))} />
              启用套餐
            </label>
            <button type="button" onClick={() => void save(form)}>
              <BadgeCheck size={16} />
              保存套餐
            </button>
          </article>
        )
      })}
    </section>
  )
}

const emptyAvatarDraft = {
  id: "",
  label: "",
  imageUrl: "",
  active: true,
  sortOrder: 100,
}

function AvatarPresetManager({ summary, onChanged, notify }: { summary: AdminSummary; onChanged: () => void; notify: NotifyAdmin }) {
  const [draft, setDraft] = useState(emptyAvatarDraft)
  const presets = useMemo(() => [...summary.avatarPresets].sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt - b.createdAt || a.id.localeCompare(b.id)), [summary.avatarPresets])

  const create = async () => {
    const response = await fetch("/api/admin/avatar-presets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    })
    if (!response.ok) {
      notify("error", await readAdminError(response, "头像预设新增失败"))
      return
    }
    setDraft(emptyAvatarDraft)
    notify("success", "头像预设已新增")
    onChanged()
  }

  return (
    <section className="admin-ops-stack avatar-admin-panel">
      <article className="admin-panel provider-card avatar-admin-form">
        <PanelHeading label="AVATAR" title="新增头像预设" count={`${presets.length} 个预设`} />
        <label>
          头像 ID
          <input value={draft.id} placeholder="custom_avatar" onChange={(event) => setDraft((current) => ({ ...current, id: event.target.value }))} />
        </label>
        <label>
          名称
          <input value={draft.label} placeholder="头像名称" onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))} />
        </label>
        <label>
          图片 URL
          <input value={draft.imageUrl} placeholder="/assets/avatars/custom.png" onChange={(event) => setDraft((current) => ({ ...current, imageUrl: event.target.value }))} />
        </label>
        <label>
          排序
          <input type="number" value={draft.sortOrder} onChange={(event) => setDraft((current) => ({ ...current, sortOrder: Number(event.target.value) }))} />
        </label>
        <label className="check-line">
          <input type="checkbox" checked={draft.active} onChange={(event) => setDraft((current) => ({ ...current, active: event.target.checked }))} />
          启用
        </label>
        <button type="button" onClick={() => void create()}>
          <BadgeCheck size={16} />
          新增头像
        </button>
      </article>

      <div className="avatar-admin-grid">
        {presets.map((preset) => (
          <AvatarPresetCard key={preset.id} preset={preset} onChanged={onChanged} notify={notify} />
        ))}
      </div>
    </section>
  )
}

function AvatarPresetCard({ preset, onChanged, notify }: { preset: AccountAvatarPreset; onChanged: () => void; notify: NotifyAdmin }) {
  const [draft, setDraft] = useState({
    label: preset.label,
    imageUrl: preset.imageUrl,
    active: preset.active,
    sortOrder: preset.sortOrder,
  })

  useEffect(() => {
    setDraft({
      label: preset.label,
      imageUrl: preset.imageUrl,
      active: preset.active,
      sortOrder: preset.sortOrder,
    })
  }, [preset])

  const isDefault = preset.id === "person_default"
  const save = async () => {
    const response = await fetch(`/api/admin/avatar-presets/${encodeURIComponent(preset.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(draft),
    })
    if (!response.ok) {
      notify("error", await readAdminError(response, "头像预设保存失败"))
      return
    }
    notify("success", "头像预设已保存")
    onChanged()
  }

  const remove = async () => {
    const response = await fetch(`/api/admin/avatar-presets/${encodeURIComponent(preset.id)}`, { method: "DELETE" })
    if (!response.ok) {
      notify("error", await readAdminError(response, "头像预设删除失败"))
      return
    }
    notify("success", "头像预设已删除")
    onChanged()
  }

  return (
    <article className="admin-panel provider-card avatar-admin-card">
      <div className="avatar-admin-preview">
        <img src={draft.imageUrl || preset.imageUrl} alt="" />
        <span>{preset.builtIn ? "内置" : "自定义"}</span>
      </div>
      <strong>{preset.id}</strong>
      <label>
        名称
        <input value={draft.label} onChange={(event) => setDraft((current) => ({ ...current, label: event.target.value }))} />
      </label>
      <label>
        图片 URL
        <input value={draft.imageUrl} onChange={(event) => setDraft((current) => ({ ...current, imageUrl: event.target.value }))} />
      </label>
      <label>
        排序
        <input type="number" value={draft.sortOrder} onChange={(event) => setDraft((current) => ({ ...current, sortOrder: Number(event.target.value) }))} />
      </label>
      <label className="check-line">
        <input
          type="checkbox"
          checked={draft.active}
          disabled={isDefault}
          onChange={(event) => setDraft((current) => ({ ...current, active: event.target.checked }))}
        />
        启用
      </label>
      <div className="avatar-admin-actions">
        <button type="button" onClick={() => void save()}>
          <BadgeCheck size={16} />
          保存
        </button>
        <button type="button" disabled={isDefault} onClick={() => void remove()}>
          <Trash2 size={16} />
          删除
        </button>
      </div>
    </article>
  )
}

function BadCaseOpsTable({ summary }: { summary: AdminSummary }) {
  return (
    <section className="admin-ops-stack">
      <article className="admin-panel data-table admin-failure-panel">
        <PanelHeading label="失败日志" title="生成失败记录" count={`${summary.generationFailures.length} 条`} />
        <table className="admin-failure-table">
          <colgroup>
            <col className="failure-col-time" />
            <col className="failure-col-user" />
            <col className="failure-col-mode" />
            <col className="failure-col-provider" />
            <col className="failure-col-reason" />
            <col className="failure-col-meta" />
          </colgroup>
          <thead>
            <tr>
              <th>时间</th>
              <th>用户</th>
              <th>模式</th>
              <th>模型接口</th>
              <th>失败原因</th>
              <th>处理信息</th>
            </tr>
          </thead>
          <tbody>
            {summary.generationFailures.map((row) => (
              <tr key={row.generationId}>
                <td>{formatAdminDate(row.createdAt)}</td>
                <td>{row.userLabel}</td>
                <td>{row.mode}</td>
                <td className="admin-provider-cell" title={row.provider}>
                  {row.provider}
                </td>
                <td className="admin-wrap-cell admin-failure-reason">{row.failureReason || "未记录"}</td>
                <td className="admin-failure-meta-cell">
                  <div className="admin-failure-meta">
                    {renderAdminTags(row.badCaseTags, "无标签", 2)}
                    <span className="admin-id-chip" title={row.generationId}>
                      {row.generationId}
                    </span>
                  </div>
                </td>
              </tr>
            ))}
            {!summary.generationFailures.length && (
              <tr>
                <td colSpan={6}>暂无生成失败记录</td>
              </tr>
            )}
          </tbody>
        </table>
      </article>

      <article className="admin-panel data-table">
        <PanelHeading label="BAD CASE" title="质量问题样本" count={`${summary.badCases.length} 条`} />
        <table>
          <thead>
            <tr>
              <th>时间</th>
              <th>模式</th>
              <th>类型</th>
              <th>摘要</th>
              <th>生成记录</th>
            </tr>
          </thead>
          <tbody>
            {summary.badCases.map((row) => (
              <tr key={row.id}>
                <td>{formatAdminDate(row.createdAt)}</td>
                <td>{row.mode}</td>
                <td>{row.badCaseType}</td>
                <td className="admin-wrap-cell">{row.summary}</td>
                <td>{row.generationId}</td>
              </tr>
            ))}
            {!summary.badCases.length && (
              <tr>
                <td colSpan={5}>暂无失败样本</td>
              </tr>
            )}
          </tbody>
        </table>
      </article>

    </section>
  )
}

const platformLabels: Record<string, string> = {
  "https://shengsuanyun.com": "胜算云",
  "https://yunwu.ai": "云雾 AI",
  "https://app.302.ai": "302.AI",
  "https://platform.openai.com": "OpenAI 官方",
}

function CostViewPanel({ summary }: { summary: AdminSummary }) {
  const externalProviders = summary.providers.filter(
    (p) => p.consoleUrl && p.id !== "mock" && p.id !== "mock-vision" && p.id !== "mock-llm",
  )
  const uniquePlatforms = new Map<string, { label: string; consoleUrl: string; models: string[] }>()
  for (const provider of externalProviders) {
    const existing = uniquePlatforms.get(provider.consoleUrl)
    if (existing) {
      existing.models.push(provider.modelName)
    } else {
      uniquePlatforms.set(provider.consoleUrl, {
        label: platformLabels[provider.consoleUrl] || provider.label,
        consoleUrl: provider.consoleUrl,
        models: [provider.modelName],
      })
    }
  }

  return (
    <section className="admin-ops-stack">
      <div className="admin-ops-grid">
        {Array.from(uniquePlatforms.values()).map((platform) => (
          <a
            key={platform.consoleUrl}
            href={platform.consoleUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="admin-panel admin-metric-card"
            style={{ textDecoration: "none", cursor: "pointer" }}
          >
            <span className="admin-provider-stat-name">{platform.label}</span>
            <strong>点击查看</strong>
            <small>{platform.models.join(", ")}</small>
            <em>在新标签页中打开管理后台</em>
          </a>
        ))}
        {!uniquePlatforms.size && (
          <article className="admin-panel admin-metric-card">
            <span>暂无外部供应商</span>
            <strong>-</strong>
            <small>请在"模型 API"菜单中配置供应商管理后台链接</small>
          </article>
        )}
      </div>
    </section>
  )
}

type QuotaDraft = {
  mode: "config" | "chat"
  delta: string
  reason: string
  saving: boolean
}

type UserEditDraft = {
  role: "user" | "admin"
  plan: string
  status: "active" | "disabled"
  saving: boolean
}

const defaultQuotaDraft: QuotaDraft = {
  mode: "config",
  delta: "1",
  reason: "",
  saving: false,
}

function UsersOpsTable({ summary, onChanged, notify, onOpenUserDetail }: { summary: AdminSummary; onChanged: () => void; notify: NotifyAdmin; onOpenUserDetail?: (userId: string) => void }) {
  const [drafts, setDrafts] = useState<Record<string, QuotaDraft>>({})
  const [userDrafts, setUserDrafts] = useState<Record<string, UserEditDraft>>({})
  const [query, setQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "disabled">("all")

  const filteredUsers = summary.users.filter((user) => {
    const haystack = `${user.name} ${user.username} ${user.phone} ${user.email} ${user.id}`.toLowerCase()
    const matchesQuery = !query.trim() || haystack.includes(query.trim().toLowerCase())
    const matchesStatus = statusFilter === "all" || user.status === statusFilter
    return matchesQuery && matchesStatus
  })

  const patchDraft = (userId: string, patch: Partial<QuotaDraft>) => {
    setDrafts((current) => ({
      ...current,
      [userId]: { ...(current[userId] || defaultQuotaDraft), ...patch },
    }))
  }

  const userDraftFor = (user: AdminSummary["users"][number]): UserEditDraft => {
    return userDrafts[user.id] || {
      role: user.role === "admin" ? "admin" : "user",
      plan: user.plan || "free",
      status: user.status || "active",
      saving: false,
    }
  }

  const patchUserDraft = (user: AdminSummary["users"][number], patch: Partial<UserEditDraft>) => {
    setUserDrafts((current) => ({
      ...current,
      [user.id]: { ...userDraftFor(user), ...patch },
    }))
  }

  const saveUser = async (user: AdminSummary["users"][number]) => {
    const draft = userDraftFor(user)
    patchUserDraft(user, { saving: true })
    try {
      const response = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: draft.role, plan: draft.plan, status: draft.status }),
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string }
        notify("error", body.error || "User update failed")
        return
      }
      notify("success", "User updated")
      setUserDrafts((current) => {
        const next = { ...current }
        delete next[user.id]
        return next
      })
      onChanged()
    } finally {
      patchUserDraft(user, { saving: false })
    }
  }

  const adjustQuota = async (userId: string) => {
    const draft = drafts[userId] || defaultQuotaDraft
    const delta = Number(draft.delta)
    if (!Number.isFinite(delta) || Math.trunc(delta) === 0) {
      notify("error", "额度调整值必须是非 0 整数")
      return
    }
    if (!draft.reason.trim()) {
      notify("error", "请填写额度调整原因")
      return
    }
    patchDraft(userId, { saving: true })
    try {
      const response = await fetch("/api/admin/quota-adjustments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          mode: draft.mode,
          delta: Math.trunc(delta),
          reason: draft.reason.trim(),
        }),
      })
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string }
        notify("error", body.error || "额度调整失败")
        return
      }
      notify("success", "额度已调整")
      patchDraft(userId, { reason: "", saving: false })
      onChanged()
    } finally {
      patchDraft(userId, { saving: false })
    }
  }

  return (
    <section className="admin-ops-stack">
      <article className="admin-panel data-table">
        <PanelHeading label="账号 // 用户" title="用户管理与额度调整" count={`${summary.users.length} 个用户`} />
        <p className="admin-inline-help">额度调整填正数表示发放额外额度，填负数表示扣减额度；点击“保存调整”后立即生效，并写入审计日志。</p>
        <table className="admin-users-table">
          <colgroup>
            <col className="admin-users-col-user" />
            <col className="admin-users-col-account" />
            <col className="admin-users-col-role" />
            <col className="admin-users-col-plan" />
            <col className="admin-users-col-quota" />
            <col className="admin-users-col-quota" />
            <col className="admin-users-col-adjust" />
          </colgroup>
          <thead>
            <tr>
              <th>用户</th>
              <th>账号</th>
              <th>角色</th>
              <th>套餐</th>
              <th>配置额度</th>
              <th>对话额度</th>
              <th>额度调整（+发放 / -扣减）</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colSpan={7}>
                <div className="admin-inline-form admin-users-filter-form">
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search user, phone, email" />
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value === "disabled" ? "disabled" : event.target.value === "active" ? "active" : "all")}>
                    <option value="all">All statuses</option>
                    <option value="active">Active</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>
              </td>
            </tr>
            {filteredUsers.map((user) => {
              const draft = drafts[user.id] || defaultQuotaDraft
              const userDraft = userDraftFor(user)
              return (
                <tr key={user.id}>
                  <td className="admin-user-identity-cell">
                    <strong>{user.name || user.username || user.id}</strong>
                    <small className="admin-cell-sub">{user.phone || user.email || user.id}</small>
                    {onOpenUserDetail && (
                      <button type="button" className="admin-user-detail-link" onClick={() => onOpenUserDetail(user.id)}>
                        查看详情
                      </button>
                    )}
                  </td>
                  <td className="admin-user-account-cell">{user.username}</td>
                  <td className="admin-user-role-cell">
                    <select value={userDraft.role} onChange={(event) => patchUserDraft(user, { role: event.target.value === "admin" ? "admin" : "user" })}>
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                    <small className="admin-cell-sub">{user.status}</small>
                  </td>
                  <td className="admin-user-plan-cell">
                    <select value={userDraft.plan} onChange={(event) => patchUserDraft(user, { plan: event.target.value })}>
                      <option value="free">free</option>
                      <option value="pro">pro</option>
                      <option value="max">max</option>
                      <option value="internal">internal</option>
                    </select>
                    <select value={userDraft.status} onChange={(event) => patchUserDraft(user, { status: event.target.value === "disabled" ? "disabled" : "active" })}>
                      <option value="active">active</option>
                      <option value="disabled">disabled</option>
                    </select>
                    <button type="button" disabled={userDraft.saving} onClick={() => void saveUser(user)}>
                      {userDraft.saving ? "Saving" : "Save user"}
                    </button>
                  </td>
                  <td className="admin-user-quota-summary">
                    {formatAdminQuota(user.configRemaining)}
                    <small className="admin-cell-sub">已用 {user.configUsed}</small>
                  </td>
                  <td className="admin-user-quota-summary">
                    {formatAdminQuota(user.chatRemainingToday)}
                    <small className="admin-cell-sub">今日已用 {user.chatUsedToday}</small>
                  </td>
                  <td className="admin-quota-cell">
                    <div className="admin-inline-form admin-quota-adjust-form">
                      <select aria-label="调整额度类型" value={draft.mode} onChange={(event) => patchDraft(user.id, { mode: event.target.value === "chat" ? "chat" : "config" })}>
                        <option value="config">配置</option>
                        <option value="chat">对话</option>
                      </select>
                      <input aria-label="调整额度数量" type="number" step={1} value={draft.delta} onChange={(event) => patchDraft(user.id, { delta: event.target.value })} />
                      <input className="quota-reason-input" aria-label="额度调整原因" value={draft.reason} onChange={(event) => patchDraft(user.id, { reason: event.target.value })} placeholder="原因（必填）" />
                      <button type="button" disabled={draft.saving} onClick={() => void adjustQuota(user.id)}>
                        {draft.saving ? "保存中" : "保存调整"}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </article>

      <article className="admin-panel data-table">
        <PanelHeading label="额度记录" title="手动调整历史" count={`${summary.quotaAdjustments.length} 条`} />
        <table>
          <thead>
            <tr>
              <th>时间</th>
              <th>用户</th>
              <th>管理员</th>
              <th>模式</th>
              <th>日期</th>
              <th>调整</th>
              <th>余额变化</th>
              <th>原因</th>
            </tr>
          </thead>
          <tbody>
            {summary.quotaAdjustments.map((row) => (
              <tr key={row.id}>
                <td>{formatAdminDate(row.createdAt)}</td>
                <td>{row.userId}</td>
                <td>{row.adminUserId}</td>
                <td>{row.mode}</td>
                <td>{row.dateKey}</td>
                <td>{row.delta > 0 ? `+${row.delta}` : row.delta}</td>
                <td>{formatQuotaHistoryValue(row.beforeUsed)} -&gt; {formatQuotaHistoryValue(row.afterUsed)}</td>
                <td className="admin-wrap-cell">{row.reason}</td>
              </tr>
            ))}
            {!summary.quotaAdjustments.length && (
              <tr>
                <td colSpan={8}>暂无额度调整记录</td>
              </tr>
            )}
          </tbody>
        </table>
      </article>
    </section>
  )
}

function SmsRecordsTable({ summary }: { summary: AdminSummary }) {
  return (
    <section className="admin-panel data-table">
      <PanelHeading label="SMS" title="Verification code records" count={`${summary.smsRecords.length} records`} />
      <table>
        <thead>
          <tr>
            <th>Time</th>
            <th>Phone</th>
            <th>Purpose</th>
            <th>Status</th>
            <th>Provider</th>
            <th>Attempts</th>
            <th>Error</th>
          </tr>
        </thead>
        <tbody>
          {summary.smsRecords.map((row) => (
            <tr key={row.id}>
              <td>{formatAdminDate(row.createdAt)}</td>
              <td>{row.phone}</td>
              <td>{row.purpose}</td>
              <td>{row.status}</td>
              <td>{row.provider}</td>
              <td>{row.attemptCount}</td>
              <td className="admin-wrap-cell">{row.errorMessage || row.requestId}</td>
            </tr>
          ))}
          {!summary.smsRecords.length && (
            <tr>
              <td colSpan={7}>No SMS records</td>
            </tr>
          )}
        </tbody>
      </table>
    </section>
  )
}

function UserProfilesOpsTable({ summary }: { summary: AdminSummary }) {
  const profiles = summary.userProfiles
  const activeProfiles = profiles.filter((profile) => profile.totalGenerations > 0)
  const totalGenerations = profiles.reduce((sum, profile) => sum + profile.totalGenerations, 0)
  const totalFailures = profiles.reduce((sum, profile) => sum + profile.failedGenerations, 0)

  return (
    <section className="admin-ops-stack">
      <div className="admin-ops-grid">
        <article className="admin-panel admin-metric-card">
          <span>画像用户</span>
          <strong>{activeProfiles.length}</strong>
          <small>有生成行为的用户</small>
        </article>
        <article className="admin-panel admin-metric-card">
          <span>生成总量</span>
          <strong>{totalGenerations}</strong>
          <small>用于车辆和配件偏好统计</small>
        </article>
        <article className="admin-panel admin-metric-card">
          <span>失败样本</span>
          <strong>{totalFailures}</strong>
          <small>可和失败样本页联动排查</small>
        </article>
      </div>

      <article className="admin-panel data-table">
        <PanelHeading label="用户画像" title="车辆与配件偏好" count={`${profiles.length} 个用户`} />
        <table>
          <thead>
            <tr>
              <th>用户</th>
              <th>最近活跃</th>
              <th>生成</th>
              <th>成功 / 失败</th>
              <th>车辆偏好</th>
              <th>配件类型偏好</th>
              <th>具体配件偏好</th>
              <th>漆面偏好</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((profile) => (
              <tr key={profile.userId}>
                <td>
                  <strong>{profile.userLabel}</strong>
                  <small className="admin-cell-sub">{profile.userId}</small>
                </td>
                <td>{formatAdminDate(profile.lastActiveAt)}</td>
                <td>{profile.totalGenerations}</td>
                <td>
                  {profile.succeededGenerations} / {profile.failedGenerations}
                </td>
                <td className="admin-profile-cell">{renderAdminTags(profile.topVehicles.map((item) => `${item.label} x${item.count}`), "暂无车辆偏好")}</td>
                <td className="admin-profile-cell">{renderAdminTags(profile.topPartCategories.map((item) => `${item.label} x${item.count}`), "暂无配件偏好")}</td>
                <td className="admin-profile-cell">{renderAdminTags(profile.topParts.map((item) => `${item.label} x${item.count}`), "暂无具体配件")}</td>
                <td className="admin-profile-cell">{renderAdminTags(profile.topPaints.map((item) => `${item.label} x${item.count}`), "暂无漆面偏好")}</td>
              </tr>
            ))}
            {!profiles.length && (
              <tr>
                <td colSpan={9}>暂无用户画像数据</td>
              </tr>
            )}
          </tbody>
        </table>
      </article>
    </section>
  )
}

function AuditOpsTable({ summary }: { summary: AdminSummary }) {
  return (
    <section className="admin-ops-stack">
      <article className="admin-panel data-table">
        <PanelHeading label="关键埋点" title="用户行为事件" count={`${summary.behaviorEvents.length} 条`} />
        <table>
          <thead>
            <tr>
              <th>时间</th>
              <th>用户</th>
              <th>事件</th>
              <th>摘要</th>
            </tr>
          </thead>
          <tbody>
            {summary.behaviorEvents.map((row) => (
              <tr key={row.id}>
                <td>{formatAdminDate(row.createdAt)}</td>
                <td>{row.userLabel}</td>
                <td>{row.type}</td>
                <td className="admin-wrap-cell">{row.summary}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>

      <article className="admin-panel data-table">
        <PanelHeading label="错误与审计" title="后台操作日志" count={`${summary.auditLogs.length} 条`} />
        <table>
          <thead>
            <tr>
              <th>时间</th>
              <th>用户</th>
              <th>行为</th>
              <th>详情</th>
            </tr>
          </thead>
          <tbody>
            {summary.auditLogs.map((row) => (
              <tr key={row.id}>
                <td>{formatAdminDate(row.createdAt)}</td>
                <td>{row.userId || "system"}</td>
                <td>{row.action}</td>
                <td className="admin-wrap-cell">{row.metadata}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </section>
  )
}

function formatAdminDate(value: number) {
  return value ? new Date(value).toLocaleString() : "-"
}

function formatAdminMoney(cents: number) {
  return `¥${(cents / 100).toFixed(2)}`
}

function formatAdminGenerationVehicle(row: GenerationJob) {
  return cleanAdminVehicleModel(row.displayVehicleModel) || cleanAdminVehicleModel(row.standardJson?.vehicle.model) || "-"
}

function cleanAdminVehicleModel(value: unknown) {
  const model = String(value || "").replace(/\s+/g, " ").trim()
  if (!model) return ""
  const normalized = model.toLowerCase()
  if (normalized === "user uploaded vehicle, preserve exact identity") return ""
  if (["unknown", "n/a", "na", "none", "null", "vehicle model pending"].includes(normalized)) return ""
  if (/^(gen|upload|garage|job|usage)_[a-z0-9-]+$/i.test(model)) return ""
  return model
}

function formatAdminQuota(value: number | "unlimited") {
  return value === "unlimited" ? "不限" : value
}

function formatQuotaHistoryValue(value: number) {
  return value < 0 ? "不限" : value
}

function renderAdminTags(values: string[], empty = "-", limit = 4) {
  if (!values.length) return empty
  return (
    <span className="admin-tag-list">
      {values.slice(0, limit).map((value) => (
        <em key={value} title={value}>
          {value}
        </em>
      ))}
      {values.length > limit && <em>+{values.length - limit}</em>}
    </span>
  )
}

function BadCaseTable({ summary }: { summary: AdminSummary }) {
  return (
    <section className="admin-panel data-table">
      <PanelHeading label="BAD CASE" title="生图质量问题记录" count={`${summary.badCases.length} 条`} />
      <table>
        <thead>
          <tr>
            <th>时间</th>
            <th>模式</th>
            <th>类型</th>
            <th>摘要</th>
            <th>生成记录</th>
          </tr>
        </thead>
        <tbody>
          {summary.badCases.map((row) => (
            <tr key={row.id}>
              <td>{new Date(row.createdAt).toLocaleString()}</td>
              <td>{row.mode}</td>
              <td>{row.badCaseType}</td>
              <td>{row.summary}</td>
              <td>{row.generationId}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function UsageTable({ summary }: { summary: AdminSummary }) {
  return (
    <section className="admin-panel data-table">
      <PanelHeading label="用量 // API" title="API 消耗记录" count={`${summary.usage.length} 条`} />
      <table>
        <thead>
          <tr>
            <th>时间</th>
            <th>用户</th>
            <th>模型接口</th>
            <th>用量</th>
            <th>生成记录</th>
          </tr>
        </thead>
        <tbody>
          {summary.usage.map((row) => (
            <tr key={row.id}>
              <td>{new Date(row.createdAt).toLocaleString()}</td>
              <td>{row.userId}</td>
              <td>{row.provider}</td>
              <td>{row.usageUnits}</td>
              <td>{row.generationId}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function UsersTable({ summary }: { summary: AdminSummary }) {
  return (
    <section className="admin-panel data-table">
      <PanelHeading label="账号 // 用户" title="用户管理" count={`${summary.users.length} 个用户`} />
      <table>
        <thead>
          <tr>
            <th>用户</th>
            <th>用户名</th>
            <th>手机号</th>
            <th>角色</th>
            <th>套餐</th>
            <th>创建时间</th>
          </tr>
        </thead>
        <tbody>
          {summary.users.map((user) => (
            <tr key={user.id}>
              <td>{user.name}</td>
              <td>{user.username}</td>
              <td>{user.phone}</td>
              <td>{user.role}</td>
              <td>{user.plan}</td>
              <td>{new Date(user.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function AuditTable({ summary }: { summary: AdminSummary }) {
  return (
    <section className="admin-panel data-table">
      <PanelHeading label="审计 // 安全" title="行为日志" count={`${summary.auditLogs.length} 条`} />
      <table>
        <thead>
          <tr>
            <th>时间</th>
            <th>用户</th>
            <th>行为</th>
            <th>详情</th>
          </tr>
        </thead>
        <tbody>
          {summary.auditLogs.map((row) => (
            <tr key={row.id}>
              <td>{new Date(row.createdAt).toLocaleString()}</td>
              <td>{row.userId}</td>
              <td>{row.action}</td>
              <td>{row.metadata}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function orderStatusBadge(status: AdminPaymentOrder["status"]) {
  const map: Record<AdminPaymentOrder["status"], string> = {
    pending: "待支付",
    paid: "已支付",
    failed: "失败",
    refunded: "已退款",
  }
  return map[status] || status
}

function orderMethodLabel(method: AdminPaymentOrder["method"]) {
  return method === "wechat" ? "微信支付" : "支付宝"
}

function AdminOrdersTable() {
  const [orders, setOrders] = useState<AdminPaymentOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [userQuery, setUserQuery] = useState("")
  const [planId, setPlanId] = useState("")

  const loadOrders = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const params = new URLSearchParams()
      if (startDate) params.set("startDate", startDate)
      if (endDate) params.set("endDate", endDate)
      if (userQuery.trim()) params.set("userQuery", userQuery.trim())
      if (planId) params.set("planId", planId)
      const response = await fetch(`/api/admin/orders?${params.toString()}`)
      if (!response.ok) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error || "订单加载失败")
      }
      const body = await response.json()
      setOrders(body.orders)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "订单加载失败")
    } finally {
      setLoading(false)
    }
  }, [startDate, endDate, userQuery, planId])

  useEffect(() => {
    void loadOrders()
  }, [loadOrders])

  const resetFilters = () => {
    setStartDate("")
    setEndDate("")
    setUserQuery("")
    setPlanId("")
  }

  return (
    <section className="admin-ops-stack">
      <article className="admin-panel data-table admin-orders-panel">
        <PanelHeading label="订单管理" title="支付订单记录" count={`${orders.length} 条`} />

        <div className="admin-orders-filters">
          <label className="admin-filter-field">
            <span>起始日期</span>
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          </label>
          <label className="admin-filter-field">
            <span>截止日期</span>
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          </label>
          <label className="admin-filter-field">
            <span>用户</span>
            <input
              type="text"
              placeholder="用户名 / 手机号"
              value={userQuery}
              onChange={(event) => setUserQuery(event.target.value)}
            />
          </label>
          <label className="admin-filter-field">
            <span>套餐</span>
            <select value={planId} onChange={(event) => setPlanId(event.target.value)}>
              <option value="">全部</option>
              <option value="free">free</option>
              <option value="pro">pro</option>
              <option value="max">max</option>
            </select>
          </label>
          <button type="button" className="admin-filter-reset" onClick={resetFilters}>
            重置
          </button>
        </div>

        {error && <div className="notice admin-notice">{error}</div>}
        {loading && !orders.length ? (
          <p className="admin-orders-empty">正在加载订单...</p>
        ) : orders.length ? (
          <table className="admin-orders-table">
            <colgroup>
              <col className="orders-col-id" />
              <col className="orders-col-user" />
              <col className="orders-col-plan" />
              <col className="orders-col-amount" />
              <col className="orders-col-method" />
              <col className="orders-col-status" />
              <col className="orders-col-time" />
            </colgroup>
            <thead>
              <tr>
                <th>订单号</th>
                <th>用户</th>
                <th>套餐</th>
                <th>金额</th>
                <th>支付方式</th>
                <th>状态</th>
                <th>创建时间</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td className="admin-id-chip" title={order.id}>
                    {order.id.slice(0, 16)}
                  </td>
                  <td>
                    <div>{order.userName || "-"}</div>
                    <small>{order.userPhone || "-"}</small>
                  </td>
                  <td>{order.planId}</td>
                  <td>{formatAdminMoney(order.amountCents)}</td>
                  <td>{orderMethodLabel(order.method)}</td>
                  <td className={`admin-orders-status ${order.status}`}>{orderStatusBadge(order.status)}</td>
                  <td>{formatAdminDate(order.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="admin-orders-empty">暂无订单记录</p>
        )}
      </article>
    </section>
  )
}
