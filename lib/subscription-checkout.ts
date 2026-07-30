import { ACCOUNT_MESSAGES_REFRESH_EVENT } from "@/lib/account-events"
import type { EntitlementStatus, MembershipPlan } from "@/lib/types"

export type CheckoutCycle = "monthly" | "yearly"

export type CheckoutMessages = {
  checkoutFailed: string
  mockPaymentFailed: string
  subscriptionFailed: string
}

/**
 * Complete a two-step mock checkout: create order via /api/billing/checkout,
 * then mark it paid via /api/billing/mock-paid. Returns the updated billing status.
 */
export async function completeSubscriptionCheckout(
  plan: MembershipPlan,
  method: "wechat" | "alipay",
  cycle: CheckoutCycle,
  messages: CheckoutMessages,
): Promise<EntitlementStatus> {
  const response = await fetch("/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ planId: plan.id, method, cycle }),
  })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || messages.checkoutFailed)
  const paid = await fetch("/api/billing/mock-paid", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId: body.order.id }),
  })
  const paidBody = await paid.json()
  if (!paid.ok) throw new Error(paidBody.error || messages.mockPaymentFailed)
  window.dispatchEvent(new Event(ACCOUNT_MESSAGES_REFRESH_EVENT))
  return paidBody.billing as EntitlementStatus
}
