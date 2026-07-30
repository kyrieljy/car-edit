import type { MembershipPlan, MembershipPlanId } from "@/lib/types"

export type Language = "en" | "zh"

export const planDisplayNameMap: Record<Language, Record<MembershipPlanId, string>> = {
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

const defaultLabelSet = new Set(["Free", "Pro", "Max", "Starter", "Premium", "基础版", "Pro 会员", "Max 会员"])

export function planDisplayName(plan: MembershipPlan, language: Language) {
  if (plan.label && !defaultLabelSet.has(plan.label)) return plan.label
  return planDisplayNameMap[language][plan.id] || plan.label || plan.id
}

export function formatPlanPrice(priceCents: number) {
  return (priceCents / 100).toLocaleString("zh-CN", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
}

export function planFeatures(plan: MembershipPlan, language: Language) {
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

export function annualPriceCents(plan: MembershipPlan) {
  return plan.priceCents === 0 ? 0 : plan.priceCents * 10
}

export const planSortOrder: MembershipPlanId[] = ["free", "pro", "max"]

export function sortPlans(plans: MembershipPlan[]) {
  return [...plans].sort((a, b) => planSortOrder.indexOf(a.id) - planSortOrder.indexOf(b.id))
}
