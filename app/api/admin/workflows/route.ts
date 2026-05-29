import { NextResponse } from "next/server"
import { authErrorResponse, requireAdminUser } from "@/lib/server/auth"
import { getCatalog, listWorkflowConfigs, updateWorkflowConfig } from "@/lib/server/db"
import type { ProviderCapability, ProviderId, WorkflowEdgeConfig, WorkflowMode, WorkflowNodeConfig } from "@/lib/types"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const validCapabilities: ProviderCapability[] = ["llm", "vision", "image_generation", "embedding"]

export async function GET() {
  try {
    requireAdminUser()
    return NextResponse.json({ workflows: listWorkflowConfigs() })
  } catch (error) {
    return authErrorResponse(error)
  }
}

export async function PUT(request: Request) {
  try {
    requireAdminUser()
    const body = await request.json()
    const providers = getCatalog().providers
    const workflowId = String(body.id || "")
    const currentWorkflow = listWorkflowConfigs().find((workflow) => workflow.id === workflowId)
    const mode = typeof body.mode === "string" ? (body.mode as WorkflowMode) : currentWorkflow?.mode
    const providerId = typeof body.providerId === "string" ? (body.providerId as ProviderId) : undefined
    const fallbackProviderId = typeof body.fallbackProviderId === "string" ? (body.fallbackProviderId as ProviderId | "") : undefined
    const nodes = Array.isArray(body.nodes) ? normalizeNodes(body.nodes) : undefined
    const edges = Array.isArray(body.edges) ? normalizeEdges(body.edges) : undefined
    const topLevelCapability = topLevelProviderCapability(mode)

    if (providerId) {
      const error = validateProvider(providerId, topLevelCapability, providers)
      if (error) return NextResponse.json({ error }, { status: 400 })
    }
    if (fallbackProviderId) {
      const error = validateProvider(fallbackProviderId, topLevelCapability, providers)
      if (error) return NextResponse.json({ error }, { status: 400 })
    }

    if (nodes) {
      for (const node of nodes) {
        if (!node.enabled || !node.providerCapability) continue
        if (!node.providerId) {
          return NextResponse.json({ error: `${node.label}：请选择${capabilityLabel(node.providerCapability)}。` }, { status: 400 })
        }
        if (node.providerId) {
          const error = validateProvider(node.providerId, node.providerCapability, providers)
          if (error) return NextResponse.json({ error: `${node.label}：${error}` }, { status: 400 })
        }
        if (node.fallbackProviderId) {
          const error = validateProvider(node.fallbackProviderId, node.providerCapability, providers)
          if (error) return NextResponse.json({ error: `${node.label} 备用模型：${error}` }, { status: 400 })
        }
      }
    }

    const workflow = updateWorkflowConfig(workflowId, {
      mode,
      title: typeof body.title === "string" ? body.title : undefined,
      enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
      vehicleCheckEnabled: typeof body.vehicleCheckEnabled === "boolean" ? body.vehicleCheckEnabled : undefined,
      partCheckEnabled: typeof body.partCheckEnabled === "boolean" ? body.partCheckEnabled : undefined,
      allowFollowUp: typeof body.allowFollowUp === "boolean" ? body.allowFollowUp : undefined,
      promptTemplateIds: Array.isArray(body.promptTemplateIds) ? body.promptTemplateIds.map(String) : undefined,
      providerId,
      fallbackProviderId,
      resultCheckEnabled: typeof body.resultCheckEnabled === "boolean" ? body.resultCheckEnabled : undefined,
      autoRetryEnabled: typeof body.autoRetryEnabled === "boolean" ? body.autoRetryEnabled : undefined,
      maxRetries: typeof body.maxRetries === "number" ? body.maxRetries : undefined,
      nodes,
      edges,
    })
    return NextResponse.json(workflow)
  } catch (error) {
    return (error as { status?: number }).status
      ? authErrorResponse(error)
      : NextResponse.json({ error: error instanceof Error ? error.message : "Workflow 保存失败。" }, { status: 400 })
  }
}

function validateProvider(providerId: ProviderId, capability: ProviderCapability, providers: ReturnType<typeof getCatalog>["providers"]) {
  const provider = providers.find((item) => item.id === providerId)
  if (!provider) return "Provider 不存在。"
  if (!provider.enabled) return "Provider 未启用，不能在 Workflow 中选择。"
  if (!provider.capabilities.includes(capability)) return `Provider 能力不匹配，需要 ${capabilityLabel(capability)}。`
  return ""
}

function topLevelProviderCapability(mode?: WorkflowMode): ProviderCapability {
  return mode === "recognition" ? "vision" : "image_generation"
}

function normalizeNodes(nodes: unknown[]): WorkflowNodeConfig[] {
  return nodes.map((item) => {
    const node = item as Partial<WorkflowNodeConfig>
    const providerCapability = validCapabilities.includes(node.providerCapability as ProviderCapability) ? node.providerCapability : undefined
    return {
      id: String(node.id || ""),
      type: node.type as WorkflowNodeConfig["type"],
      label: String(node.label || ""),
      description: String(node.description || ""),
      position: {
        x: Number(node.position?.x ?? 0),
        y: Number(node.position?.y ?? 0),
      },
      required: Boolean(node.required),
      enabled: node.enabled !== false,
      providerCapability: providerCapability ?? "",
      providerId: typeof node.providerId === "string" ? (node.providerId as ProviderId) : "",
      fallbackProviderId: typeof node.fallbackProviderId === "string" ? (node.fallbackProviderId as ProviderId | "") : "",
      promptTemplateId: typeof node.promptTemplateId === "string" ? node.promptTemplateId : "",
      failureStrategy: node.failureStrategy ?? "stop",
      maxRetries: Number(node.maxRetries ?? 0),
      config: typeof node.config === "object" && node.config ? node.config : {},
    }
  })
}

function normalizeEdges(edges: unknown[]): WorkflowEdgeConfig[] {
  return edges.map((item) => {
    const edge = item as Partial<WorkflowEdgeConfig>
    return {
      id: String(edge.id || ""),
      source: String(edge.source || ""),
      target: String(edge.target || ""),
      label: typeof edge.label === "string" ? edge.label : undefined,
      condition: typeof edge.condition === "string" ? edge.condition : undefined,
    }
  })
}

function capabilityLabel(capability: ProviderCapability) {
  if (capability === "llm") return "大语言模型"
  if (capability === "vision") return "多模态识别模型"
  if (capability === "image_generation") return "生图 / 修图模型"
  return "Embedding"
}
