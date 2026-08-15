"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"
import {
  AlertTriangle,
  BadgeCheck,
  Camera,
  Check,
  Clock,
  CreditCard,
  Gauge,
  Image as ImageIcon,
  KeyRound,
  LayoutGrid,
  LockKeyhole,
  LogOut,
  Receipt,
  Sparkles,
  UserRound,
  X,
} from "lucide-react"
import { AccountAvatar } from "@/components/account-avatar"
import {
  changeAccountPassword,
  changeAccountPhone,
  formatAccountQuota,
  getAccountGarage,
  getAccountOrders,
  getUsageSeries,
  listAccountAvatarPresets,
  sendPhoneChangeCode,
  updateAccountProfile,
  type AccountPayload,
} from "@/lib/account-client"
import { completeSubscriptionCheckout } from "@/lib/subscription-checkout"
import {
  formatPlanPrice,
  planDisplayName,
  planFeatures,
  type Language,
} from "@/lib/subscription-display"
import { useSubscriptionPlans } from "@/lib/use-subscription-plans"
import type {
  AccountAvatarPreset,
  AuthUser,
  EntitlementStatus,
  GenerationJob,
  MembershipPlan,
  PaymentOrder,
  UsageDay,
} from "@/lib/types"

type AccountMenu = "overview" | "garage" | "usage" | "account" | "membership" | "orders"

type PcAccountPanelProps = {
  open: boolean
  language: Language
  authUser: AuthUser | null
  billing: EntitlementStatus | null
  onClose: () => void
  onAuth: () => void
  onAccountUpdated: (payload: AccountPayload) => void
  onBillingUpdated: (billing: EntitlementStatus) => void
  onLogout: () => Promise<void>
  /** 可选：在我的车库点击某条生成记录时回调，由宿主渲染到主界面结果面板（交互优化 §需求3） */
  onOpenJob?: (job: GenerationJob) => void
}

const USER_SUBSCRIPTION_CHECKOUT_ENABLED = true
const MENU_ORDER: AccountMenu[] = ["overview", "garage", "usage", "account", "membership", "orders"]

// V2 动效：内容切换 stagger 编排（见个人中心UI优化方案.md §3.4 / §4）
const sectionVariants = {
  initial: { opacity: 0, x: 10 },
  animate: {
    opacity: 1,
    x: 0,
    transition: { staggerChildren: 0.05, duration: 0.26, ease: [0.22, 1, 0.36, 1] as const },
  },
  exit: { opacity: 0, x: -10, transition: { duration: 0.16 } },
}

const itemVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.26, ease: [0.22, 1, 0.36, 1] as const } },
}

// 网格容器：在块级入场之后，再对内部卡片做二次 stagger
const gridVariants = {
  initial: { opacity: 1 },
  animate: { opacity: 1, transition: { when: "beforeChildren", staggerChildren: 0.06 } },
  exit: { opacity: 1 },
}

function usePanelCopy(language: Language) {
  return useMemo(
    () => {
      const isZh = language === "zh"
      return {
      title: isZh ? "个人中心" : "Profile",
      account: isZh ? "账户" : "Account",
      subscribe: isZh ? "订阅" : "Subscription",
      orders: isZh ? "订单" : "Orders",
      close: isZh ? "关闭" : "Close",
      signIn: isZh ? "登录账号" : "Sign in",
      notSignedIn: isZh ? "尚未登录" : "Not signed in",
      // Overview
      overview: isZh ? "概览" : "Overview",
      welcomeBack: isZh ? "欢迎回港" : "Welcome back",
      carsModified: isZh ? "已生成改装车" : "cars modified",
      currentPlan: isZh ? "当前会员" : "Current plan",
      configQuota: isZh ? "配置额度" : "Config quota",
      chatQuota: isZh ? "对话额度" : "Chat quota",
      recentWorks: isZh ? "最近作品" : "Recent works",
      viewAll: isZh ? "查看全部" : "View all",
      continueEditing: isZh ? "继续改装" : "Continue",
      manageMembership: isZh ? "管理会员" : "Manage",
      // Garage
      garage: isZh ? "我的车库" : "My Garage",
      garageEmpty: isZh ? "你的车库还是空的" : "Your garage is empty",
      garageEmptyHint: isZh ? "生成第一台改装车，收藏进你的车库" : "Create your first mod and save it to the garage",
      goCreate: isZh ? "去生成" : "Create one",
      garageLoading: isZh ? "正在加载作品..." : "Loading works...",
      // Usage
      usage: isZh ? "用量" : "Usage",
      usageTelemetry: isZh ? "用量遥测" : "Usage telemetry",
      last7Days: isZh ? "近 7 日消耗" : "Last 7 days",
      configSeries: isZh ? "配置生成" : "Config",
      chatSeries: isZh ? "对话生成" : "Chat",
      resetsOn: isZh ? "重置" : "Resets",
      lowQuota: isZh ? "额度偏低，建议升级会员以获得更多生成额度。" : "Quota is low. Upgrade for more renders.",
      unlimited: isZh ? "不限" : "Unlimited",
      used: isZh ? "已用" : "used",
      // Account section
      accountInfo: isZh ? "账户信息" : "Account information",
      avatar: isZh ? "头像" : "Avatar",
      changeAvatar: isZh ? "点击更换头像" : "Click to change avatar",
      nickname: isZh ? "昵称" : "Display name",
      email: isZh ? "邮箱" : "Email",
      phone: isZh ? "手机号" : "Phone",
      save: isZh ? "保存" : "Save",
      saved: isZh ? "已保存" : "Saved",
      sendCode: isZh ? "发送验证码" : "Send code",
      changePhone: isZh ? "确认换绑" : "Update phone",
      codeSent: isZh ? "验证码已发送" : "Code sent",
      phoneUpdated: isZh ? "手机号已更新" : "Phone updated",
      codePlaceholder: isZh ? "验证码" : "Code",
      passwordSecurity: isZh ? "密码与安全" : "Password and security",
      changePassword: isZh ? "更改密码" : "Change password",
      profileGroup: isZh ? "资料" : "Profile",
      bindingGroup: isZh ? "绑定" : "Binding",
      // Avatar popup
      selectAvatar: isZh ? "选择头像" : "Select avatar",
      // Password popup
      currentPassword: isZh ? "当前密码" : "Current password",
      newPassword: isZh ? "新密码" : "New password",
      confirmPassword: isZh ? "确认新密码" : "Confirm new password",
      passwordNotSet: isZh ? "未设置密码，该项为空即可" : "No password set, leave this field empty",
      confirmChange: isZh ? "确认修改" : "Confirm change",
      passwordUpdated: isZh ? "密码已修改" : "Password updated",
      passwordMismatch: isZh ? "两次输入的新密码不一致。" : "The new passwords do not match.",
      // Membership section
      membership: isZh ? "会员" : "Membership",
      choosePlan: isZh ? "选择会员方案" : "Choose your membership",
      planSubtitle: isZh ? "升级后可获得更多生成额度、对话模式和完整改装效果工作流。" : "Upgrade for more renders, chat mode access, and a complete workflow.",
      featured: isZh ? "推荐" : "Featured",
      month: isZh ? "/月" : "/month",
      keep: isZh ? "保留" : "Keep",
      get: isZh ? "开通" : "Get",
      choosePayment: isZh ? "选择支付方式" : "Choose payment method",
      selectedPlan: isZh ? "已选方案" : "Selected plan",
      wechatPay: isZh ? "微信支付" : "WeChat Pay",
      wechatPayNote: isZh ? "微信支付 Mock 流程" : "Mock WeChat payment",
      alipay: isZh ? "支付宝" : "Alipay",
      alipayNote: isZh ? "支付宝 Mock 流程" : "Mock Alipay payment",
      processing: isZh ? "处理中..." : "Processing...",
      continuePayment: isZh ? "继续支付" : "Continue to payment",
      planLoadFailed: isZh ? "套餐加载失败。" : "Plan loading failed.",
      checkoutFailed: isZh ? "创建支付订单失败。" : "Checkout failed.",
      mockPaymentFailed: isZh ? "模拟支付失败。" : "Mock payment failed.",
      subscriptionFailed: isZh ? "订阅失败。" : "Subscription failed.",
      subscriptionManaged: isZh ? "测试版已关闭自助开通，请联系管理员爸爸配置套餐和额度。" : "Subscription changes are disabled in this test build.",
      subscriptionAction: isZh ? "联系管理员爸爸配置" : "Admin managed",
      returnsToFree: isZh ? "到期后回到免费版" : "Returns after expiry",
      managedNote: isZh ? "当前为管理员托管模式，套餐与额度由管理员统一配置。" : "Admin-managed mode: plans and quota are configured by an administrator.",
      // Orders section
      myOrders: isZh ? "我的订单" : "My orders",
      ordersEmpty: isZh ? "暂无订单记录" : "No orders yet",
      ordersLoading: isZh ? "正在加载订单..." : "Loading orders...",
      ordersError: isZh ? "订单加载失败" : "Orders loading failed",
      orderNo: isZh ? "订单号" : "Order ID",
      orderPlan: isZh ? "套餐" : "Plan",
      orderAmount: isZh ? "金额" : "Amount",
      orderMethod: isZh ? "支付方式" : "Method",
      orderStatus: isZh ? "状态" : "Status",
      orderTime: isZh ? "创建时间" : "Created at",
      // Logout
      logout: isZh ? "退出登录" : "Sign out",
      logoutConfirm: isZh ? "确认退出登录？" : "Confirm sign out?",
      logoutConfirmHint: isZh ? "你将退出当前账号。" : "You will be signed out of the current account.",
      cancel: isZh ? "取消" : "Cancel",
      actionFailed: isZh ? "操作失败。" : "Action failed.",
      }
    },
    [language],
  )
}

export function PcAccountPanel({
  open,
  language,
  authUser,
  billing,
  onClose,
  onAuth,
  onAccountUpdated,
  onBillingUpdated,
  onLogout,
  onOpenJob,
}: PcAccountPanelProps) {
  const copy = usePanelCopy(language)
  const [activeMenu, setActiveMenu] = useState<AccountMenu>("overview")
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false)
  const [passwordPopupOpen, setPasswordPopupOpen] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [garage, setGarage] = useState<GenerationJob[]>([])
  const [garageLoading, setGarageLoading] = useState(false)
  const [usageSeries, setUsageSeries] = useState<UsageDay[]>([])
  const [usageLoading, setUsageLoading] = useState(false)
  const navRef = useRef<HTMLElement | null>(null)
  // 运行时测量 6 个 section 的最大高度，固定弹窗（避免切换跳动，见交互优化 §需求2）
  const [maxContentHeight, setMaxContentHeight] = useState<number | undefined>(undefined)
  const measureLayerRef = useRef<HTMLDivElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (open) {
      setActiveMenu("overview")
      setAvatarPickerOpen(false)
      setPasswordPopupOpen(false)
      setLogoutOpen(false)
    }
  }, [open])

  useEffect(() => {
    if (!open || !authUser) return
    let cancelled = false
    if (!garage.length && !garageLoading) {
      setGarageLoading(true)
      getAccountGarage()
        .then((payload) => { if (!cancelled) setGarage(payload.generations) })
        .catch(() => { if (!cancelled) setGarage([]) })
        .finally(() => { if (!cancelled) setGarageLoading(false) })
    }
    if (!usageSeries.length && !usageLoading) {
      setUsageLoading(true)
      getUsageSeries(7)
        .then((payload) => { if (!cancelled) setUsageSeries(payload.series) })
        .catch(() => { if (!cancelled) setUsageSeries([]) })
        .finally(() => { if (!cancelled) setUsageLoading(false) })
    }
    return () => { cancelled = true }
  // 故意不把 garageLoading/usageLoading 及 .length 列入依赖：setXxxLoading(true) 会触发 effect 重跑并先跑清理函数，
  // 使 cancelled 被提前置位，.finally 内的 setXxxLoading(false) 被跳过，从而永久卡在"加载中"（见本次修复说明）。
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, authUser])

  // 切换登录用户时清空上一次的车库/用量数据，避免把上一个用户的记录展示给当前用户。
  // 清空后下方的 fetch effect（依赖 authUser）会因 garage/usage 为空而重新拉取当前用户的数据。
  const accountUserId = authUser?.id ?? ""
  useEffect(() => {
    setGarage([])
    setGarageLoading(false)
    setUsageSeries([])
    setUsageLoading(false)
  }, [accountUserId])

  const focusMenu = useCallback((key: AccountMenu) => {
    const node = navRef.current?.querySelector<HTMLButtonElement>(`[data-menu="${key}"]`)
    node?.focus()
  }, [])

  const handleMenuKeyDown = useCallback((event: React.KeyboardEvent) => {
    const index = MENU_ORDER.indexOf(activeMenu)
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault()
      const next = MENU_ORDER[(index + 1) % MENU_ORDER.length]
      setActiveMenu(next)
      focusMenu(next)
    } else if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault()
      const prev = MENU_ORDER[(index - 1 + MENU_ORDER.length) % MENU_ORDER.length]
      setActiveMenu(prev)
      focusMenu(prev)
    } else if (event.key === "Home") {
      event.preventDefault()
      setActiveMenu(MENU_ORDER[0])
      focusMenu(MENU_ORDER[0])
    } else if (event.key === "End") {
      event.preventDefault()
      const last = MENU_ORDER[MENU_ORDER.length - 1]
      setActiveMenu(last)
      focusMenu(last)
    }
  }, [activeMenu, focusMenu])

  // 运行时测量 6 个 section 最大高度 → 固定弹窗内容区（交互优化 §需求2）
  useLayoutEffect(() => {
    if (!open) return
    const measure = () => {
      const layer = measureLayerRef.current
      if (!layer) return
      const sections = layer.querySelectorAll<HTMLElement>("[data-measure]")
      let max = 0
      sections.forEach((el) => { max = Math.max(max, el.offsetHeight) })
      if (max > 0) setMaxContentHeight(max)
    }
    // 等字体/布局稳定后再测；rAF 一次足够，数据到达后依赖变化会重测
    const raf = requestAnimationFrame(measure)
    const ro = new ResizeObserver(() => requestAnimationFrame(measure))
    if (contentRef.current) ro.observe(contentRef.current)
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [open, billing, garage, usageSeries, language])

  const menuItems: { key: AccountMenu; label: string; icon: typeof UserRound }[] = [
    { key: "overview", label: copy.overview, icon: Sparkles },
    { key: "garage", label: copy.garage, icon: LayoutGrid },
    { key: "usage", label: copy.usage, icon: Gauge },
    { key: "account", label: copy.account, icon: UserRound },
    { key: "membership", label: copy.membership, icon: BadgeCheck },
    { key: "orders", label: copy.orders, icon: Receipt },
  ]

  if (typeof document === "undefined") return null

  const overlay = (
    <AnimatePresence>
      {open && (
        <motion.div
          key="pc-account-backdrop"
          className="pc-account-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          onClick={onClose}
        >
          <motion.section
            className="pc-account-panel"
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 14, scale: 0.98 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pc-account-title"
          >
            <aside className="pc-account-sidebar">
              <IdentityCard
                language={language}
                authUser={authUser}
                billing={billing}
                onAvatarClick={() => authUser && setAvatarPickerOpen(true)}
              />
              <nav
                className="pc-account-menu"
                role="tablist"
                aria-label={language === "zh" ? "个人中心导航" : "Profile navigation"}
                ref={navRef}
                onKeyDown={handleMenuKeyDown}
              >
                {menuItems.map((item) => {
                  const Icon = item.icon
                  return (
                    <button
                      key={item.key}
                      type="button"
                      data-menu={item.key}
                      role="tab"
                      aria-selected={activeMenu === item.key}
                      className={activeMenu === item.key ? "pc-account-menu-item active" : "pc-account-menu-item"}
                      onClick={() => setActiveMenu(item.key)}
                    >
                      <Icon size={16} />
                      <span>{item.label}</span>
                    </button>
                  )
                })}
              </nav>
              {authUser && (
                <button
                  type="button"
                  className="pc-account-menu-item pc-account-logout"
                  onClick={() => setLogoutOpen(true)}
                >
                  <LogOut size={16} />
                  <span>{copy.logout}</span>
                </button>
              )}
            </aside>

            <div
              className="pc-account-content"
              ref={contentRef}
              style={maxContentHeight ? { minHeight: maxContentHeight } : undefined}
            >
              <button
                type="button"
                className="pc-account-close"
                onClick={onClose}
                aria-label={copy.close}
              >
                <X size={18} />
              </button>

              {authUser ? (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeMenu}
                    variants={sectionVariants}
                    initial="initial"
                    animate="animate"
                    exit="exit"
                  >
                    {activeMenu === "overview" && (
                      <OverviewSection
                        language={language}
                        copy={copy}
                        authUser={authUser}
                        billing={billing}
                        garage={garage}
                        onGarage={() => setActiveMenu("garage")}
                        onMembership={() => setActiveMenu("membership")}
                      />
                    )}
                    {activeMenu === "garage" && (
                      <GarageSection language={language} copy={copy} garage={garage} loading={garageLoading} onAuth={onAuth} onOpenJob={onOpenJob} />
                    )}
                    {activeMenu === "usage" && (
                      <UsageSection language={language} copy={copy} billing={billing} series={usageSeries} loading={usageLoading} />
                    )}
                    {activeMenu === "account" && (
                      <AccountSection
                        language={language}
                        copy={copy}
                        authUser={authUser}
                        onAvatarClick={() => setAvatarPickerOpen(true)}
                        onPasswordClick={() => setPasswordPopupOpen(true)}
                        onAccountUpdated={onAccountUpdated}
                      />
                    )}
                    {activeMenu === "membership" && (
                      <MembershipSection
                        language={language}
                        copy={copy}
                        billing={billing}
                        onBillingUpdated={onBillingUpdated}
                      />
                    )}
                    {activeMenu === "orders" && (
                      <OrdersSection language={language} copy={copy} authUser={authUser} />
                    )}
                  </motion.div>
                </AnimatePresence>
              ) : (
                <section className="pc-account-empty">
                  <UserRound size={30} />
                  <strong>{copy.notSignedIn}</strong>
                  <button type="button" className="pc-account-empty-btn" onClick={onAuth}>
                    <KeyRound size={16} />
                    {copy.signIn}
                  </button>
                </section>
              )}
            </div>

            {/* 隐藏测量层：同时渲染 6 个 section 取最大高度，固定弹窗（§需求2）。仅读已有 state，不发起新请求。 */}
            {open && authUser && (
              <div className="pc-measure-layer" ref={measureLayerRef} aria-hidden="true">
                <div data-measure>
                  <OverviewSection
                    language={language}
                    copy={copy}
                    authUser={authUser}
                    billing={billing}
                    garage={garage}
                    onGarage={() => {}}
                    onMembership={() => {}}
                  />
                </div>
                <div data-measure>
                  <GarageSection language={language} copy={copy} garage={garage} loading={false} onAuth={onAuth} onOpenJob={onOpenJob} />
                </div>
                <div data-measure>
                  <UsageSection language={language} copy={copy} billing={billing} series={usageSeries} loading={false} />
                </div>
                <div data-measure>
                  <AccountSection
                    language={language}
                    copy={copy}
                    authUser={authUser}
                    onAvatarClick={() => {}}
                    onPasswordClick={() => {}}
                    onAccountUpdated={onAccountUpdated}
                  />
                </div>
                <div data-measure>
                  <MembershipSection language={language} copy={copy} billing={billing} onBillingUpdated={onBillingUpdated} />
                </div>
                <div data-measure>
                  <OrdersSection language={language} copy={copy} authUser={authUser} />
                </div>
              </div>
            )}

            {avatarPickerOpen && authUser && (
              <AvatarPickerPopup
                language={language}
                copy={copy}
                authUser={authUser}
                onClose={() => setAvatarPickerOpen(false)}
                onAccountUpdated={onAccountUpdated}
              />
            )}

            {passwordPopupOpen && authUser && (
              <PasswordChangePopup
                language={language}
                copy={copy}
                authUser={authUser}
                onClose={() => setPasswordPopupOpen(false)}
                onAccountUpdated={onAccountUpdated}
              />
            )}

            {logoutOpen && authUser && (
              <LogoutPopup
                copy={copy}
                onClose={() => setLogoutOpen(false)}
                onConfirm={async () => {
                  setLogoutOpen(false)
                  await onLogout()
                }}
              />
            )}
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  )

  return createPortal(overlay, document.body)
}

// ---------------------------------------------------------------------------
// Identity card
// ---------------------------------------------------------------------------

function IdentityCard({
  language,
  authUser,
  billing,
  onAvatarClick,
}: {
  language: Language
  authUser: AuthUser | null
  billing: EntitlementStatus | null
  onAvatarClick: () => void
}) {
  const isZh = language === "zh"
  if (!authUser) return null
  const planName = billing ? planDisplayName(billing.plan, language) : (isZh ? "免费" : "Free")
  let ringPct = 1
  let danger = false
  if (billing && billing.configRemaining !== "unlimited") {
    const total = billing.configRemaining + billing.configUsed
    ringPct = total > 0 ? billing.configRemaining / total : 0
    danger = ringPct < 0.2
  }
  return (
    <div className="pc-identity">
      <AvatarUsageRing pct={ringPct} danger={danger} label={isZh ? "本月用量" : "Usage"}>
        <button type="button" className="pc-identity-avatar" onClick={onAvatarClick} aria-label={isZh ? "更换头像" : "Change avatar"}>
          <AccountAvatar user={authUser} className="pc-identity-img" />
        </button>
      </AvatarUsageRing>
      <div className="pc-identity-meta">
        <span className="pc-identity-name">{authUser.name || authUser.username}</span>
        <span className={billing ? "pc-identity-badge" : "pc-identity-badge free"}>{planName}</span>
        <span className="pc-identity-usage">{isZh ? `本月用量 ${Math.round(ringPct * 100)}%` : `Usage ${Math.round(ringPct * 100)}%`}</span>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Ring gauge (SVG, no inline style)
// ---------------------------------------------------------------------------

function RingGauge({ pct, danger, label }: { pct: number; danger?: boolean; label: string }) {
  const radius = 18
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(1, Math.max(0, pct))
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])
  // 挂载前 offset 为满环，挂载后过渡到终值 → 环填充动画（提案 §3.6）
  const offset = circumference * (1 - (mounted ? clamped : 0))
  return (
    <div className="pc-ring-wrap" title={label}>
      <svg className="pc-ring" viewBox="0 0 44 44" width="44" height="44" role="img" aria-label={`${Math.round(clamped * 100)}%`}>
        <circle className="pc-ring-track" cx="22" cy="22" r={radius} />
        <circle
          className={danger ? "pc-ring-fill danger" : "pc-ring-fill"}
          cx="22"
          cy="22"
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 22 22)"
        />
        <text className="pc-ring-text" x="22" y="26">{Math.round(clamped * 100)}</text>
      </svg>
    </div>
  )
}

// 头像外环进度条（本月用量环绕头像，见交互优化方案 §需求1）
// 头像外环进度条（本月用量环绕头像，见交互优化方案 §需求1）
// 环内缘与头像内容边缘对齐，看起来像头像的边框；头像保持圆角方形。
function AvatarUsageRing({ pct, danger, label, children }: { pct: number; danger?: boolean; label: string; children: React.ReactNode }) {
  const stroke = 3
  const size = 54
  const radius = size / 2 - stroke / 2 // 25.5：stroke 内缘贴头像 48px 边缘
  const center = size / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.min(1, Math.max(0, pct))
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])
  // 挂载前 offset 为满环，挂载后过渡到终值 → 环填充动画
  const offset = circumference * (1 - (mounted ? clamped : 0))
  return (
    <div className="pc-identity-avatar-ring" title={`${label} ${Math.round(clamped * 100)}%`}>
      <svg className="pc-ring" viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={`${label} ${Math.round(clamped * 100)}%`}>
        <circle className="pc-ring-track" cx={center} cy={center} r={radius} />
        <circle
          className={danger ? "pc-ring-fill danger" : "pc-ring-fill"}
          cx={center}
          cy={center}
          r={radius}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${center} ${center})`}
        />
      </svg>
      <div className="pc-identity-avatar-wrap">{children}</div>
    </div>
  )
}

// 骨架屏占位（加载态替换纯文字，见个人中心UI优化方案.md §3.10）
function Skeleton({ className }: { className?: string }) {
  return <span className={`pc-skeleton ${className ?? ""}`} aria-hidden="true" />
}

// 保存成功确认微动效（替换纯文字"已保存"）
function SavedBadge({ text }: { text: string }) {
  return (
    <motion.p
      className="pc-account-message pc-saved-badge"
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: "spring", stiffness: 500, damping: 22 }}
      aria-live="polite"
    >
      <Check size={14} /> {text}
    </motion.p>
  )
}

// ---------------------------------------------------------------------------
// Overview Section
// ---------------------------------------------------------------------------

function OverviewSection({
  language,
  copy,
  authUser,
  billing,
  garage,
  onGarage,
  onMembership,
}: {
  language: Language
  copy: SectionCopy
  authUser: AuthUser
  billing: EntitlementStatus | null
  garage: GenerationJob[]
  onGarage: () => void
  onMembership: () => void
}) {
  const isZh = language === "zh"
  const planName = billing ? planDisplayName(billing.plan, language) : (isZh ? "免费版" : "Free")
  const expiry = billing?.subscription?.currentPeriodEnd
    ? new Date(billing.subscription.currentPeriodEnd).toLocaleDateString(isZh ? "zh-CN" : "en-US")
    : (isZh ? "未订阅" : "No active plan")

  const configPct = billing && billing.configRemaining !== "unlimited"
    ? (billing.configRemaining + billing.configUsed) > 0
      ? billing.configRemaining / (billing.configRemaining + billing.configUsed)
      : 0
    : 1
  const chatPct = billing && billing.chatRemainingToday !== "unlimited"
    ? (billing.chatRemainingToday + billing.chatUsedToday) > 0
      ? billing.chatRemainingToday / (billing.chatRemainingToday + billing.chatUsedToday)
      : 0
    : 1

  const recent = garage.slice(0, 3)

  return (
    <motion.div className="pc-account-section pc-overview" variants={itemVariants}>
      <h2 className="pc-section-title" id="pc-account-title">{copy.overview}</h2>
      <div className="pc-overview-hero">
        <p className="pc-overview-greeting">{copy.welcomeBack}，<strong>{authUser.name || authUser.username}</strong></p>
        <p className="pc-overview-sub">{garage.length} {copy.carsModified}</p>
      </div>

      <motion.div className="pc-telemetry-grid" variants={gridVariants}>
        <motion.article className="pc-telemetry-card plan" variants={itemVariants}>
          <span className="pc-telemetry-label">{copy.currentPlan}</span>
          <strong className="pc-telemetry-value">{planName}</strong>
          <small className="pc-telemetry-sub">{expiry}</small>
        </motion.article>
        <motion.article className="pc-telemetry-card" variants={itemVariants}>
          <RingGauge pct={configPct} label={copy.configQuota} danger={configPct < 0.2 && billing?.configRemaining !== "unlimited"} />
          <span className="pc-telemetry-label">{copy.configQuota}</span>
          <strong className="pc-telemetry-value">{formatAccountQuota(billing?.configRemaining, copy.unlimited)}</strong>
        </motion.article>
        <motion.article className="pc-telemetry-card" variants={itemVariants}>
          <RingGauge pct={chatPct} label={copy.chatQuota} danger={chatPct < 0.2 && billing?.chatRemainingToday !== "unlimited"} />
          <span className="pc-telemetry-label">{copy.chatQuota}</span>
          <strong className="pc-telemetry-value">{formatAccountQuota(billing?.chatRemainingToday, copy.unlimited)}</strong>
        </motion.article>
      </motion.div>

      <div className="pc-overview-recent">
        <div className="pc-overview-recent-head">
          <span>{copy.recentWorks}</span>
          <button type="button" className="pc-overview-recent-more" onClick={onGarage}>{copy.viewAll}</button>
        </div>
        <div className="pc-recent-row">
          {recent.length === 0 ? (
            <span className="pc-recent-empty">{isZh ? "还没有作品" : "No works yet"}</span>
          ) : recent.map((job) => (
            <div key={job.id} className="pc-recent-thumb" title={job.displayVehicleModel || ""}>
              {job.resultImageUrl ? (
                <img src={job.resultImageUrl} alt={job.displayVehicleModel || ""} loading="lazy" />
              ) : (
                <ImageIcon size={20} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="pc-cta-row">
        <button type="button" className="pc-cta-primary" onClick={onMembership}>{copy.manageMembership}</button>
        <button type="button" className="pc-cta-secondary" onClick={onGarage}>{copy.garage}</button>
      </div>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Garage Section
// ---------------------------------------------------------------------------

function GarageSection({
  language,
  copy,
  garage,
  loading,
  onAuth,
  onOpenJob,
}: {
  language: Language
  copy: SectionCopy
  garage: GenerationJob[]
  loading: boolean
  onAuth: () => void
  onOpenJob?: (job: GenerationJob) => void
}) {
  const isZh = language === "zh"
  return (
    <motion.div className="pc-account-section pc-garage" variants={itemVariants}>
      <h2 className="pc-section-title">{copy.garage}</h2>
      {loading && !garage.length ? (
        <div className="pc-garage-grid" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="pc-garage-card">
              <div className="pc-garage-thumb"><Skeleton /></div>
              <div className="pc-garage-meta">
                <span className="pc-sk-line" />
                <span className="pc-sk-line short" />
              </div>
            </div>
          ))}
        </div>
      ) : garage.length === 0 ? (
        <div className="pc-garage-empty-block">
          <div className="pc-garage-empty-art"><ImageIcon size={36} /></div>
          <p className="pc-garage-empty-title">{copy.garageEmpty}</p>
          <p className="pc-garage-empty-hint">{copy.garageEmptyHint}</p>
        </div>
      ) : (
        <div className="pc-garage-grid">
          {garage.map((job) => (
            <article
              key={job.id}
              className="pc-garage-card"
              role="button"
              tabIndex={0}
              onClick={() => onOpenJob?.(job)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault()
                  onOpenJob?.(job)
                }
              }}
            >
              <div className="pc-garage-thumb">
                {job.resultImageUrl ? <img src={job.resultImageUrl} alt={job.displayVehicleModel || ""} loading="lazy" /> : <ImageIcon size={22} />}
              </div>
              <div className="pc-garage-meta">
                <span className="pc-garage-model">{job.displayVehicleModel || (isZh ? "未命名改装" : "Untitled mod")}</span>
                <div className="pc-garage-tags">
                  <span className={`pc-garage-mode ${job.mode}`}>{job.mode === "chat" ? (isZh ? "对话模式" : "Chat") : (isZh ? "配置模式" : "Config")}</span>
                  <span className="pc-garage-time">{new Date(job.createdAt).toLocaleDateString(isZh ? "zh-CN" : "en-US")}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
      {!loading && garage.length === 0 && (
        <button type="button" className="pc-garage-create" onClick={onAuth}>{copy.goCreate}</button>
      )}
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Usage Section
// ---------------------------------------------------------------------------

function UsageSection({
  language,
  copy,
  billing,
  series,
  loading,
}: {
  language: Language
  copy: SectionCopy
  billing: EntitlementStatus | null
  series: UsageDay[]
  loading: boolean
}) {
  const isZh = language === "zh"
  const configRemaining = billing?.configRemaining
  const chatRemaining = billing?.chatRemainingToday
  const configLow =
    typeof configRemaining === "number" &&
    configRemaining > 0 &&
    !!billing &&
    configRemaining / (configRemaining + (billing?.configUsed ?? 0)) < 0.2
  const configMax = typeof configRemaining === "number" ? configRemaining + (billing?.configUsed ?? 0) : 0
  const chatMax = typeof chatRemaining === "number" ? chatRemaining + (billing?.chatUsedToday ?? 0) : 0
  const configPct = configMax > 0 && typeof configRemaining === "number" ? configRemaining / configMax : (configRemaining === "unlimited" ? 1 : 0)
  const chatPct = chatMax > 0 && typeof chatRemaining === "number" ? chatRemaining / chatMax : (chatRemaining === "unlimited" ? 1 : 0)
  const expiry = billing?.subscription?.currentPeriodEnd
    ? new Date(billing.subscription.currentPeriodEnd).toLocaleDateString(isZh ? "zh-CN" : "en-US")
    : (isZh ? "未订阅" : "No plan")

  const configValues = series.map((day) => day.configUsed)
  const chatValues = series.map((day) => day.chatUsed)
  const maxValue = Math.max(1, ...configValues, ...chatValues)

  return (
    <motion.div className="pc-account-section pc-usage" variants={itemVariants}>
      <h2 className="pc-section-title">{copy.usage}</h2>
      <p className="pc-section-subtitle">{copy.usageTelemetry}</p>

      <div className="pc-usage-cards">
        <UsageGauge
          label={copy.configQuota}
          remaining={configRemaining}
          used={billing?.configUsed ?? 0}
          max={configMax}
          pct={configPct}
          danger={configLow}
          unlimitedText={copy.unlimited}
          usedText={copy.used}
          resets={expiry}
          resetsLabel={copy.resetsOn}
        />
        <UsageGauge
          label={copy.chatQuota}
          remaining={chatRemaining}
          used={billing?.chatUsedToday ?? 0}
          max={chatMax}
          pct={chatPct}
          danger={false}
          unlimitedText={copy.unlimited}
          usedText={copy.used}
          resets={isZh ? "每日 0 点" : "Daily 0:00"}
          resetsLabel={copy.resetsOn}
        />
      </div>

      <div className="pc-usage-spark-block">
        <div className="pc-usage-spark-head">
          <span>{copy.last7Days}</span>
          <span className="pc-usage-spark-legend"><i className="dot config" />{copy.configSeries}<i className="dot chat" />{copy.chatSeries}</span>
        </div>
        {loading && !series.length ? (
          <div className="pc-usage-sparks" aria-busy="true">
            <Skeleton className="pc-spark-skel" />
            <Skeleton className="pc-spark-skel" />
          </div>
        ) : (
          <div className="pc-usage-sparks">
            <Sparkline values={configValues} max={maxValue} variant="config" />
            <Sparkline values={chatValues} max={maxValue} variant="chat" />
          </div>
        )}
      </div>

      {configLow && (
        <p className="pc-usage-alert"><AlertTriangle size={16} />{copy.lowQuota}</p>
      )}
    </motion.div>
  )
}

function UsageGauge({
  label,
  remaining,
  used,
  max,
  pct,
  danger,
  unlimitedText,
  usedText,
  resets,
  resetsLabel,
}: {
  label: string
  remaining: number | "unlimited" | undefined
  used: number
  max: number
  pct: number
  danger: boolean
  unlimitedText: string
  usedText: string
  resets: string
  resetsLabel: string
}) {
  const clamped = Math.min(1, Math.max(0, pct))
  const [mounted, setMounted] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [])
  // 挂载即从 0 过渡到终值（提案 §3.6）
  const fill = mounted ? clamped * 100 : 0
  return (
    <article className={danger ? "pc-usage-card danger" : "pc-usage-card"}>
      <div className="pc-usage-card-head">
        <span className="pc-usage-label">{label}</span>
        <strong className="pc-usage-value">{remaining === "unlimited" ? unlimitedText : String(remaining)}</strong>
      </div>
      <div className="pc-usage-bar">
        <span className={danger ? "pc-usage-bar-fill danger" : "pc-usage-bar-fill"} style={{ "--pc-fill": `${fill}%` } as React.CSSProperties} />
      </div>
      <div className="pc-usage-card-foot">
        <small>{`${used} ${usedText} / ${max}`.replace("NaN", "0")}</small>
        <small>{`${resetsLabel} ${resets}`}</small>
      </div>
    </article>
  )
}

function Sparkline({ values, max, variant }: { values: number[]; max: number; variant: "config" | "chat" }) {
  const width = 100
  const height = 28
  const step = values.length > 1 ? width / (values.length - 1) : width
  const points = values.map((value, index) => {
    const x = index * step
    const y = height - (max > 0 ? (value / max) * (height - 4) : 0) - 2
    return `${x.toFixed(2)},${y.toFixed(2)}`
  }).join(" ")
  return (
    <svg className={`pc-spark ${variant}`} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={variant}>
      <polyline className="pc-spark-line" points={points} pathLength={1} />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Account Section (grouped cards)
// ---------------------------------------------------------------------------

type SectionCopy = ReturnType<typeof usePanelCopy>

function AccountSection({
  language,
  copy,
  authUser,
  onAvatarClick,
  onPasswordClick,
  onAccountUpdated,
}: {
  language: Language
  copy: SectionCopy
  authUser: AuthUser
  onAvatarClick: () => void
  onPasswordClick: () => void
  onAccountUpdated: (payload: AccountPayload) => void
}) {
  const [name, setName] = useState(authUser.name || authUser.username || "")
  const [email, setEmail] = useState(authUser.email || "")
  const [phone, setPhone] = useState(authUser.phone || "")
  const [phoneCode, setPhoneCode] = useState("")
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState("")
  const [error, setError] = useState("")
  const [codeCooldown, setCodeCooldown] = useState(0)
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    setName(authUser.name || authUser.username || "")
    setEmail(authUser.email || "")
    setPhone(authUser.phone || "")
    setPhoneCode("")
    setNotice("")
    setError("")
  }, [authUser])

  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current)
    }
  }, [])

  const nameChanged = name !== (authUser.name || authUser.username || "")
  const emailChanged = email !== (authUser.email || "")

  const runAction = async (action: () => Promise<void>) => {
    setLoading(true)
    setNotice("")
    setError("")
    try {
      await action()
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : copy.actionFailed)
    } finally {
      setLoading(false)
    }
  }

  const saveName = () =>
    runAction(async () => {
      const payload = await updateAccountProfile({ name, email: authUser.email || "", avatarId: authUser.avatarId })
      onAccountUpdated(payload)
      setNotice(copy.saved)
    })

  const saveEmail = () =>
    runAction(async () => {
      const payload = await updateAccountProfile({ name: authUser.name || authUser.username || "", email, avatarId: authUser.avatarId })
      onAccountUpdated(payload)
      setNotice(copy.saved)
    })

  const startCooldown = () => {
    setCodeCooldown(60)
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current)
    cooldownTimerRef.current = setInterval(() => {
      setCodeCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const sendCode = () =>
    runAction(async () => {
      await sendPhoneChangeCode(phone)
      setNotice(copy.codeSent)
      startCooldown()
    })

  const savePhone = () =>
    runAction(async () => {
      const payload = await changeAccountPhone({ phone, code: phoneCode })
      onAccountUpdated(payload)
      setPhone(payload.user.phone)
      setPhoneCode("")
      setNotice(copy.phoneUpdated)
    })

  return (
    <motion.div className="pc-account-section" variants={itemVariants}>
      <h2 className="pc-section-title">{copy.accountInfo}</h2>

      <section className="pc-field-card">
        <h3 className="pc-field-card-title">{copy.profileGroup}</h3>
        <div className="pc-account-avatar-row">
          <button type="button" className="pc-account-avatar-btn" onClick={onAvatarClick} aria-label={copy.changeAvatar}>
            <AccountAvatar user={authUser} className="pc-account-avatar-img" />
            <span className="pc-account-avatar-camera"><Camera size={14} /></span>
          </button>
          <span className="pc-account-avatar-hint">{copy.changeAvatar}</span>
        </div>
        <div className="pc-account-field">
          <label className="pc-account-field-label" htmlFor="pc-name">{copy.nickname}</label>
          <div className="pc-account-field-row">
            <input id="pc-name" className="pc-account-input" value={name} onChange={(event) => setName(event.target.value)} disabled={loading} />
            <button type="button" className="pc-account-field-save" disabled={!nameChanged || loading} onClick={() => void saveName()}>{copy.save}</button>
          </div>
        </div>
        <div className="pc-account-field">
          <label className="pc-account-field-label" htmlFor="pc-email">{copy.email}</label>
          <div className="pc-account-field-row">
            <input id="pc-email" className="pc-account-input" value={email} onChange={(event) => setEmail(event.target.value)} disabled={loading} />
            <button type="button" className="pc-account-field-save" disabled={!emailChanged || loading} onClick={() => void saveEmail()}>{copy.save}</button>
          </div>
        </div>
      </section>

      <section className="pc-field-card">
        <h3 className="pc-field-card-title">{copy.bindingGroup}</h3>
        <div className="pc-account-field">
          <label className="pc-account-field-label" htmlFor="pc-phone">{copy.phone}</label>
          <div className="pc-account-field-row">
            <input id="pc-phone" className="pc-account-input" value={phone} onChange={(event) => setPhone(event.target.value)} disabled={loading} />
            <button type="button" className="pc-account-field-action" disabled={loading || codeCooldown > 0} onClick={() => void sendCode()}>
              {codeCooldown > 0 ? `${codeCooldown}s` : copy.sendCode}
            </button>
          </div>
        </div>
        <div className="pc-account-field">
          <label className="pc-account-field-label" htmlFor="pc-code">{copy.codePlaceholder}</label>
          <div className="pc-account-field-row">
            <input id="pc-code" className="pc-account-input" value={phoneCode} onChange={(event) => setPhoneCode(event.target.value)} disabled={loading} placeholder={copy.codePlaceholder} />
            <button type="button" className="pc-account-field-save" disabled={loading || !phoneCode} onClick={() => void savePhone()}>{copy.changePhone}</button>
          </div>
        </div>
      </section>

      <section className="pc-field-card">
        <h3 className="pc-field-card-title">{copy.passwordSecurity}</h3>
        <button type="button" className="pc-account-password-btn" onClick={onPasswordClick}>
          <LockKeyhole size={16} />
          {copy.changePassword}
        </button>
      </section>

      {error ? (
        <p className="pc-account-message error" aria-live="polite">{error}</p>
      ) : notice ? (
        <SavedBadge text={notice} />
      ) : null}
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Membership Section (de-cluttered)
// ---------------------------------------------------------------------------

function MembershipSection({
  language,
  copy,
  billing,
  onBillingUpdated,
}: {
  language: Language
  copy: SectionCopy
  billing: EntitlementStatus | null
  onBillingUpdated: (billing: EntitlementStatus) => void
}) {
  const isZh = language === "zh"
  const { plans, loading: plansLoading, error: plansError } = useSubscriptionPlans(true, copy.planLoadFailed)
  const [checkoutPlan, setCheckoutPlan] = useState<MembershipPlan | null>(null)
  const [method, setMethod] = useState<"wechat" | "alipay">("wechat")
  const [loading, setLoading] = useState(false)
  const [notice, setNotice] = useState("")

  const userCheckoutDisabled = !USER_SUBSCRIPTION_CHECKOUT_ENABLED
  const planName = billing ? planDisplayName(billing.plan, language) : "--"
  const expiry = billing?.subscription?.currentPeriodEnd
    ? new Date(billing.subscription.currentPeriodEnd).toLocaleDateString(isZh ? "zh-CN" : "en-US")
    : (isZh ? "未订阅" : "No active subscription")

  const handleCheckout = async () => {
    if (!checkoutPlan) return
    setLoading(true)
    setNotice("")
    try {
      const nextBilling = await completeSubscriptionCheckout(checkoutPlan, method, "monthly", {
        checkoutFailed: copy.checkoutFailed,
        mockPaymentFailed: copy.mockPaymentFailed,
        subscriptionFailed: copy.subscriptionFailed,
      })
      onBillingUpdated(nextBilling)
      setCheckoutPlan(null)
    } catch (checkoutError) {
      setNotice(checkoutError instanceof Error ? checkoutError.message : copy.subscriptionFailed)
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div className="pc-subscribe-section" variants={itemVariants}>
      <article className="pc-membership-current">
        <div className="pc-membership-current-head">
          <span className="pc-membership-badge">{planName}</span>
          <small>{expiry}</small>
        </div>
        <p className="pc-membership-current-sub">
          {billing?.configRemaining === "unlimited"
            ? (isZh ? "配置额度不限量" : "Unlimited config quota")
            : (isZh ? `剩余配置额度 ${billing?.configRemaining ?? 0}` : `Config quota left ${billing?.configRemaining ?? 0}`)}
        </p>
      </article>

      <h2 className="pc-section-title">{copy.choosePlan}</h2>
      <p className="pc-section-subtitle">{copy.planSubtitle}</p>

      {plansError && <p className="pc-account-message error">{plansError}</p>}

      <div className="pc-pricing-grid">
        {plans.map((plan) => {
          const featured = plan.id === "pro"
          const price = formatPlanPrice(plan.priceCents)
          const planIsPaidToFree = plan.id === "free" && Boolean(billing?.plan.id && billing.plan.id !== "free")
          return (
            <article key={plan.id} className={featured ? "pc-pricing-card featured" : "pc-pricing-card"}>
              {featured && <div className="pc-pricing-featured">{copy.featured}</div>}
              <div className="pc-pricing-title">
                <h3>{planDisplayName(plan, language)}</h3>
                <div className="pc-pricing-price">
                  <strong>¥{price}</strong>
                  <span>{copy.month}</span>
                </div>
              </div>
              <button
                type="button"
                className="pc-pricing-btn"
                disabled={userCheckoutDisabled || planIsPaidToFree || loading}
                onClick={() => (plan.id === "free" ? null : setCheckoutPlan(plan))}
              >
                {userCheckoutDisabled
                  ? copy.subscriptionAction
                  : planIsPaidToFree
                    ? copy.returnsToFree
                    : plan.id === "free"
                      ? `${copy.keep} ${planDisplayName(plan, language)}`
                      : `${copy.get} ${planDisplayName(plan, language)}`}
              </button>
              <ul className="pc-pricing-features">
                {planFeatures(plan, language).map((feature) => (
                  <li key={feature}><Check size={16} /><span>{feature}</span></li>
                ))}
              </ul>
            </article>
          )
        })}
      </div>

      {plansLoading && plans.length === 0 && (
        <p className="pc-account-message">{isZh ? "正在加载套餐..." : "Loading plans..."}</p>
      )}

      {userCheckoutDisabled && (
        <>
          <p className="pc-account-message">{copy.subscriptionManaged}</p>
          <p className="pc-managed-note">{copy.managedNote}</p>
        </>
      )}
      {notice && <p className="pc-account-message error">{notice}</p>}

      <AnimatePresence>
        {checkoutPlan && !userCheckoutDisabled && (
          <PaymentPopup
            copy={copy}
            language={language}
            checkoutPlan={checkoutPlan}
            method={method}
            setMethod={setMethod}
            loading={loading}
            onClose={() => setCheckoutPlan(null)}
            onSubmit={handleCheckout}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Orders Section (cards)
// ---------------------------------------------------------------------------

function OrdersSection({
  language,
  copy,
  authUser,
}: {
  language: Language
  copy: SectionCopy
  authUser: AuthUser
}) {
  const isZh = language === "zh"
  const [orders, setOrders] = useState<PaymentOrder[]>([])
  const [ordersLoading, setOrdersLoading] = useState(false)
  const [ordersError, setOrdersError] = useState("")
  const [ordersLoaded, setOrdersLoaded] = useState(false)

  const loadOrders = useCallback(async () => {
    if (!authUser) return
    setOrdersLoading(true)
    setOrdersError("")
    try {
      const payload = await getAccountOrders()
      setOrders(payload.orders)
    } catch (orderError) {
      setOrdersError(orderError instanceof Error ? orderError.message : copy.ordersError)
    } finally {
      setOrdersLoading(false)
      setOrdersLoaded(true)
    }
  }, [authUser, copy.ordersError])

  useEffect(() => {
    if (!authUser) return undefined
    if (ordersLoaded || ordersLoading) return undefined
    void loadOrders()
    return undefined
  }, [authUser, ordersLoaded, ordersLoading, loadOrders])

  const orderStatusLabel = (status: PaymentOrder["status"]) => {
    const map: Record<PaymentOrder["status"], string> = isZh
      ? { pending: "待支付", paid: "已支付", failed: "失败", refunded: "已退款" }
      : { pending: "Pending", paid: "Paid", failed: "Failed", refunded: "Refunded" }
    return map[status] || status
  }

  const orderMethodLabel = (method: PaymentOrder["method"]) => {
    return method === "wechat" ? (isZh ? "微信支付" : "WeChat Pay") : (isZh ? "支付宝" : "Alipay")
  }

  const formatOrderAmount = (cents: number) => `¥${(cents / 100).toFixed(2)}`

  return (
    <motion.div className="pc-orders-section" variants={itemVariants}>
      <h2 className="pc-section-title">{copy.myOrders}</h2>
      {ordersError && <p className="pc-account-message error">{ordersError}</p>}
      {ordersLoading && !orders.length ? (
        <div className="pc-orders-list" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="pc-order-card"><Skeleton className="pc-order-skel" /></div>
          ))}
        </div>
      ) : orders.length ? (
        <div className="pc-orders-list">
          {orders.map((order) => (
            <article key={order.id} className="pc-order-card">
              <div className="pc-order-card-top">
                <span className="pc-order-plan">{order.planId}</span>
                <span className={`pc-order-status ${order.status}`}>{orderStatusLabel(order.status)}</span>
              </div>
              <div className="pc-order-card-meta">
                <span>{formatOrderAmount(order.amountCents)}</span>
                <span>{orderMethodLabel(order.method)}</span>
              </div>
              <div className="pc-order-card-foot">
                <span className="pc-order-id">{copy.orderNo}: {order.id.slice(0, 12)}</span>
                <span className="pc-order-time"><Clock size={12} />{new Date(order.createdAt).toLocaleString(isZh ? "zh-CN" : "en-US")}</span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="pc-orders-empty">{copy.ordersEmpty}</p>
      )}
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Logout confirmation popup
// ---------------------------------------------------------------------------

function LogoutPopup({
  copy,
  onClose,
  onConfirm,
}: {
  copy: SectionCopy
  onClose: () => void
  onConfirm: () => void | Promise<void>
}) {
  return (
    <motion.div
      className="pc-sub-popup-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onClose}
    >
      <motion.section
        className="pc-sub-popup pc-logout-popup"
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={copy.logoutConfirm}
      >
        <header className="pc-sub-popup-head">
          <h3>{copy.logout}</h3>
          <button type="button" onClick={onClose} aria-label={copy.close}><X size={18} /></button>
        </header>
        <p className="pc-logout-text">{copy.logoutConfirm}</p>
        <p className="pc-logout-hint">{copy.logoutConfirmHint}</p>
        <div className="pc-logout-actions">
          <button type="button" className="pc-account-field-action" onClick={onClose}>{copy.cancel}</button>
          <button type="button" className="pc-logout-confirm" onClick={() => void onConfirm()}>{copy.logout}</button>
        </div>
      </motion.section>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Avatar Picker Popup
// ---------------------------------------------------------------------------

function AvatarPickerPopup({
  language,
  copy,
  authUser,
  onClose,
  onAccountUpdated,
}: {
  language: Language
  copy: SectionCopy
  authUser: AuthUser
  onClose: () => void
  onAccountUpdated: (payload: AccountPayload) => void
}) {
  const [presets, setPresets] = useState<AccountAvatarPreset[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    listAccountAvatarPresets()
      .then((payload) => { if (!cancelled) setPresets(payload.avatars) })
      .catch(() => { if (!cancelled) setPresets([]) })
    return () => { cancelled = true }
  }, [])

  const activePresets = presets.length
    ? presets
    : authUser.avatarUrl
      ? [{ id: authUser.avatarId, label: authUser.name, imageUrl: authUser.avatarUrl, active: true, sortOrder: 0, builtIn: true, createdAt: 0, updatedAt: 0 }]
      : []

  const selectAvatar = async (avatarId: string) => {
    setLoading(true)
    setError("")
    try {
      const payload = await updateAccountProfile({
        name: authUser.name || authUser.username || "",
        email: authUser.email || "",
        avatarId,
      })
      onAccountUpdated(payload)
      onClose()
    } catch (selectError) {
      setError(selectError instanceof Error ? selectError.message : copy.actionFailed)
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      className="pc-sub-popup-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onClose}
    >
      <motion.section
        className="pc-sub-popup pc-avatar-popup"
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        onClick={(event) => event.stopPropagation()}
        aria-label={copy.selectAvatar}
      >
        <header className="pc-sub-popup-head">
          <h3>{copy.selectAvatar}</h3>
          <button type="button" onClick={onClose} aria-label={copy.close}><X size={18} /></button>
        </header>
        <div className="pc-avatar-grid">
          {activePresets.map((preset) => (
            <button
              type="button"
              key={preset.id}
              className={authUser.avatarId === preset.id ? "pc-avatar-grid-item selected" : "pc-avatar-grid-item"}
              onClick={() => void selectAvatar(preset.id)}
              disabled={loading}
              aria-pressed={authUser.avatarId === preset.id}
              aria-label={preset.label}
            >
              <AccountAvatar imageUrl={preset.imageUrl} label={preset.label} />
            </button>
          ))}
        </div>
        {error && <p className="pc-account-message error">{error}</p>}
      </motion.section>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Password Change Popup
// ---------------------------------------------------------------------------

function PasswordChangePopup({
  language,
  copy,
  authUser,
  onClose,
  onAccountUpdated,
}: {
  language: Language
  copy: SectionCopy
  authUser: AuthUser
  onClose: () => void
  onAccountUpdated: (payload: AccountPayload) => void
}) {
  const [currentPassword, setCurrentPassword] = useState("")
  const [nextPassword, setNextPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")

  const hasPassword = authUser.hasPassword

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (nextPassword !== confirmPassword) {
      setError(copy.passwordMismatch)
      return
    }
    setLoading(true)
    setError("")
    setNotice("")
    try {
      const payload = await changeAccountPassword({ currentPassword, nextPassword })
      onAccountUpdated(payload)
      setNotice(copy.passwordUpdated)
      setCurrentPassword("")
      setNextPassword("")
      setConfirmPassword("")
      setTimeout(onClose, 800)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : copy.actionFailed)
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.div
      className="pc-sub-popup-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onClose}
    >
      <motion.section
        className="pc-sub-popup pc-password-popup"
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        onClick={(event) => event.stopPropagation()}
        aria-label={copy.changePassword}
      >
        <header className="pc-sub-popup-head">
          <h3>{copy.changePassword}</h3>
          <button type="button" onClick={onClose} aria-label={copy.close}><X size={18} /></button>
        </header>
        <form className="pc-password-form" onSubmit={submit}>
          <div className="pc-password-field">
            <label className="pc-account-field-label">{copy.currentPassword}</label>
            <input
              type="password"
              className="pc-account-input"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              disabled={loading}
              autoComplete="current-password"
            />
            {!hasPassword && <p className="pc-password-hint">{copy.passwordNotSet}</p>}
          </div>
          <div className="pc-password-field">
            <label className="pc-account-field-label">{copy.newPassword}</label>
            <input
              type="password"
              className="pc-account-input"
              value={nextPassword}
              onChange={(event) => setNextPassword(event.target.value)}
              disabled={loading}
              autoComplete="new-password"
            />
          </div>
          <div className="pc-password-field">
            <label className="pc-account-field-label">{copy.confirmPassword}</label>
            <input
              type="password"
              className="pc-account-input"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              disabled={loading}
              autoComplete="new-password"
            />
          </div>
          {(notice || error) && (
            <p className={error ? "pc-account-message error" : "pc-account-message"} aria-live="polite">{error || notice}</p>
          )}
          <button type="submit" className="pc-password-submit" disabled={loading}>
            {loading ? copy.processing : copy.confirmChange}
          </button>
        </form>
      </motion.section>
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Payment Popup
// ---------------------------------------------------------------------------

function PaymentPopup({
  copy,
  language,
  checkoutPlan,
  method,
  setMethod,
  loading,
  onClose,
  onSubmit,
}: {
  copy: SectionCopy
  language: Language
  checkoutPlan: MembershipPlan
  method: "wechat" | "alipay"
  setMethod: (method: "wechat" | "alipay") => void
  loading: boolean
  onClose: () => void
  onSubmit: () => void
}) {
  return (
    <motion.div
      className="pc-sub-popup-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      onClick={onClose}
    >
      <motion.section
        className="pc-sub-popup pc-payment-popup"
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.18, ease: "easeOut" }}
        onClick={(event) => event.stopPropagation()}
        aria-label={copy.choosePayment}
      >
        <header className="pc-sub-popup-head">
          <h3>{copy.choosePayment}</h3>
          <button type="button" onClick={onClose} aria-label={copy.close}><X size={18} /></button>
        </header>
        <div className="pc-payment-plan-info">
          <span>{copy.selectedPlan}</span>
          <strong>
            {planDisplayName(checkoutPlan, language)} ¥{formatPlanPrice(checkoutPlan.priceCents)}
            <small>{copy.month}</small>
          </strong>
        </div>
        <div className="pc-payment-options">
          <button type="button" className={method === "wechat" ? "selected" : ""} onClick={() => setMethod("wechat")}>
            <span>{copy.wechatPay}</span>
            <small>{copy.wechatPayNote}</small>
          </button>
          <button type="button" className={method === "alipay" ? "selected" : ""} onClick={() => setMethod("alipay")}>
            <span>{copy.alipay}</span>
            <small>{copy.alipayNote}</small>
          </button>
        </div>
        <button type="button" className="pc-payment-submit" onClick={onSubmit} disabled={loading}>
          <CreditCard size={17} />
          {loading ? copy.processing : copy.continuePayment}
        </button>
      </motion.section>
    </motion.div>
  )
}
