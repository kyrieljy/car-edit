import { NextResponse } from "next/server"
import { authErrorResponse, requireUser } from "@/lib/server/auth"
import { getCatalog, getProviderApiKey, getWorkflowConfigByMode } from "@/lib/server/db"
import { runMockGuardrail } from "@/lib/server/guardrail"
import { recognizePartWithProvider, recognizeVehicleWithProvider } from "@/lib/server/vision-provider"
import { validateImageUpload, validateImageUploadTotal } from "@/lib/upload-limits"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: Request) {
  try {
    requireUser()
    const formData = await request.formData()
    const file = formData.get("vehicleImage")
    const partImages = formData.getAll("partImages").filter((item): item is File => item instanceof File)
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "vehicleImage is required" }, { status: 400 })
    }
    const uploadFiles = [file, ...partImages]
    const invalidUpload = uploadFiles.map((item) => validateImageUpload(item, "image")).find((result) => !result.ok)
    if (invalidUpload && !invalidUpload.ok) {
      return NextResponse.json({ error: invalidUpload.error }, { status: invalidUpload.status })
    }
    const totalUploadValidation = validateImageUploadTotal(uploadFiles)
    if (!totalUploadValidation.ok) {
      return NextResponse.json({ error: totalUploadValidation.error }, { status: totalUploadValidation.status })
    }

    const workflow = getWorkflowConfigByMode("recognition")
    const catalog = getCatalog()
    const vehicleNode = workflow.nodes.find((node) => node.type === "vehicle_detection" && node.enabled)
    const partNode = workflow.nodes.find((node) => node.type === "part_detection" && node.enabled)
    const vehicleProvider = vehicleNode?.providerId ? catalog.providers.find((provider) => provider.id === vehicleNode.providerId && provider.enabled && provider.capabilities.includes("vision")) : null
    const partProvider = partNode?.providerId ? catalog.providers.find((provider) => provider.id === partNode.providerId && provider.enabled && provider.capabilities.includes("vision")) : null
    if (vehicleNode?.providerId && !vehicleProvider) {
      return NextResponse.json({ error: "图片识别 Workflow 的车辆识别模型未启用或能力不匹配。" }, { status: 400 })
    }
    if (partNode?.providerId && !partProvider) {
      return NextResponse.json({ error: "图片识别 Workflow 的配件识别模型未启用或能力不匹配。" }, { status: 400 })
    }

    const guardrail = runMockGuardrail({
      hasVehicleImage: true,
      text: "vehicle recognition",
      fileTypes: uploadFiles.map((item) => item.type),
    })
    if (!guardrail.allowed) {
      return NextResponse.json({ workflowId: workflow.id, guardrail, error: guardrail.reason }, { status: 400 })
    }
    if (!vehicleProvider) {
      return NextResponse.json({ error: "图片识别 Workflow 未配置可用的车辆识别模型。" }, { status: 400 })
    }

    const vehiclePrompt =
      catalog.promptTemplates.find((template) => template.id === vehicleNode?.promptTemplateId && template.active)?.body || ""
    const vehicleRecognition = await recognizeVehicleWithProvider({
      provider: vehicleProvider,
      apiKey: getProviderApiKey(vehicleProvider.id),
      image: file,
      prompt: vehiclePrompt,
    })
    if (!vehicleRecognition.ok) {
      return NextResponse.json(
        {
          workflowId: workflow.id,
          error: vehicleRecognition.error || "车辆识别失败。",
          vehicle: vehicleRecognition,
          guardrail,
        },
        { status: 502 },
      )
    }
    if (!vehicleRecognition.isVehicle) {
      return NextResponse.json(
        {
          workflowId: workflow.id,
          error: vehicleRecognition.rejectReason || "上传图片不是可识别的真实车辆照片。",
          vehicle: vehicleRecognition,
          guardrail,
        },
        { status: 400 },
      )
    }

    const partPrompt = catalog.promptTemplates.find((template) => template.id === partNode?.promptTemplateId && template.active)?.body || ""
    const parts = partProvider
      ? await Promise.all(
          partImages.map(async (part, index) => {
            const response = await recognizePartWithProvider({
              provider: partProvider,
              apiKey: getProviderApiKey(partProvider.id),
              image: part,
              prompt: partPrompt,
              fileName: part.name,
            })
            return {
              index,
              fileName: part.name,
              category: response.category,
              confidence: response.confidence,
              usableAsReference: response.usableAsReference,
              rejectReason: response.rejectReason,
              brand: response.brand,
              model: response.model,
              variant: response.variant,
              provider: response.provider,
            }
          }),
        )
      : []

    return NextResponse.json({
      workflowId: workflow.id,
      detectedModel: vehicleRecognition.model,
      vehicle: {
        isVehicle: vehicleRecognition.isVehicle,
        model: vehicleRecognition.model,
        view: vehicleRecognition.view,
        confidence: vehicleRecognition.confidence,
        provider: vehicleRecognition.provider,
        latencyMs: vehicleRecognition.latencyMs,
        qualityFlags: vehicleRecognition.qualityFlags,
        rejectReason: vehicleRecognition.rejectReason,
      },
      parts,
      guardrail,
    })
  } catch (error) {
    if ((error as { status?: number }).status) return authErrorResponse(error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Vehicle recognition failed" }, { status: 500 })
  }
}
