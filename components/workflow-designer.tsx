"use client"

import { useEffect, useMemo, useState, type CSSProperties } from "react"
import {
  Activity,
  BadgeCheck,
  Bot,
  CheckCircle2,
  ChevronRight,
  Database,
  FileText,
  ImageIcon,
  MessageSquareText,
  Play,
  RotateCcw,
  Save,
  Search,
  Settings,
  SlidersHorizontal,
} from "lucide-react"
import type {
  AdminSummary,
  GenerationStandardJson,
  PromptTemplate,
  ProviderCapability,
  ProviderId,
  WorkflowConfig,
  WorkflowMode,
  WorkflowNodeConfig,
  WorkflowNodeType,
} from "@/lib/types"
import { buildGenerationPrompt } from "@/lib/generation-core"

type NotifyAdmin = (type: "success" | "error", message: string) => void
type CallFailurePolicy = "stop" | "retry_once" | "fallback" | "retry_then_fallback"
type QualityFailurePolicy = "repair_once" | "save_bad_case" | "stop"

type WorkflowDesignerProps = {
  summary: AdminSummary
  onChanged: () => void
  notify: NotifyAdmin
}

const capabilityLabels: Record<ProviderCapability, string> = {
  image_generation: "生图 / 修图模型",
  vision: "多模态识别模型",
  llm: "大语言模型",
  embedding: "向量模型",
}

const nodeTypeLabels: Partial<Record<WorkflowNodeType, string>> = {
  start: "开始",
  input_validation: "输入校验",
  vehicle_detection: "车辆识别",
  part_detection: "配件识别",
  intent_parser: "需求解析",
  follow_up_gate: "追问判断",
  json_builder: "标准 JSON",
  prompt_builder: "提示词组装",
  image_generation: "生图 / 修图",
  result_check: "结果检查",
  retry: "修复重试",
  save_record: "保存记录",
  end: "结束",
}

const nodeAccent: Partial<Record<WorkflowNodeType, string>> = {
  start: "#52d273",
  input_validation: "#6ca6ff",
  vehicle_detection: "#55d6ff",
  part_detection: "#55d6ff",
  intent_parser: "#b46cff",
  follow_up_gate: "#ffd166",
  json_builder: "#6ca6ff",
  prompt_builder: "#ffd166",
  image_generation: "#67ffca",
  result_check: "#52d273",
  retry: "#ffb454",
  save_record: "#9aa4b2",
  end: "#9aa4b2",
}

nodeTypeLabels.guardrail = "本地安全检查"
nodeTypeLabels.local_parser = "本地规则解析"
nodeAccent.guardrail = "#ff8a7a"
nodeAccent.local_parser = "#8ee6a4"

const callFailurePolicies: Array<{ id: CallFailurePolicy; label: string; shortLabel: string; description: string }> = [
  { id: "retry_then_fallback", label: "重试当前模型 1 次，然后切备用模型", shortLabel: "接口：重试后切备用", description: "适合生产默认值。网络抖动、超时、限流时先重试主模型，仍失败再切备用模型。" },
  { id: "retry_once", label: "只重试当前模型 1 次", shortLabel: "接口：重试 1 次", description: "没有备用模型时使用。主模型失败后再试一次，仍失败才停止。" },
  { id: "fallback", label: "直接切备用模型", shortLabel: "接口：切备用", description: "主模型失败后不重试，直接切到备用模型。" },
  { id: "stop", label: "失败即停止", shortLabel: "接口：失败停止", description: "只适合明确不允许自动重试的低风险步骤。" },
]

const qualityFailurePolicies: Array<{ id: QualityFailurePolicy; label: string; shortLabel: string; description: string }> = [
  { id: "repair_once", label: "回到生图 / 修图步骤修复一次", shortLabel: "质量：修复 1 次", description: "结果检查不通过时，使用修复提示词回到生图 / 修图步骤重新生成。" },
  { id: "save_bad_case", label: "保存失败样本，不自动修复", shortLabel: "质量：记录失败样本", description: "保留失败结果和检查原因，进入失败样本记录，供后续优化提示词。" },
  { id: "stop", label: "停止并返回失败", shortLabel: "质量：停止", description: "结果不合格时直接停止，不自动修复。" },
]

export function WorkflowDesigner({ summary, onChanged, notify }: WorkflowDesignerProps) {
  const [selectedWorkflowId, setSelectedWorkflowId] = useState(summary.workflows[0]?.id ?? "")
  const [selectedNodeId, setSelectedNodeId] = useState("")
  const [nodes, setNodes] = useState<WorkflowNodeConfig[]>([])
  const [workflowEnabled, setWorkflowEnabled] = useState(true)
  const [promptDraft, setPromptDraft] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const selectedWorkflow = useMemo(
    () => summary.workflows.find((workflow) => workflow.id === selectedWorkflowId) ?? summary.workflows[0],
    [selectedWorkflowId, summary.workflows],
  )

  const orderedNodes = useMemo(
    () => (selectedWorkflow ? orderWorkflowNodes(nodes, selectedWorkflow) : nodes),
    [nodes, selectedWorkflow],
  )

  const selectedNode = useMemo(
    () => orderedNodes.find((node) => node.id === selectedNodeId) ?? orderedNodes[0],
    [orderedNodes, selectedNodeId],
  )

  const selectedPrompt = useMemo(
    () => summary.promptTemplates.find((template) => template.id === selectedNode?.promptTemplateId),
    [selectedNode?.promptTemplateId, summary.promptTemplates],
  )

  const workflowPromptIds = useMemo(
    () => (selectedWorkflow ? workflowPromptTemplateIds(selectedWorkflow, nodes, summary.promptTemplates) : []),
    [nodes, selectedWorkflow, summary.promptTemplates],
  )

  const selectedPromptIds = workflowPromptIds

  const providerOptions = useMemo(() => {
    if (!selectedNode?.providerCapability) return []
    return summary.providers.filter(
      (provider) => provider.enabled && provider.capabilities.includes(selectedNode.providerCapability as ProviderCapability),
    )
  }, [selectedNode?.providerCapability, summary.providers])

  useEffect(() => {
    if (!selectedWorkflowId && summary.workflows[0]) setSelectedWorkflowId(summary.workflows[0].id)
  }, [selectedWorkflowId, summary.workflows])

  useEffect(() => {
    if (!selectedWorkflow) return
    const normalizedNodes = selectedWorkflow.nodes.map(normalizeWorkflowNode)
    setNodes(normalizedNodes)
    setWorkflowEnabled(selectedWorkflow.enabled)
    setSelectedNodeId((current) => {
      if (normalizedNodes.some((node) => node.id === current)) return current
      return (
        normalizedNodes.find((node) =>
          ["image_generation", "intent_parser", "vehicle_detection", "part_detection", "result_check"].includes(node.type),
        )?.id ??
        normalizedNodes[0]?.id ??
        ""
      )
    })
  }, [selectedWorkflow])

  useEffect(() => {
    setPromptDraft(selectedPrompt?.body ?? "")
  }, [selectedPrompt?.id, selectedPrompt?.body])

  const updateSelectedNode = (patch: Partial<WorkflowNodeConfig>) => {
    if (!selectedNode) return
    setNodes((current) => current.map((node) => (node.id === selectedNode.id ? { ...node, ...patch } : node)))
  }

  const updateSelectedNodeConfig = (patch: Record<string, unknown>) => {
    if (!selectedNode) return
    updateSelectedNode({ config: { ...selectedNode.config, ...patch } })
  }

  const updateQualityFailurePolicy = (policy: QualityFailurePolicy) => {
    setNodes((current) =>
      current.map((node) =>
        node.type === "result_check" || node.type === "retry"
          ? { ...node, config: { ...node.config, qualityFailurePolicy: policy } }
          : node,
      ),
    )
  }

  const savePrompt = async () => {
    if (!selectedPrompt) {
      notify("error", "当前步骤没有绑定提示词模板。")
      return
    }
    const response = await fetch(`/api/admin/prompt-templates/${selectedPrompt.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...selectedPrompt, body: promptDraft }),
    })
    const body = await response.json().catch(() => ({}))
    if (!response.ok) {
      notify("error", body.error || "提示词保存失败")
      return
    }
    notify("success", "提示词已同步保存到提示词管理。")
    onChanged()
  }

  const saveWorkflow = async () => {
    if (!selectedWorkflow) return
    setIsSaving(true)
    const imageNode = nodes.find((node) => node.type === "image_generation")
    const resultCheckNode = nodes.find((node) => node.type === "result_check")
    const retryNode = nodes.find((node) => node.type === "retry")
    const promptTemplateIds = workflowPromptIds
    const response = await fetch("/api/admin/workflows", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: selectedWorkflow.id,
        title: selectedWorkflow.title,
        mode: selectedWorkflow.mode,
        enabled: workflowEnabled,
        vehicleCheckEnabled: nodes.some((node) => node.type === "vehicle_detection" && node.enabled),
        partCheckEnabled: nodes.some((node) => node.type === "part_detection" && node.enabled),
        allowFollowUp: nodes.some((node) => node.type === "follow_up_gate" && node.enabled),
        promptTemplateIds,
        providerId: imageNode?.providerId || selectedWorkflow.providerId,
        fallbackProviderId: imageNode?.fallbackProviderId || "",
        resultCheckEnabled: Boolean(resultCheckNode?.enabled),
        autoRetryEnabled: Boolean(retryNode?.enabled && qualityFailurePolicy(retryNode) === "repair_once"),
        maxRetries: retryNode?.maxRetries ?? selectedWorkflow.maxRetries,
        nodes,
        edges: selectedWorkflow.edges,
      }),
    })
    const body = await response.json().catch(() => ({}))
    setIsSaving(false)
    if (!response.ok) {
      notify("error", body.error || "Workflow 保存失败")
      return
    }
    notify("success", "Workflow 已保存，前台流程会使用最新配置。")
    onChanged()
  }

  if (!selectedWorkflow) {
    return <section className="workflow-ops-empty">暂无 Workflow 配置。</section>
  }

  return (
    <section className="workflow-ops">
      <div className="workflow-mode-tabs" role="tablist" aria-label="Workflow">
        {summary.workflows.map((workflow) => (
          <button
            key={workflow.id}
            type="button"
            role="tab"
            aria-selected={workflow.id === selectedWorkflow.id}
            className={workflow.id === selectedWorkflow.id ? "selected" : ""}
            onClick={() => setSelectedWorkflowId(workflow.id)}
          >
            <span>{workflowModeLabel(workflow.mode)}</span>
            <strong>{workflow.title}</strong>
          </button>
        ))}
      </div>

      <article className="workflow-unified-card">
        <header className="workflow-unified-head">
          <div>
            <span>{workflowModeLabel(selectedWorkflow.mode)}</span>
            <h2>{selectedWorkflow.title}</h2>
            <p>
              Workflow ID：{selectedWorkflow.id} / {orderedNodes.length} 个步骤 / {selectedPromptIds.length} 个提示词
            </p>
          </div>
          <div className="workflow-head-actions">
            <label className="workflow-head-toggle">
              <input type="checkbox" checked={workflowEnabled} onChange={(event) => setWorkflowEnabled(event.target.checked)} />
              启用 Workflow
            </label>
            <button type="button" onClick={() => void saveWorkflow()} disabled={isSaving}>
              <Save size={16} />
              {isSaving ? "保存中" : "保存 Workflow"}
            </button>
          </div>
        </header>

        <div className="workflow-explain-note">
          <strong>策略说明</strong>
          <span>网络、超时、限流属于“调用失败”，走重试/备用模型；出图缺配件、颜色错、背景变了属于“质量失败”，走修复提示词回到生图 / 修图。</span>
        </div>

        <div className="workflow-step-axis" aria-label="Workflow 步骤轴">
          {orderedNodes.map((node, index) => (
            <div className="workflow-step-segment" key={node.id}>
              <button
                type="button"
                className={node.id === selectedNode?.id ? "workflow-step-card selected" : "workflow-step-card"}
                style={{ "--node-accent": nodeAccent[node.type] ?? "#9aa4b2" } as CSSProperties}
                onClick={() => setSelectedNodeId(node.id)}
              >
                <span className="workflow-step-index">{String(index + 1).padStart(2, "0")}</span>
                <span className="workflow-step-icon">{nodeIcon(node.type)}</span>
                <strong>{displayNodeLabel(node)}</strong>
                <small>{nodeTypeLabels[node.type] ?? node.type}</small>
                <em>{node.providerCapability ? capabilityLabels[node.providerCapability] : "系统逻辑"}</em>
                <b>{providerSummary(node, summary)}</b>
                <i>{strategySummary(node)}</i>
                <span className={node.enabled ? "workflow-step-state active" : "workflow-step-state"}>
                  {node.enabled ? "启用" : "停用"}
                </span>
              </button>
              {index < orderedNodes.length - 1 && (
                <span className="workflow-step-line" aria-hidden="true">
                  <ChevronRight size={18} />
                </span>
              )}
            </div>
          ))}
        </div>

        {selectedNode ? (
          <section className="workflow-step-editor">
            <div className="workflow-step-editor-summary">
              <span>{nodeTypeLabels[selectedNode.type] ?? selectedNode.type}</span>
              <h3>{displayNodeLabel(selectedNode)}</h3>
              <p>{nodeDescription(selectedNode)}</p>
              <div>
                <StatusPill active={selectedNode.enabled} label={selectedNode.enabled ? "步骤启用" : "步骤停用"} />
                <StatusPill active={Boolean(selectedNode.providerCapability)} label={selectedNode.providerCapability ? capabilityLabels[selectedNode.providerCapability] : "系统逻辑"} />
                <StatusPill active label={strategySummary(selectedNode)} />
              </div>
            </div>

            <div className="workflow-step-editor-form">
              <label>
                步骤名称
                <input value={selectedNode.label} onChange={(event) => updateSelectedNode({ label: event.target.value })} />
              </label>
              <label>
                步骤类型
                <input value={nodeTypeLabels[selectedNode.type] ?? selectedNode.type} readOnly />
              </label>
              <label className="workflow-wide-field">
                步骤说明
                <textarea value={selectedNode.description} onChange={(event) => updateSelectedNode({ description: event.target.value })} />
              </label>

              {selectedNode.providerCapability ? (
                <>
                  <label>
                    主模型
                    <select value={selectedNode.providerId} onChange={(event) => updateSelectedNode({ providerId: event.target.value as ProviderId })}>
                      <option value="" disabled>
                        选择{capabilityLabels[selectedNode.providerCapability]}
                      </option>
                      {providerFallbackOption(selectedNode.providerId, providerOptions, summary)}
                      {providerOptions.map((provider) => (
                        <option key={provider.id} value={provider.id}>
                          {provider.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    备用模型
                    <select value={selectedNode.fallbackProviderId} onChange={(event) => updateSelectedNode({ fallbackProviderId: event.target.value as ProviderId | "" })}>
                      <option value="">不启用</option>
                      {providerFallbackOption(selectedNode.fallbackProviderId, providerOptions, summary)}
                      {providerOptions.map((provider) => (
                        <option key={provider.id} value={provider.id}>
                          {provider.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    调用失败策略
                    <select value={callFailurePolicy(selectedNode)} onChange={(event) => updateSelectedNodeConfig({ callFailurePolicy: event.target.value as CallFailurePolicy })}>
                      {callFailurePolicies.map((policy) => (
                        <option key={policy.id} value={policy.id}>
                          {policy.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </>
              ) : (
                <div className="workflow-system-note">该步骤不调用模型，只执行系统逻辑。网络/接口失败策略不会显示在这里，避免误配。</div>
              )}

              {isQualityPolicyNode(selectedNode) && (
                <>
                  <label>
                    质量失败策略
                    <select value={qualityFailurePolicy(selectedNode)} onChange={(event) => updateQualityFailurePolicy(event.target.value as QualityFailurePolicy)}>
                      {qualityFailurePolicies.map((policy) => (
                        <option key={policy.id} value={policy.id}>
                          {policy.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  {selectedNode.type === "retry" && (
                    <>
                      <label>
                        回跳目标
                        <input value="生图 / 修图步骤" readOnly />
                      </label>
                      <label>
                        最大修复次数
                        <input type="number" min={0} max={3} value={selectedNode.maxRetries} onChange={(event) => updateSelectedNode({ maxRetries: Number(event.target.value) })} />
                      </label>
                    </>
                  )}
                </>
              )}

              {shouldShowPromptSelect(selectedNode) && (
                <label>
                  提示词模板
                  <select value={selectedNode.promptTemplateId} onChange={(event) => updateSelectedNode({ promptTemplateId: event.target.value })}>
                    <option value="">不绑定提示词</option>
                    {summary.promptTemplates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {promptTemplateOptionLabel(template.title, template.id)}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="workflow-inline-check">
                <input
                  type="checkbox"
                  checked={selectedNode.enabled}
                  disabled={selectedNode.required && selectedNode.type !== "retry"}
                  onChange={(event) => updateSelectedNode({ enabled: event.target.checked })}
                />
                启用该步骤
              </label>

              <div className="workflow-strategy-note">
                <strong>{strategyNoteTitle(selectedNode)}</strong>
                <span>{strategyNoteBody(selectedNode)}</span>
              </div>

              {selectedPrompt && (
                <>
                  <label className="workflow-wide-field">
                    提示词内容
                    <textarea value={promptDraft} onChange={(event) => setPromptDraft(event.target.value)} />
                  </label>
                  <button type="button" onClick={() => void savePrompt()}>
                    <BadgeCheck size={16} />
                    保存提示词
                  </button>
                </>
              )}

            </div>
          </section>
        ) : (
          <div className="workflow-system-note">请先选择一个步骤。</div>
        )}
      </article>
    </section>
  )
}

function StatusPill({ active, label }: { active: boolean; label: string }) {
  return (
    <span className={active ? "workflow-status-pill active" : "workflow-status-pill"}>
      <CheckCircle2 size={13} />
      {label}
    </span>
  )
}

function workflowPromptTemplateIds(workflow: WorkflowConfig, nodes: WorkflowNodeConfig[], templates: PromptTemplate[]) {
  const nodePromptIds = nodes.map((node) => node.promptTemplateId).filter(Boolean)
  const requiredPromptIds =
    workflow.mode === "config"
      ? ["tpl_base_photo_edit", "tpl_config_mode_default", "tpl_config_base_default", "tpl_negative_default"]
      : workflow.mode === "chat"
        ? ["tpl_base_photo_edit", "tpl_chat_mode_default", "tpl_negative_default"]
        : []
  const availableIds = new Set(templates.map((template) => template.id))
  return Array.from(new Set([...workflow.promptTemplateIds, ...requiredPromptIds, ...nodePromptIds])).filter((id) => availableIds.has(id))
}

function buildWorkflowPromptPreview(workflow: WorkflowConfig, nodes: WorkflowNodeConfig[], summary: AdminSummary) {
  const promptIds = workflowPromptTemplateIds(workflow, nodes, summary.promptTemplates)
  if (workflow.mode === "recognition") {
    return {
      prompt: "识别 Workflow 不直接生成生图提示词。它使用车辆识别提示词和配件图识别提示词输出结构化检测结果，后续配置/对话 Workflow 再组装最终生图提示词。",
      negativePrompt: "",
      resultCheckPrompt: "",
      retryPrompt: "",
      templateIds: promptIds,
      note: "识别流程预览，仅展示绑定的识别提示词模块。",
    }
  }

  const workflowTemplateIds = new Set(promptIds)
  const templates = summary.promptTemplates.filter(
    (template) => workflowTemplateIds.has(template.id) || template.scope === "part" || template.scope === "category" || template.scope === "combo",
  )
  const preset = summary.prompts.find((prompt) => prompt.active) ?? summary.prompts[0]
  const build = buildGenerationPrompt({
    spec: samplePromptSpec(workflow.mode, summary),
    preset,
    templates,
  })
  return {
    prompt: build.prompt,
    negativePrompt: build.negativePrompt,
    resultCheckPrompt: promptBodyByNodeType(nodes, summary.promptTemplates, "result_check"),
    retryPrompt: promptBodyByNodeType(nodes, summary.promptTemplates, "retry"),
    templateIds: Array.from(new Set([...promptIds, ...build.usedTemplateIds])),
    note: "使用示例车辆、示例颜色和示例配件生成；真实生图时会替换为用户上传图片和当前配置 JSON。",
  }
}

function promptBodyByNodeType(nodes: WorkflowNodeConfig[], templates: PromptTemplate[], nodeType: WorkflowNodeConfig["type"]) {
  const promptTemplateId = nodes.find((node) => node.type === nodeType)?.promptTemplateId
  if (!promptTemplateId) return ""
  return templates.find((template) => template.id === promptTemplateId && template.active)?.body || ""
}

function samplePromptSpec(mode: "config" | "chat", summary: AdminSummary): GenerationStandardJson {
  const asset = summary.assets.find((item) => item.categoryId === "wheels") ?? summary.assets[0]
  const category = asset ? summary.categories.find((item) => item.id === asset.categoryId) : undefined
  const part: GenerationStandardJson["parts"][number] | null = asset
    ? {
        category: asset.categoryId,
        categoryLabel: category?.labelZh || category?.label || asset.categoryId,
        source: mode === "config" ? "asset_library" as const : "uploaded_reference" as const,
        assetId: mode === "config" ? asset.id : "",
        brand: mode === "config" ? asset.brand : "",
        model: mode === "config" ? asset.model : "",
        variant: mode === "config" ? asset.variant : "",
        color: asset.color || "参考图颜色",
        finish: asset.finish || "参考图材质",
        colorPolicy: asset.defaultColorPolicy ?? "part_reference_color",
        colorPolicyPrompt:
          asset.defaultColorPolicy === "exposed_carbon"
            ? `Use exposed carbon only on ${category?.label || asset.categoryId}.`
            : asset.defaultColorPolicy === "body_color"
              ? `Paint-match ${category?.label || asset.categoryId} to the source vehicle body color.`
              : `Use the selected part reference color only for ${category?.label || asset.categoryId}.`,
        referenceImageUrl: mode === "config" ? asset.imageUrl : "user-upload://part-reference-1",
        referenceImages:
          mode === "config"
            ? (asset.generationReferences ?? []).map((reference) => ({
                url: reference.url,
                role: reference.role,
                view: reference.view,
                promptHint: reference.promptHint,
                priority: reference.priority,
                uploadToModel: reference.uploadToModel,
              }))
            : [
                {
                  url: "user-upload://part-reference-1",
                  role: "full_part_reference",
                  view: "uploaded",
                  promptHint: "用户上传参考图",
                  priority: 10,
                  uploadToModel: true,
                },
              ],
        instruction: mode === "config" ? asset.promptHint : "严格使用用户上传参考图中的配件外观，并自然安装到车辆对应位置。",
      }
    : null

  return {
    mode,
    vehicle: {
      model: "示例车辆：BMW M3",
      view: "front three-quarter",
      sourceImageUrl: "user-upload://vehicle.jpg",
      confidence: 0.86,
    },
    paint: {
      action: "change",
      target: "Nardo gray",
      prompt: "车身颜色指令：改为纳多灰，保持原图真实漆面反光、环境映射和车身钣金缝隙。",
    },
    stance: {
      value: 66,
      label: "齐平姿态，车身降低，轮胎与轮拱间隙更紧凑",
      prompt: "车高姿态指令：齐平姿态，车身降低，轮胎与轮拱间隙更紧凑。",
    },
    parts: part ? [part] : [],
    style: {
      keywords: ["photorealistic", "automotive photo edit", "OEM-plus"],
      userText: mode === "config" ? "示例：使用后台配置生成改装效果。" : "示例：按我上传的配件参考图改装。",
      contextMode: "original",
    },
    constraints: {
      preserveBackground: true,
      preserveCameraAngle: true,
      preserveLighting: true,
      preserveLicensePlateShape: true,
      preserveVehicleIdentity: true,
      preserveUnselectedParts: true,
      selectedOnly: true,
    },
  }
}

function normalizeWorkflowNode(node: WorkflowNodeConfig): WorkflowNodeConfig {
  if (node.type !== "retry") return { ...node, config: { ...node.config } }
  return {
    ...node,
    label: node.label && !node.label.includes("失败") ? node.label : "修复重试",
    description: node.description || "结果检查失败后，使用修复提示词回到生图 / 修图步骤重新生成。",
    config: {
      ...node.config,
      qualityFailurePolicy: qualityFailurePolicy(node),
    },
  }
}

function orderWorkflowNodes(nodes: WorkflowNodeConfig[], workflow: WorkflowConfig) {
  if (!nodes.length) return []
  const nodeMap = new Map(nodes.map((node) => [node.id, node]))
  const incoming = new Set(workflow.edges.map((edge) => edge.target))
  const startNode = nodes.find((node) => node.type === "start") ?? nodes.find((node) => !incoming.has(node.id)) ?? nodes[0]
  const ordered: WorkflowNodeConfig[] = []
  const visited = new Set<string>()
  let current: WorkflowNodeConfig | undefined = startNode

  while (current && !visited.has(current.id)) {
    ordered.push(current)
    visited.add(current.id)
    const nextEdge = workflow.edges.find((edge) => edge.source === current?.id && nodeMap.has(edge.target) && !visited.has(edge.target))
    current = nextEdge ? nodeMap.get(nextEdge.target) : undefined
  }

  nodes
    .filter((node) => !visited.has(node.id))
    .sort((left, right) => left.position.x - right.position.x || left.position.y - right.position.y)
    .forEach((node) => ordered.push(node))

  return ordered
}

function providerFallbackOption(providerId: ProviderId | "", options: AdminSummary["providers"], summary: AdminSummary) {
  if (!providerId || options.some((provider) => provider.id === providerId)) return null
  const provider = summary.providers.find((item) => item.id === providerId)
  return (
    <option value={providerId} disabled>
      当前不可用：{provider?.label ?? providerId}
    </option>
  )
}

function promptTemplateOptionLabel(title: string, id: string) {
  const value = `${title} / ${id}`
  return value.length > 34 ? `${value.slice(0, 31)}...` : value
}

function displayNodeLabel(node: WorkflowNodeConfig) {
  return node.type === "retry" ? "修复重试" : node.label
}

function nodeDescription(node: WorkflowNodeConfig) {
  if (node.type === "retry") return "结果检查失败后，使用修复提示词回到生图 / 修图步骤重新生成。它不是重试自己。"
  return node.description || "该步骤暂无说明。"
}

function providerSummary(node: WorkflowNodeConfig, summary: AdminSummary) {
  if (!node.providerCapability) return "不调用模型"
  const provider = summary.providers.find((item) => item.id === node.providerId)
  return provider?.label ?? "未选择模型"
}

function callFailurePolicy(node: WorkflowNodeConfig): CallFailurePolicy {
  const configured = typeof node.config?.callFailurePolicy === "string" ? node.config.callFailurePolicy : ""
  if (configured === "stop" || configured === "retry_once" || configured === "fallback" || configured === "retry_then_fallback") return configured
  if (!node.providerCapability) return "stop"
  return node.fallbackProviderId ? "retry_then_fallback" : "retry_once"
}

function qualityFailurePolicy(node: WorkflowNodeConfig): QualityFailurePolicy {
  const configured = typeof node.config?.qualityFailurePolicy === "string" ? node.config.qualityFailurePolicy : ""
  if (configured === "repair_once" || configured === "save_bad_case" || configured === "stop") return configured
  return node.type === "retry" || node.type === "result_check" ? "repair_once" : "stop"
}

function strategySummary(node: WorkflowNodeConfig) {
  if (node.type === "result_check") return qualityFailurePolicies.find((policy) => policy.id === qualityFailurePolicy(node))?.shortLabel ?? "质量：默认策略"
  if (node.type === "intent_parser") return "追问: 缺信息时返回"
  if (node.providerCapability) return callFailurePolicies.find((policy) => policy.id === callFailurePolicy(node))?.shortLabel ?? "接口：默认策略"
  if (node.type === "retry") return `修复: 回到生图 ${Math.max(0, node.maxRetries)} 次`
  return "系统逻辑"
}

function strategyNoteTitle(node: WorkflowNodeConfig) {
  if (node.type === "result_check") return "结果检查策略"
  if (node.providerCapability) return "调用失败策略"
  if (isQualityPolicyNode(node)) return "质量失败策略"
  return "系统逻辑"
}

function strategyNoteBody(node: WorkflowNodeConfig) {
  if (node.type === "result_check") {
    return "本地模拟只做轻量检查，不真正看图；切换真实视觉模型后才会对比原图和结果图，检查颜色、配件、车高、保护项和严重变形。"
  }
  if (node.providerCapability) {
    return callFailurePolicies.find((policy) => policy.id === callFailurePolicy(node))?.description ?? "模型接口失败时按当前策略处理。"
  }
  if (node.type === "retry") {
    return "修复重试会拿结果检查的失败原因生成修复提示词，然后回到生图 / 修图步骤重新生成。"
  }
  return "该步骤不调用外部模型，也没有独立的失败分支。"
}

function isQualityPolicyNode(node: WorkflowNodeConfig) {
  return node.type === "result_check" || node.type === "retry"
}

function shouldShowPromptSelect(node: WorkflowNodeConfig) {
  return Boolean(node.promptTemplateId || node.providerCapability || node.type === "prompt_builder" || node.type === "result_check" || node.type === "retry")
}

function workflowModeLabel(mode: WorkflowMode) {
  if (mode === "recognition") return "图片识别 Workflow"
  if (mode === "config") return "配置模式 Workflow"
  return "对话模式 Workflow"
}

function nodeIcon(type: WorkflowNodeType) {
  if (type === "start") return <Play size={15} />
  if (type === "image_generation") return <ImageIcon size={15} />
  if (type === "intent_parser") return <Bot size={15} />
  if (type === "local_parser") return <SlidersHorizontal size={15} />
  if (type === "prompt_builder") return <FileText size={15} />
  if (type === "result_check") return <Activity size={15} />
  if (type === "retry") return <RotateCcw size={15} />
  if (type === "save_record") return <Database size={15} />
  if (type === "vehicle_detection" || type === "part_detection") return <Search size={15} />
  if (type === "guardrail") return <BadgeCheck size={15} />
  if (type === "follow_up_gate") return <MessageSquareText size={15} />
  if (type === "json_builder") return <SlidersHorizontal size={15} />
  return <Settings size={15} />
}
