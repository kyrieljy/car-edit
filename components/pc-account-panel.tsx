"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"
import {
  BadgeCheck,
  Camera,
  Check,
  CreditCard,
  KeyRound,
  LockKeyhole,
  Receipt,
  UserRound,
  X,
} from "lucide-react"
import { AccountAvatar } from "@/components/account-avatar"
import {
  changeAccountPassword,
  changeAccountPhone,
  formatAccountQuota,
  getAccountOrders,
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
  MembershipPlan,
  PaymentOrder,
} from "@/lib/types"

type AccountMenu = "account" | "subscribe" | "orders"

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
}

const USER_SUBSCRIPTION_CHECKOUT_ENABLED = true

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
      // Subscribe section
      currentPlan: isZh ? "当前会员" : "Current plan",
      configQuota: isZh ? "配置额度" : "Config quota",
      chatQuota: isZh ? "对话额度" : "Chat quota",
      used: isZh ? "已用" : "used",
      unlimited: isZh ? "不限" : "Unlimited",
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
      actionFailed: isZh ? "操作失败。" : "Action failed.",
      logout: isZh ? "退出登录" : "Sign out",
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
}: PcAccountPanelProps) {
  const copy = usePanelCopy(language)
  const [activeMenu, setActiveMenu] = useState<AccountMenu>("account")
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false)
  const [passwordPopupOpen, setPasswordPopupOpen] = useState(false)

  useEffect(() => {
    if (open) {
      setActiveMenu("account")
      setAvatarPickerOpen(false)
      setPasswordPopupOpen(false)
    }
  }, [open])

  const menuItems: { key: AccountMenu; label: string; icon: typeof UserRound }[] = [
    { key: "account", label: copy.account, icon: UserRound },
    { key: "subscribe", label: copy.subscribe, icon: BadgeCheck },
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
            aria-label={language === "zh" ? "账户中心" : "Account"}
          >
            <aside className="pc-account-sidebar">
              <div className="pc-account-sidebar-title">{language === "zh" ? "账户中心" : "Account"}</div>
              <nav className="pc-account-menu">
                {menuItems.map((item) => {
                  const Icon = item.icon
                  return (
                    <button
                      key={item.key}
                      type="button"
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
                  onClick={() => void onLogout()}
                >
                  <span>{copy.logout}</span>
                </button>
              )}
            </aside>

            <div className="pc-account-content">
              <button
                type="button"
                className="pc-account-close"
                onClick={onClose}
                aria-label={copy.close}
              >
                <X size={24} />
              </button>

              {authUser ? (
                <>
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
                  {activeMenu === "subscribe" && (
                    <SubscribeSection
                      language={language}
                      copy={copy}
                      billing={billing}
                      onBillingUpdated={onBillingUpdated}
                    />
                  )}
                  {activeMenu === "orders" && (
                    <OrdersSection language={language} copy={copy} authUser={authUser} />
                  )}
                </>
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
          </motion.section>

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
        </motion.div>
      )}
    </AnimatePresence>
  )

  return createPortal(overlay, document.body)
}

// ---------------------------------------------------------------------------
// Account Section
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
    <div className="pc-account-section">
      <h2 className="pc-section-title">{copy.accountInfo}</h2>

      <div className="pc-account-avatar-row">
        <button type="button" className="pc-account-avatar-btn" onClick={onAvatarClick} aria-label={copy.changeAvatar}>
          <AccountAvatar user={authUser} className="pc-account-avatar-img" />
          <span className="pc-account-avatar-camera">
            <Camera size={14} />
          </span>
        </button>
        <span className="pc-account-avatar-hint">{copy.changeAvatar}</span>
      </div>

      <div className="pc-account-field">
        <label className="pc-account-field-label">{copy.nickname}</label>
        <div className="pc-account-field-row">
          <input
            className="pc-account-input"
            value={name}
            onChange={(event) => setName(event.target.value)}
            disabled={loading}
          />
          <button
            type="button"
            className="pc-account-field-save"
            disabled={!nameChanged || loading}
            onClick={() => void saveName()}
          >
            {copy.save}
          </button>
        </div>
      </div>

      <div className="pc-account-field">
        <label className="pc-account-field-label">{copy.email}</label>
        <div className="pc-account-field-row">
          <input
            className="pc-account-input"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={loading}
          />
          <button
            type="button"
            className="pc-account-field-save"
            disabled={!emailChanged || loading}
            onClick={() => void saveEmail()}
          >
            {copy.save}
          </button>
        </div>
      </div>

      <hr className="pc-account-divider" />

      <div className="pc-account-field">
        <label className="pc-account-field-label">{copy.phone}</label>
        <div className="pc-account-field-row">
          <input
            className="pc-account-input"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            disabled={loading}
          />
          <button
            type="button"
            className="pc-account-field-action"
            disabled={loading || codeCooldown > 0}
            onClick={() => void sendCode()}
          >
            {codeCooldown > 0 ? `${codeCooldown}s` : copy.sendCode}
          </button>
        </div>
      </div>

      <div className="pc-account-field">
        <label className="pc-account-field-label">{copy.codePlaceholder}</label>
        <div className="pc-account-field-row">
          <input
            className="pc-account-input"
            value={phoneCode}
            onChange={(event) => setPhoneCode(event.target.value)}
            disabled={loading}
            placeholder={copy.codePlaceholder}
          />
          <button
            type="button"
            className="pc-account-field-save"
            disabled={loading || !phoneCode}
            onClick={() => void savePhone()}
          >
            {copy.changePhone}
          </button>
        </div>
      </div>

      <hr className="pc-account-divider" />

      <div className="pc-account-password-block">
        <h3 className="pc-account-subtitle">{copy.passwordSecurity}</h3>
        <button type="button" className="pc-account-password-btn" onClick={onPasswordClick}>
          <LockKeyhole size={16} />
          {copy.changePassword}
        </button>
      </div>

      {(notice || error) && (
        <p className={error ? "pc-account-message error" : "pc-account-message"}>{error || notice}</p>
      )}
    </div>
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
      .then((payload) => {
        if (!cancelled) setPresets(payload.avatars)
      })
      .catch(() => {
        if (!cancelled) setPresets([])
      })
    return () => {
      cancelled = true
    }
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
          <button type="button" onClick={onClose} aria-label={copy.close}>
            <X size={18} />
          </button>
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
          <button type="button" onClick={onClose} aria-label={copy.close}>
            <X size={18} />
          </button>
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
            <p className={error ? "pc-account-message error" : "pc-account-message"}>{error || notice}</p>
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
// Subscribe Section
// ---------------------------------------------------------------------------

function SubscribeSection({
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
  const configRemaining = formatAccountQuota(billing?.configRemaining, copy.unlimited)
  const chatRemaining = formatAccountQuota(billing?.chatRemainingToday, copy.unlimited)

  const quotaCards = [
    { label: copy.currentPlan, value: planName, sub: billing?.subscription?.currentPeriodEnd ? new Date(billing.subscription.currentPeriodEnd).toLocaleDateString(isZh ? "zh-CN" : "en-US") : (isZh ? "未订阅" : "No active subscription") },
    { label: copy.configQuota, value: configRemaining, sub: billing ? `${billing.configUsed} ${copy.used}` : "--" },
    { label: copy.chatQuota, value: chatRemaining, sub: billing ? `${billing.chatUsedToday} ${copy.used}` : "--" },
  ]

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
    <div className="pc-subscribe-section">
      <div className="pc-quota-grid">
        {quotaCards.map((card) => (
          <article key={card.label} className="pc-quota-card">
            <span className="pc-quota-label">{card.label}</span>
            <strong className="pc-quota-value">{card.value}</strong>
            <small className="pc-quota-sub">{card.sub}</small>
          </article>
        ))}
      </div>

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
                  <li key={feature}>
                    <Check size={16} />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
            </article>
          )
        })}
      </div>

      {plansLoading && plans.length === 0 && (
        <p className="pc-account-message">{isZh ? "正在加载套餐..." : "Loading plans..."}</p>
      )}

      {userCheckoutDisabled && <p className="pc-account-message">{copy.subscriptionManaged}</p>}
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
    </div>
  )
}

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
          <button type="button" onClick={onClose} aria-label={copy.close}>
            <X size={18} />
          </button>
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

// ---------------------------------------------------------------------------
// Orders Section
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
    <div className="pc-orders-section">
      <h2 className="pc-section-title">{copy.myOrders}</h2>
      {ordersError && <p className="pc-account-message error">{ordersError}</p>}
      {ordersLoading && !orders.length ? (
        <p className="pc-orders-empty">{copy.ordersLoading}</p>
      ) : orders.length ? (
        <div className="pc-orders-table">
          <div className="pc-orders-thead">
            <span>{copy.orderNo}</span>
            <span>{copy.orderPlan}</span>
            <span>{copy.orderAmount}</span>
            <span>{copy.orderMethod}</span>
            <span>{copy.orderStatus}</span>
            <span>{copy.orderTime}</span>
          </div>
          {orders.map((order) => (
            <div className="pc-orders-trow" key={order.id}>
              <span className="pc-orders-id" title={order.id}>{order.id.slice(0, 12)}</span>
              <span>{order.planId}</span>
              <span>{formatOrderAmount(order.amountCents)}</span>
              <span>{orderMethodLabel(order.method)}</span>
              <span className={`pc-orders-status ${order.status}`}>{orderStatusLabel(order.status)}</span>
              <span>{new Date(order.createdAt).toLocaleString(isZh ? "zh-CN" : "en-US")}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="pc-orders-empty">{copy.ordersEmpty}</p>
      )}
    </div>
  )
}
