"use client"

import { useEffect, useMemo, useState } from "react"
import { createPortal } from "react-dom"
import { AnimatePresence, motion } from "framer-motion"
import { Check, ChevronLeft, CreditCard, X } from "lucide-react"
import { ACCOUNT_MESSAGES_REFRESH_EVENT } from "@/lib/account-events"
import type { EntitlementStatus, MembershipPlan, MembershipPlanId } from "@/lib/types"

type Language = "en" | "zh"
type BillingCycle = "monthly" | "yearly"
type MobileTheme = "dark" | "light"

const mobilePlanTabIds: MembershipPlanId[] = ["free", "pro", "max"]

type SubscribeModalProps = {
  open: boolean
  language: Language
  mobileTheme?: MobileTheme
  billing?: EntitlementStatus | null
  onClose: () => void
  onUpdated: (billing: EntitlementStatus) => void
}

const displayName: Record<Language, Record<MembershipPlanId, string>> = {
  en: {
    free: "Starter",
    pro: "Pro",
    max: "Premium",
  },
  zh: {
    free: "基础版",
    pro: "Pro 会员",
    max: "Max 会员",
  },
}

const subscribeCopy = {
  en: {
    close: "Close",
    closePayment: "Close payment",
    title: "Choose your membership",
    subtitle: "Upgrade for more renders, chat mode access, and a complete car modification workflow.",
    currentPlan: "Current plan",
    featured: "Featured",
    month: "/month",
    keep: "Keep",
    get: "Get",
    choosePayment: "Choose payment method",
    selectedPlan: "Selected plan",
    wechatPay: "WeChat Pay",
    wechatPayNote: "Mock WeChat payment",
    alipay: "Alipay",
    alipayNote: "Mock Alipay payment",
    processing: "Processing...",
    continuePayment: "Continue to payment",
    planLoadFailed: "Plan loading failed.",
    checkoutFailed: "Checkout failed.",
    mockPaymentFailed: "Mock payment failed.",
    subscriptionFailed: "Subscription failed.",
  },
  zh: {
    close: "关闭",
    closePayment: "关闭支付",
    title: "选择适合你的会员方案",
    subtitle: "升级后可获得更多生成额度、对话模式和完整改装效果工作流。",
    currentPlan: "当前方案",
    featured: "推荐",
    month: "/月",
    keep: "保留",
    get: "开通",
    choosePayment: "选择支付方式",
    selectedPlan: "已选方案",
    wechatPay: "微信支付",
    wechatPayNote: "微信支付 Mock 流程",
    alipay: "支付宝",
    alipayNote: "支付宝 Mock 流程",
    processing: "处理中...",
    continuePayment: "继续支付",
    planLoadFailed: "套餐加载失败。",
    checkoutFailed: "创建支付订单失败。",
    mockPaymentFailed: "模拟支付失败。",
    subscriptionFailed: "订阅失败。",
  },
} satisfies Record<Language, Record<string, string>>

const mobileCopy = {
  en: {
    pageTitle: "Membership",
    detailLink: "Benefits",
    pointsUnit: "credits / month",
    monthly: "Monthly plan",
    yearly: "Annual plan",
    yearlyNote: "Save about 2 months",
    autoRenew: "Auto-renewal",
    current: "Current",
    included: "Included",
    loadingPlans: "Loading plans",
    ctaFree: "Continue with Starter",
    ctaPaid: "Subscribe now",
    ctaCurrent: "Current plan",
    terms: "Auto-renewal can be canceled anytime. Local testing uses mock payment.",
    planTabs: {
      free: "Starter",
      pro: "Pro",
      max: "Premium",
    },
    planSummary: {
      free: "A lightweight starting point for trying configuration mode.",
      pro: "For frequent renders and controlled chat-mode exploration.",
      max: "For complete creative workflows with unlimited chat generation.",
    },
    points: {
      free: 725,
      pro: 2210,
      max: 6160,
    },
  },
  zh: {
    pageTitle: "会员中心",
    detailLink: "权益明细",
    pointsUnit: "积分/月",
    monthly: "连续包月",
    yearly: "连续包年",
    yearlyNote: "约省 2 个月",
    autoRenew: "自动续费",
    current: "当前方案",
    included: "已包含",
    loadingPlans: "正在加载套餐",
    ctaFree: "继续免费版",
    ctaPaid: "立即开通",
    ctaCurrent: "当前方案",
    terms: "自动续费可随时取消，本地演示使用模拟支付。",
    planTabs: {
      free: "基础会员",
      pro: "专业会员",
      max: "高级会员",
    },
    planSummary: {
      free: "适合快速体验配置模式，保留基础生成能力。",
      pro: "适合高频改装预览，开放每日对话生成额度。",
      max: "适合完整创作工作流，解锁不限次数对话生成。",
    },
    points: {
      free: 725,
      pro: 2210,
      max: 6160,
    },
  },
} satisfies Record<
  Language,
  {
    pageTitle: string
    detailLink: string
    pointsUnit: string
    monthly: string
    yearly: string
    yearlyNote: string
    autoRenew: string
    current: string
    included: string
    loadingPlans: string
    ctaFree: string
    ctaPaid: string
    ctaCurrent: string
    terms: string
    planTabs: Record<MembershipPlanId, string>
    planSummary: Record<MembershipPlanId, string>
    points: Record<MembershipPlanId, number>
  }
>

function planDisplayName(plan: MembershipPlan, language: Language) {
  const defaultLabels = new Set(["Free", "Pro", "Max", "Starter", "Premium", "基础版", "Pro 会员", "Max 会员"])
  if (plan.label && !defaultLabels.has(plan.label)) return plan.label
  return displayName[language][plan.id] || plan.label || plan.id
}

function formatPlanPrice(priceCents: number) {
  return (priceCents / 100).toLocaleString("zh-CN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

function planFeatures(plan: MembershipPlan, language: Language) {
  if (language === "zh") {
    return [
      plan.configUnlimited ? "配置模式不限次数" : `配置模式 ${plan.configLimit} 次`,
      plan.chatEnabled ? (plan.chatUnlimited ? "对话模式不限次数" : `对话模式每日 ${plan.chatDailyLimit} 次`) : "对话模式暂不开放",
      `月费 ¥${formatPlanPrice(plan.priceCents)}`,
      "微信 / 支付宝支付",
    ]
  }
  return [
    plan.configUnlimited ? "Unlimited config mode renders" : `${plan.configLimit} config mode renders`,
    plan.chatEnabled ? (plan.chatUnlimited ? "Unlimited chat generations" : `${plan.chatDailyLimit} chat generations per day`) : "Chat mode locked",
    `Monthly price ¥${formatPlanPrice(plan.priceCents)}`,
    "WeChat / Alipay checkout",
  ]
}

function annualPriceCents(plan: MembershipPlan) {
  return plan.priceCents === 0 ? 0 : plan.priceCents * 10
}

export function SubscribeModal({ open, language, mobileTheme = "dark", billing, onClose, onUpdated }: SubscribeModalProps) {
  const [plans, setPlans] = useState<MembershipPlan[]>([])
  const [selectedPlanId, setSelectedPlanId] = useState<MembershipPlanId>("pro")
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly")
  const [checkoutPlan, setCheckoutPlan] = useState<MembershipPlan | null>(null)
  const [method, setMethod] = useState<"wechat" | "alipay">("wechat")
  const [notice, setNotice] = useState("")
  const [loading, setLoading] = useState(false)
  const t = subscribeCopy[language]
  const mobile = mobileCopy[language]

  useEffect(() => {
    if (!open) {
      setCheckoutPlan(null)
      setNotice("")
      return
    }
    setSelectedPlanId(billing?.plan.id && billing.plan.id !== "free" ? billing.plan.id : "pro")
    setBillingCycle("monthly")
    fetch("/api/billing/plans")
      .then((response) => response.json())
      .then((body) => setPlans(body.plans || []))
      .catch(() => setNotice(t.planLoadFailed))
  }, [billing?.plan.id, open, t.planLoadFailed])

  const visiblePlans = useMemo(() => {
    const order: MembershipPlanId[] = ["free", "pro", "max"]
    return [...plans].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id))
  }, [plans])

  const displayPlans = useMemo(() => {
    if (visiblePlans.length > 0) return visiblePlans
    return []
  }, [visiblePlans])

  const selectedPlan = useMemo(() => {
    return (
      displayPlans.find((plan) => plan.id === selectedPlanId) ||
      displayPlans.find((plan) => plan.id === "pro") ||
      displayPlans[0] ||
      null
    )
  }, [displayPlans, selectedPlanId])

  const completeCheckout = async (plan: MembershipPlan | null, selectedMethod = method) => {
    if (!plan) return
    if (plan.id === "free") {
      onClose()
      return
    }
    setLoading(true)
    setNotice("")
    try {
      const response = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: plan.id, method: selectedMethod, cycle: billingCycle }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || t.checkoutFailed)
      const paid = await fetch("/api/billing/mock-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: body.order.id }),
      })
      const paidBody = await paid.json()
      if (!paid.ok) throw new Error(paidBody.error || t.mockPaymentFailed)
      onUpdated(paidBody.billing)
      window.dispatchEvent(new Event(ACCOUNT_MESSAGES_REFRESH_EVENT))
      setCheckoutPlan(null)
      onClose()
    } catch (error) {
      setNotice(error instanceof Error ? error.message : t.subscriptionFailed)
    } finally {
      setLoading(false)
    }
  }

  if (typeof document === "undefined") return null

  const selectedPlanTabId = mobilePlanTabIds.includes(selectedPlanId) ? selectedPlanId : "pro"
  const selectedPlanTabIndex = mobilePlanTabIds.indexOf(selectedPlanTabId)
  const mobilePlanName = selectedPlan ? mobile.planTabs[selectedPlan.id] : mobile.loadingPlans
  const mobileMonthlyPrice = selectedPlan ? formatPlanPrice(selectedPlan.priceCents) : "--"
  const mobileYearlyPrice = selectedPlan ? formatPlanPrice(annualPriceCents(selectedPlan)) : "--"
  const selectedIsCurrent = Boolean(selectedPlan && billing?.plan.id === selectedPlan.id)
  const selectedIsPaidToFree = Boolean(selectedPlan?.id === "free" && billing?.plan.id && billing.plan.id !== "free")
  const currentPlanName = billing ? planDisplayName(billing.plan, language) : ""
  const mobileCtaText = selectedIsCurrent
    ? mobile.ctaCurrent
    : selectedIsPaidToFree
      ? language === "zh"
        ? `当前为 ${currentPlanName}`
        : `Current: ${currentPlanName}`
    : selectedPlan?.id === "free"
      ? mobile.ctaFree
      : mobile.ctaPaid
  const selectedPlanFeatures = selectedPlan ? planFeatures(selectedPlan, language) : []
  const selectedPlanTitle = selectedPlan ? planDisplayName(selectedPlan, language) : mobilePlanName

  const overlay = (
    <AnimatePresence>
      {open && (
        <motion.div
          key="subscribe-pricing-backdrop"
          className="modal-backdrop pricing-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
      <motion.section
        className="subscribe-mobile-screen"
        data-lang={language}
        data-mobile-theme={mobileTheme}
        aria-label={mobile.pageTitle}
        initial={{ x: "100%", opacity: 0.96 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: "100%", opacity: 0.96 }}
        transition={{ type: "spring", stiffness: 300, damping: 34 }}
      >
        <div className="subscribe-mobile-layout">
          <header className="subscribe-mobile-topbar">
            <button className="subscribe-mobile-back" onClick={onClose} aria-label={t.close}>
              <ChevronLeft size={22} />
            </button>
            <div className="subscribe-mobile-theme-pill" aria-hidden="true">
              <span className={mobileTheme === "dark" ? "active" : ""}>{language === "zh" ? "暗色" : "Dark"}</span>
              <span className={mobileTheme === "light" ? "active" : ""}>{language === "zh" ? "亮色" : "Light"}</span>
            </div>
          </header>

          <section className="subscribe-mobile-intro">
            <h2>{language === "zh" ? "升级会员" : "Upgrade membership"}</h2>
            <p>{t.subtitle}</p>
          </section>

          <div className="subscribe-mobile-tabs" role="tablist" aria-label={mobile.pageTitle}>
            <motion.span
              className="subscribe-mobile-tab-thumb"
              layoutId="subscribe-mobile-tab-thumb"
              style={{
                width: `${100 / mobilePlanTabIds.length}%`,
                left: `${selectedPlanTabIndex * (100 / mobilePlanTabIds.length)}%`,
              }}
              transition={{ type: "spring", stiffness: 360, damping: 34 }}
            />
            {mobilePlanTabIds.map((planId) => (
              <button
                key={planId}
                role="tab"
                aria-selected={selectedPlanTabId === planId}
                className={selectedPlanTabId === planId ? "selected" : ""}
                onClick={() => setSelectedPlanId(planId)}
              >
                {mobile.planTabs[planId]}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait" initial={false}>
            <motion.article
              key={selectedPlan?.id || "loading"}
              className="subscribe-mobile-explain-card"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            >
              <h3>{selectedPlanTitle}{language === "zh" ? " 改装创作包" : " tuning pack"}</h3>
              <p>{selectedPlan ? mobile.planSummary[selectedPlan.id] : mobile.loadingPlans}</p>
              <ul aria-label={mobile.included}>
                {selectedPlanFeatures.slice(0, 4).map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </motion.article>
          </AnimatePresence>

          <div className="subscribe-mobile-price-grid">
            <button
              className={billingCycle === "monthly" ? "subscribe-mobile-price-row selected" : "subscribe-mobile-price-row"}
              onClick={() => setBillingCycle("monthly")}
            >
              <strong>¥{mobileMonthlyPrice} / {language === "zh" ? "月" : "mo"}</strong>
              <span>{language === "zh" ? "随时取消" : "Cancel anytime"}</span>
            </button>
            <button
              className={billingCycle === "yearly" ? "subscribe-mobile-price-row selected" : "subscribe-mobile-price-row"}
              onClick={() => setBillingCycle("yearly")}
            >
              <strong>¥{mobileYearlyPrice} / {language === "zh" ? "年" : "yr"}</strong>
              <span>{mobile.yearlyNote}</span>
            </button>
          </div>

          {selectedPlan && selectedPlan.id !== "free" && !selectedIsCurrent && (
            <div className="subscribe-mobile-payment-methods" role="group" aria-label={t.choosePayment}>
              <button type="button" className={method === "wechat" ? "selected" : ""} onClick={() => setMethod("wechat")}>
                <span className="subscribe-pay-icon wechat" aria-hidden="true">
                  <svg viewBox="0 0 24 24" focusable="false">
                    <path d="M9.5 5.2c-4 0-7.2 2.5-7.2 5.7 0 1.8 1 3.4 2.7 4.5l-.7 2.3 2.7-1.3c.8.2 1.6.3 2.5.3 4 0 7.2-2.5 7.2-5.7S13.5 5.2 9.5 5.2Z" />
                    <path d="M14.8 10.6c3.4 0 6.1 2.1 6.1 4.8 0 1.5-.8 2.8-2.2 3.8l.6 1.9-2.2-1c-.7.2-1.4.2-2.2.2-3.4 0-6.1-2.1-6.1-4.8s2.6-4.9 6-4.9Z" />
                  </svg>
                </span>
                <span>{t.wechatPay}</span>
              </button>
              <button type="button" className={method === "alipay" ? "selected" : ""} onClick={() => setMethod("alipay")}>
                <span className="subscribe-pay-icon alipay" aria-hidden="true">支</span>
                <span>{t.alipay}</span>
              </button>
            </div>
          )}

          <button
            className="subscribe-mobile-cta"
            disabled={!selectedPlan || loading || selectedIsCurrent || selectedIsPaidToFree}
            onClick={() => {
              if (!selectedPlan) return
              if (selectedPlan.id === "free") {
                void completeCheckout(selectedPlan, method)
                return
              }
              setCheckoutPlan(selectedPlan)
            }}
          >
            {loading ? t.processing : `${mobileCtaText}${selectedPlan && !selectedIsCurrent && selectedPlan.id !== "free" ? ` ${selectedPlanTitle}` : ""}`}
          </button>

          {notice && <p className="auth-notice pricing-notice">{notice}</p>}
        </div>
      </motion.section>

      <motion.section
        className="subscribe-modal pricing-template"
        data-lang={language}
        initial={{ opacity: 0, y: 18, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 12, scale: 0.985 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
      >
        <button className="modal-close pricing-close" onClick={onClose} aria-label={t.close}>
          <X size={18} />
        </button>

        <header className="pricing-template-head">
          <h2>{t.title}</h2>
          <p>{t.subtitle}</p>
          {billing && (
            <small>
              {t.currentPlan}: {planDisplayName(billing.plan, language)}
            </small>
          )}
        </header>

        <div className="pricing-template-grid">
          {visiblePlans.map((plan) => {
            const featured = plan.id === "pro"
            const price = formatPlanPrice(plan.priceCents)
            const planIsPaidToFree = plan.id === "free" && Boolean(billing?.plan.id && billing.plan.id !== "free")
            return (
              <article className={featured ? "pricing-template-card featured" : "pricing-template-card"} key={plan.id}>
                {featured && <div className="pricing-featured">{t.featured}</div>}
                <div className="pricing-plan-title">
                  <h3>{planDisplayName(plan, language)}</h3>
                  <div>
                    <strong>¥{price}</strong>
                    <span>{t.month}</span>
                  </div>
                </div>
                <button disabled={planIsPaidToFree} onClick={() => (plan.id === "free" ? onClose() : setCheckoutPlan(plan))}>
                  {planIsPaidToFree ? (language === "zh" ? "到期后回到免费版" : "Returns after expiry") : plan.id === "free" ? `${t.keep} ${planDisplayName(plan, language)}` : `${t.get} ${planDisplayName(plan, language)}`}
                </button>
                <ul>
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

        {notice && <p className="auth-notice pricing-notice">{notice}</p>}
      </motion.section>

      {checkoutPlan && (
        <motion.section
          className="payment-template-modal"
          data-lang={language}
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.98 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          <button className="modal-close pricing-close" onClick={() => setCheckoutPlan(null)} aria-label={t.closePayment}>
            <X size={18} />
          </button>
          <header>
            <h3>{t.choosePayment}</h3>
            <div>
              <span>{t.selectedPlan}</span>
              <strong>
                {displayName[language][checkoutPlan.id]} ¥{formatPlanPrice(checkoutPlan.priceCents)}
                <small>{t.month}</small>
              </strong>
            </div>
          </header>
          <div className="payment-template-options">
            <button className={method === "wechat" ? "selected" : ""} onClick={() => setMethod("wechat")}>
              <span>{t.wechatPay}</span>
              <small>{t.wechatPayNote}</small>
            </button>
            <button className={method === "alipay" ? "selected" : ""} onClick={() => setMethod("alipay")}>
              <span>{t.alipay}</span>
              <small>{t.alipayNote}</small>
            </button>
          </div>
          <button className="payment-template-submit" onClick={() => void completeCheckout(checkoutPlan)} disabled={loading}>
            <CreditCard size={17} />
            {loading ? t.processing : t.continuePayment}
          </button>
        </motion.section>
      )}
        </motion.div>
      )}
    </AnimatePresence>
  )

  return createPortal(overlay, document.body)
}
