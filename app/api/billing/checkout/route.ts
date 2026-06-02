import { NextResponse } from "next/server"
import { authErrorResponse, requireUser } from "@/lib/server/auth"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const SUBSCRIPTION_CHECKOUT_DISABLED_ERROR = "测试版已关闭自助开通，请联系管理员爸爸配置套餐和额度。"

export async function POST() {
  try {
    requireUser()
    return NextResponse.json({ error: SUBSCRIPTION_CHECKOUT_DISABLED_ERROR, code: "SUBSCRIPTION_MANAGED_BY_ADMIN" }, { status: 403 })
  } catch (error) {
    return error instanceof Error && !(error as { status?: number }).status
      ? NextResponse.json({ error: error.message }, { status: 400 })
      : authErrorResponse(error)
  }
}
