import { NextResponse } from "next/server"
import { getSiteConfig, updateSiteConfig } from "@/lib/server/db"
import { authErrorResponse, requireAdminUser } from "@/lib/server/auth"
import type { SiteConfig } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const LOCAL_ONLY_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"])

function normalizePublicAssetBaseUrl(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) return ""
  try {
    const url = new URL(trimmed)
    if (url.protocol !== "http:" && url.protocol !== "https:") return null
    if (LOCAL_ONLY_HOSTS.has(url.hostname.toLowerCase())) return null
    return url.origin
  } catch {
    return null
  }
}

function resolveEffectiveBaseUrl(config: SiteConfig): string {
  const dbValue = config.publicAssetBaseUrl.trim()
  if (dbValue) {
    try {
      const url = new URL(dbValue)
      if ((url.protocol === "http:" || url.protocol === "https:") && !LOCAL_ONLY_HOSTS.has(url.hostname.toLowerCase())) {
        return url.origin
      }
    } catch {
      // Fall through to environment variables.
    }
  }

  const envValue =
    process.env.PROVIDER_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.APP_URL ||
    process.env.SITE_URL ||
    ""
  if (!envValue.trim()) return ""
  try {
    const url = new URL(envValue)
    if (url.protocol !== "http:" && url.protocol !== "https:") return ""
    if (LOCAL_ONLY_HOSTS.has(url.hostname.toLowerCase())) return ""
    return url.origin
  } catch {
    return ""
  }
}

function configWithEffective(config: SiteConfig) {
  return { ...config, effectiveBaseUrl: resolveEffectiveBaseUrl(config) }
}

export async function GET() {
  try {
    requireAdminUser()
    return NextResponse.json(configWithEffective(getSiteConfig()))
  } catch (error) {
    return authErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    requireAdminUser()
    const body = await request.json()
    const raw = typeof body.publicAssetBaseUrl === "string" ? body.publicAssetBaseUrl : ""
    const normalized = normalizePublicAssetBaseUrl(raw)
    if (normalized === null) {
      return NextResponse.json(
        { error: "PUBLIC_ASSET_BASE_URL must be a valid http/https URL and cannot be a localhost address." },
        { status: 400 },
      )
    }
    const config = updateSiteConfig({ publicAssetBaseUrl: normalized })
    return NextResponse.json(configWithEffective(config))
  } catch (error) {
    return authErrorResponse(error)
  }
}
