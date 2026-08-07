import { NextResponse } from "next/server"
import { authErrorResponse, requireAdminUser } from "@/lib/server/auth"
import { getAdminTestConfig, getCatalog, listImageParamTests, upsertImageParamTest } from "@/lib/server/db"
import { runAdminImageParamTest } from "@/lib/server/generation-engine"
import { buildConfigStandardJson } from "@/lib/generation-core"
import { paintFromId } from "@/lib/prompts"
import type { CatalogResponse, GenerationStandardJson, ImageParamTestResult, PaintFinishEffect, PaintGradient } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/** Resolve a config-mode StandardJson from the saved admin test fixture. */
function buildTestStandardJson(testConfig: NonNullable<ReturnType<typeof getAdminTestConfig>>, catalog: CatalogResponse): GenerationStandardJson {
  const paint = paintFromId(testConfig.paintId, catalog.paints)
  const paintFinishEffect = testConfig.paintFinishEffect as PaintFinishEffect
  const gradientPaint = paintFinishEffect === "gradient" ? ((testConfig.gradientPaint as PaintGradient | null) ?? undefined) : undefined
  return buildConfigStandardJson({
    sourceImageUrl: testConfig.sourceImageUrl,
    selections: testConfig.selections,
    selectionOptions: testConfig.selectionOptions,
    assets: catalog.assets,
    categories: catalog.categories,
    paint,
    paintFinishEffect,
    paintGradient: gradientPaint,
    stance: testConfig.stance,
    vehicleNote: "",
    vehicleModel: testConfig.displayVehicleModel ?? "",
  })
}

/** GET /api/admin/provider-configs/compare-test?providerId=&paramKey= — cached results for a (provider, param). */
export async function GET(request: Request) {
  try {
    requireAdminUser()
    const { searchParams } = new URL(request.url)
    const providerId = searchParams.get("providerId") || ""
    const paramKey = searchParams.get("paramKey") || ""
    if (!providerId || !paramKey) {
      return NextResponse.json({ error: "providerId and paramKey are required." }, { status: 400 })
    }
    const results = listImageParamTests(providerId, paramKey)
    return NextResponse.json({ results })
  } catch (error) {
    return (error as { status?: number }).status ? authErrorResponse(error) : NextResponse.json({ error: error instanceof Error ? error.message : "Failed to read comparison results" }, { status: 400 })
  }
}

/**
 * POST /api/admin/provider-configs/compare-test — run a comparison test.
 * - { providerId, paramKey, regenerateValue } runs a single value (F5 重新生成).
 * - { providerId, paramKey, values? } runs all values; defaults to the param's configured
 *   option set (excluding the empty "do not send" value) when values is omitted (F2).
 * Runs each value through the real generation pipeline (no user entitlement / no generation_jobs),
 * upserts the result cache, and returns the full (provider, param) cache.
 */
export async function POST(request: Request) {
  try {
    requireAdminUser()
    const body = await request.json()
    const providerId = String(body.providerId || "")
    const paramKey = String(body.paramKey || "")
    if (!providerId || !paramKey) {
      return NextResponse.json({ error: "providerId and paramKey are required." }, { status: 400 })
    }

    const testConfig = getAdminTestConfig()
    if (!testConfig || !testConfig.sourceImageUrl || Object.keys(testConfig.selections).length === 0) {
      return NextResponse.json({ error: "请先在底部「测试配件设置」中配置原车图与至少一个配件，再发起对比测试。" }, { status: 400 })
    }

    const catalog = getCatalog()
    let values: string[]
    if (typeof body.regenerateValue === "string" && body.regenerateValue.length > 0) {
      values = [body.regenerateValue]
    } else if (Array.isArray(body.values) && body.values.length > 0) {
      values = body.values.map((v: unknown) => String(v))
    } else {
      const provider = catalog.providers.find((p) => p.id === providerId)
      const param = provider?.options.imageParams.find((p) => p.key === paramKey)
      values = param ? param.options.filter((v) => v !== "") : []
    }
    if (values.length === 0) {
      return NextResponse.json({ error: "No comparison values resolved for this parameter." }, { status: 400 })
    }

    const standardJson = buildTestStandardJson(testConfig, catalog)
    const settled = await Promise.allSettled(
      values.map((value) =>
        runAdminImageParamTest({
          providerId,
          paramKey,
          paramValue: value,
          sourceImageUrl: testConfig.sourceImageUrl,
          standardJson,
        }),
      ),
    )

    settled.forEach((result, index) => {
      const paramValue = values[index]
      if (result.status === "fulfilled") {
        const outcome = result.value
        upsertImageParamTest({
          providerId,
          paramKey,
          paramValue,
          resultImageUrl: outcome.resultImageUrl,
          status: outcome.status,
          errorDetail: outcome.errorDetail,
          latencyMs: outcome.latencyMs,
        })
      } else {
        upsertImageParamTest({
          providerId,
          paramKey,
          paramValue,
          resultImageUrl: "",
          status: "failed",
          errorDetail: result.reason instanceof Error ? result.reason.message : String(result.reason),
          latencyMs: 0,
        })
      }
    })

    const results: ImageParamTestResult[] = listImageParamTests(providerId, paramKey)
    return NextResponse.json({ results })
  } catch (error) {
    return (error as { status?: number }).status ? authErrorResponse(error) : NextResponse.json({ error: error instanceof Error ? error.message : "Comparison test failed" }, { status: 400 })
  }
}
