import { NextResponse } from "next/server"
import { authErrorResponse, requireAdminUser } from "@/lib/server/auth"
import { createGeneration, getGeneration, writeAudit } from "@/lib/server/db"
import type { GenerationStandardJson, SelectionMap, PartSelectionOptions } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    const admin = requireAdminUser()
    const original = getGeneration(params.id)

    const standardJson = (original.standardJson ?? {}) as GenerationStandardJson
    const selections = (original.selections ?? {}) as SelectionMap
    const selectionOptions = (original.selectionOptions ?? {}) as PartSelectionOptions

    const newJob = createGeneration({
      userId: original.userId,
      mode: original.mode,
      provider: original.provider,
      vehicleUploadId: original.vehicleUploadId,
      sourceImageUrl: original.sourceImageUrl,
      displayVehicleModel: original.displayVehicleModel,
      paintId: original.paintId,
      stance: original.stance,
      selections,
      selectionOptions,
      standardJson,
      workflowId: original.workflowId,
      promptVersion: original.promptVersion,
      promptSummary: original.promptSummary,
      promptHidden: original.promptHidden,
      retryCount: original.retryCount + 1,
    })

    writeAudit(admin.id, "admin.generation.retry", {
      originalJobId: params.id,
      newJobId: newJob.id,
      userId: original.userId,
      mode: original.mode,
    })

    return NextResponse.json({ ok: true, jobId: newJob.id })
  } catch (error) {
    return (error as { status?: number }).status
      ? authErrorResponse(error)
      : NextResponse.json({ error: error instanceof Error ? error.message : "Retry failed" }, { status: 400 })
  }
}
