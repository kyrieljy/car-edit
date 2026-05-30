import { NextResponse } from "next/server"
import { listUserGenerations, saveGarage, updateGenerationStoredImages } from "@/lib/server/db"
import { authErrorResponse, requireUser } from "@/lib/server/auth"
import { materializeImageUrl } from "@/lib/server/image-materializer"
import type { GenerationJob } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const user = requireUser()
    const generations = await Promise.all(listUserGenerations(user.id).map((job) => safeMaterializeGenerationHistoryJob(job, user.id)))
    return NextResponse.json({ generations })
  } catch (error) {
    return authErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const user = requireUser()
    const body = await request.json()
    if (!body.generationId) return NextResponse.json({ error: "generationId is required" }, { status: 400 })
    return NextResponse.json(saveGarage(String(body.generationId), user.id))
  } catch (error) {
    return authErrorResponse(error)
  }
}

async function materializeGenerationHistoryJob(job: GenerationJob, userId: string) {
  const [source, result] = await Promise.all([
    materializeImageUrl(job.sourceImageUrl, "vehicle_upload", `source-${job.id}`),
    materializeImageUrl(job.resultImageUrl, "result", `result-${job.id}`),
  ])
  const sourceImageUrl = source?.url && source.url !== job.sourceImageUrl ? source.url : ""
  const resultImageUrl = result?.url && result.url !== job.resultImageUrl ? result.url : ""
  if (!sourceImageUrl && !resultImageUrl) return job
  const updated = updateGenerationStoredImages({
    generationId: job.id,
    userId,
    sourceImageUrl: sourceImageUrl || undefined,
    sourceMime: source?.mime,
    sourceSize: source?.size,
    resultImageUrl: resultImageUrl || undefined,
  })
  return updated ?? {
    ...job,
    sourceImageUrl: sourceImageUrl || job.sourceImageUrl,
    resultImageUrl: resultImageUrl || job.resultImageUrl,
  }
}

async function safeMaterializeGenerationHistoryJob(job: GenerationJob, userId: string) {
  try {
    return await materializeGenerationHistoryJob(job, userId)
  } catch (error) {
    console.warn("[garage] history image materialization failed", {
      generationId: job.id,
      userId,
      sourceImageUrl: job.sourceImageUrl,
      resultImageUrl: job.resultImageUrl,
      error: error instanceof Error ? error.message : String(error),
    })
    return job
  }
}
