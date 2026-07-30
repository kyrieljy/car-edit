import { useEffect, useMemo, useState } from "react"
import type { MembershipPlan } from "@/lib/types"
import { sortPlans } from "@/lib/subscription-display"

export type UseSubscriptionPlansResult = {
  plans: MembershipPlan[]
  loading: boolean
  error: string
}

/**
 * Fetch and sort membership plans from /api/billing/plans.
 * Only fetches when `enabled` is true.
 */
export function useSubscriptionPlans(enabled: boolean, errorMessage: string): UseSubscriptionPlansResult {
  const [plans, setPlans] = useState<MembershipPlan[]>([])
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!enabled) return undefined
    let cancelled = false
    setLoading(true)
    setError("")
    fetch("/api/billing/plans")
      .then((response) => response.json())
      .then((body) => {
        if (!cancelled) setPlans(body.plans || [])
      })
      .catch(() => {
        if (!cancelled) setError(errorMessage)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [enabled, errorMessage])

  const sortedPlans = useMemo(() => sortPlans(plans), [plans])

  return { plans: sortedPlans, loading, error }
}
