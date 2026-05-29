import { execFileSync, spawn } from "node:child_process"
import { DatabaseSync } from "node:sqlite"
import fs from "node:fs/promises"
import path from "node:path"

const cwd = process.cwd()
const baseUrl = process.env.CHAT_TEST_BASE_URL || "http://127.0.0.1:3123"
const basePort = new URL(baseUrl).port || "3123"
const outputDir = path.join(cwd, "docs")
const reportPath = path.join(outputDir, "chat-mode-dry-run-test-report.md")
const jsonPath = path.join(outputDir, "chat-mode-dry-run-test-results.json")
const dbPath = path.join(cwd, "data", "car_mod_effect.sqlite")

const files = {
  vehicle: path.join(cwd, "public", "uploads", "vehicle-1778894494784-de130839f61f1.jpg"),
  sideSkirt1: path.join(cwd, "public", "assets", "parts", "references", "multi-ref-v1", "rsc-f80-side-skirts", "01-side-skirt-6.jpg"),
  sideSkirt2: path.join(cwd, "public", "assets", "parts", "references", "multi-ref-v1", "rsc-f80-side-skirts", "02-side-skirt-3.jpg"),
  hood: path.join(cwd, "public", "assets", "parts", "references", "multi-ref-v1", "seibon-oe-carbon-hood", "01-hd14bmwf80-oe-01.jpg"),
  mirror: path.join(cwd, "public", "assets", "parts", "references", "multi-ref-v1", "carbon-mirror-caps", "01-apr-official.jpg"),
  packageJson: path.join(cwd, "package.json"),
}

const server = spawn(process.execPath, ["scripts/start-next-dev.mjs"], {
  cwd,
  env: { ...process.env, PORT: process.env.PORT || basePort, DISABLE_EXTERNAL_AI: "1", CHAT_DRY_RUN_DEFAULT: "1", CHAT_LLM_FALLBACK_FIXTURES: "1" },
  stdio: ["ignore", "pipe", "pipe"],
})

let serverLog = ""
server.stdout.on("data", (chunk) => {
  serverLog += chunk.toString()
})
server.stderr.on("data", (chunk) => {
  serverLog += chunk.toString()
})

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForServer() {
  for (let index = 0; index < 60; index += 1) {
    try {
      const response = await fetch(baseUrl, { signal: AbortSignal.timeout(2000) })
      if (response.status < 500) return
    } catch {
      await sleep(500)
    }
  }
  throw new Error(`Dev server did not become ready.\n${serverLog}`)
}

function sessionCookie(response) {
  const raw = response.headers.get("set-cookie") || ""
  return raw
    .split(",")
    .map((item) => item.trim())
    .find((item) => item.startsWith("car_mod_session="))
    ?.split(";")[0] || ""
}

async function login() {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ identifier: "demo", password: "Demo@1234" }),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(`Login failed: ${response.status} ${JSON.stringify(body)}`)
  const cookie = sessionCookie(response)
  if (!cookie) throw new Error("Login response did not include car_mod_session cookie.")
  return cookie
}

async function blobFor(file) {
  if (file.bytes) return new Blob([new Uint8Array(file.bytes)], { type: file.type })
  return new Blob([await fs.readFile(file.path)], { type: file.type })
}

function vehicle(name = "bmw-m4-source.jpg") {
  return { path: files.vehicle, name, type: "image/jpeg" }
}

function part(filePath, name) {
  return { path: filePath, name, type: "image/jpeg" }
}

async function chat(cookie, options) {
  const form = new FormData()
  form.append("text", options.text ?? "")
  form.append("contextMode", options.contextMode || "latest")
  if (options.contextConfirmed) form.append("contextConfirmed", "1")
  if (options.partColorPolicyConfirmed) form.append("partColorPolicyConfirmed", "1")
  if (options.partColorPolicyCategory) form.append("partColorPolicyCategory", options.partColorPolicyCategory)
  if (options.partColorPolicy) form.append("partColorPolicy", options.partColorPolicy)
  if (options.partColorPolicyChoicesJson) form.append("partColorPolicyChoicesJson", options.partColorPolicyChoicesJson)
  form.append("responseLanguage", options.language || "zh")
  form.append("dryRun", options.dryRun === false ? "0" : "1")
  if (options.sessionId) form.append("sessionId", options.sessionId)

  for (const file of options.vehicleFiles || []) {
    form.append("vehicleImage", await blobFor(file), file.name)
  }
  for (const file of options.partFiles || []) {
    form.append("partImages", await blobFor(file), file.name)
  }

  const response = await fetch(`${baseUrl}/api/chat/messages`, {
    method: "POST",
    headers: { cookie },
    body: form,
  })
  const body = await response.json().catch(async () => ({ raw: await response.text().catch(() => "") }))
  return { status: response.status, body, actual: summarize(body) }
}

function summarize(body) {
  const lastMessage = Array.isArray(body.messages) ? body.messages[body.messages.length - 1] : null
  const standard = body.standardJson
  return {
    error: body.error || "",
    assistantContent: lastMessage?.content || body.followUpQuestion || "",
    dryRun: body.dryRun ?? null,
    followUpQuestion: body.followUpQuestion || "",
    contextChoiceRequired: Boolean(body.contextChoiceRequired),
    partColorPolicyChoiceRequired: Boolean(body.partColorPolicyChoiceRequired),
    partColorPolicyChoicesRequired: Boolean(body.partColorPolicyChoicesRequired),
    partColorPolicyCategory: body.partColorPolicyCategory || "",
    partColorPolicyChoices: Array.isArray(body.partColorPolicyChoices)
      ? body.partColorPolicyChoices.map((choice) => ({
          categoryId: choice.categoryId,
          categoryLabel: choice.categoryLabel,
          options: Array.isArray(choice.options) ? choice.options.map((option) => ({ colorPolicy: option.colorPolicy, label: option.label })) : [],
        }))
      : [],
    parseStatus: body.parseResult?.status || "",
    missingFields: body.parseResult?.missingFields || [],
    vehicleModel: standard?.vehicle?.model || body.recognition?.vehicle?.model || "",
    paint: standard?.paint ? { action: standard.paint.action, target: standard.paint.target } : null,
    stance: standard?.stance ? { value: standard.stance.value, label: standard.stance.label } : null,
    contextMode: standard?.style?.contextMode || "",
    sourceImageUrl: body.generationPreview?.sourceImageUrl || standard?.vehicle?.sourceImageUrl || "",
    parts: Array.isArray(standard?.parts)
      ? standard.parts.map((partItem) => ({
          category: partItem.category,
          source: partItem.source,
          assetId: partItem.assetId,
          brand: partItem.brand,
          model: partItem.model,
          variant: partItem.variant,
          color: partItem.color,
          colorPolicy: partItem.colorPolicy,
          referenceImageUrl: partItem.referenceImageUrl,
          referenceImages: (partItem.referenceImages || []).map((reference) => ({
            role: reference.role,
            url: reference.url,
            uploadToModel: reference.uploadToModel,
          })),
        }))
      : [],
    previewProvider: body.generationPreview?.provider || "",
    previewPartImageUrls: body.generationPreview?.partImageUrls || [],
    promptHidden: body.generationPreview?.promptHidden || "",
    debugSteps: Array.isArray(body.debugTimings?.steps) ? body.debugTimings.steps.map((step) => step.step) : [],
    sessionId: body.session?.id || "",
  }
}

function check(pass, detail) {
  return { pass: Boolean(pass), detail: String(detail ?? "") }
}

function passAll(checks) {
  return checks.every((item) => item.pass)
}

function markLatestAssistantAsResult(sessionId, resultImageUrl) {
  const db = new DatabaseSync(dbPath)
  try {
    const message = db
      .prepare("SELECT id FROM chat_messages WHERE session_id = ? AND role = 'assistant' ORDER BY created_at DESC LIMIT 1")
      .get(sessionId)
    if (!message?.id) throw new Error(`No assistant message found for session ${sessionId}`)
    const now = Date.now()
    db.prepare("UPDATE chat_messages SET result_image_url = ? WHERE id = ?").run(resultImageUrl, message.id)
    db.prepare("INSERT INTO chat_attachments (id, message_id, type, url, file_name, mime, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)").run(
      `att_fake_${Math.random().toString(16).slice(2, 10)}`,
      message.id,
      "result",
      resultImageUrl,
      "fake-chat-result.png",
      "image/png",
      0,
      now,
    )
  } finally {
    db.close()
  }
}

const testCases = []

function registerTest(id, group, title, options, expected, checker, fix = "") {
  testCases.push({ id, group, title, options, expected, checker, fix })
}

registerTest("A1", "A 上传限制", "第一轮不传车辆图", { text: "改成纳多灰" }, "200；追问上传原车图，不进入 dry run 生图。", (actual, status) => [
  check(status === 200, `status=${status}`),
  check((actual.followUpQuestion || actual.assistantContent).includes("原车照片"), actual.assistantContent || actual.followUpQuestion),
])
registerTest("A2", "A 上传限制", "上传 2 张车辆图", { text: "改成纳多灰", vehicleFiles: [vehicle("car-a.jpg"), vehicle("car-b.jpg")] }, "400；提示只允许 1 张车辆图。", (actual, status) => [
  check(status === 400, `status=${status}`),
  check(actual.error.includes("1 张车辆图") || actual.error.toLowerCase().includes("one vehicle"), actual.error),
])
registerTest("A3", "A 上传限制", "上传 9 张配件图", { text: "装这些配件", vehicleFiles: [vehicle()], partFiles: Array.from({ length: 9 }, (_, index) => part(files.sideSkirt1, `side-skirt-${index + 1}.jpg`)) }, "400；提示最多 8 张配件参考图。", (actual, status) => [
  check(status === 400, `status=${status}`),
  check(actual.error.includes("8"), actual.error),
])
registerTest("A4", "A 上传限制", "上传非图片文件", { text: "改成纳多灰", vehicleFiles: [{ path: files.packageJson, name: "package.txt", type: "text/plain" }] }, "400；提示仅支持 jpg/png/webp。", (actual, status) => [
  check(status === 400, `status=${status}`),
  check(actual.error.includes("jpg"), actual.error),
])

registerTest("A5", "A upload validation", "empty text allowed with vehicle and part images", { text: "", vehicleFiles: [vehicle()], partFiles: [part(files.sideSkirt1, "side-skirt-primary.jpg")] }, "200 dry run ready; empty prompt is allowed only when vehicle and part images are both uploaded", (actual, status) => [
  check(status === 200, `status=${status}`),
  check(actual.dryRun === true, `dryRun=${actual.dryRun}`),
  check(actual.parts.length === 1, `parts=${actual.parts.length}`),
  check(actual.parts[0]?.category === "side-skirts", JSON.stringify(actual.parts[0])),
])
registerTest("A6", "A upload validation", "empty text rejected without part images", { text: "", vehicleFiles: [vehicle()] }, "400 missing text when the request does not include both vehicle and part images", (actual, status) => [
  check(status === 400, `status=${status}`),
  check(Boolean(actual.error), actual.error),
])

registerTest("B1", "B 基础生成", "原车图 + 改成纳多灰", { text: "改成纳多灰", vehicleFiles: [vehicle()] }, "dry run ready；parts=[]；paint.action=change；stance=0；prompt 不包含车身姿态段。", (actual, status) => [
  check(status === 200, `status=${status}`),
  check(actual.dryRun === true, `dryRun=${actual.dryRun}`),
  check(actual.paint?.action === "change", JSON.stringify(actual.paint)),
  check(actual.stance?.value === 0, JSON.stringify(actual.stance)),
  check(!actual.promptHidden.includes("车身姿态"), "prompt should not include stance section when user did not ask for height changes"),
  check(actual.parts.length === 0, `parts=${actual.parts.length}`),
], "Mock guardrail 的中文允许词缺少“纳多灰/灰色/白色/改色/颜色”等 color-only 请求，导致只改色请求在进入 parser 前被拒绝。")
registerTest("B2", "B 基础生成", "原车图 + 降低一点", { text: "降低一点", vehicleFiles: [vehicle()] }, "dry run ready；parts=[]；paint.keep_original；stance=50（轻微降低）。", (actual, status) => [
  check(status === 200, `status=${status}`),
  check(actual.paint?.action === "keep_original", JSON.stringify(actual.paint)),
  check(Number(actual.stance?.value) === 50, JSON.stringify(actual.stance)),
  check(actual.parts.length === 0, `parts=${actual.parts.length}`),
])
registerTest("B3", "B 基础生成", "原车图 + 改白色并降低", { text: "改成白色，降低一点", vehicleFiles: [vehicle()] }, "dry run ready；paint.change；stance=50（轻微降低）；parts=[]。", (actual, status) => [
  check(status === 200, `status=${status}`),
  check(actual.paint?.action === "change", JSON.stringify(actual.paint)),
  check(Number(actual.stance?.value) === 50, JSON.stringify(actual.stance)),
  check(actual.parts.length === 0, `parts=${actual.parts.length}`),
])
registerTest("B4", "B 基础生成", "保持原车颜色，只降低一点", { text: "保持原车颜色，只降低一点", vehicleFiles: [vehicle()] }, "dry run ready；paint.keep_original；stance=50（轻微降低）；parts=[]。", (actual, status) => [
  check(status === 200, `status=${status}`),
  check(actual.paint?.action === "keep_original", JSON.stringify(actual.paint)),
  check(Number(actual.stance?.value) === 50, JSON.stringify(actual.stance)),
  check(actual.parts.length === 0, `parts=${actual.parts.length}`),
])

registerTest("E1", "E 未上传配件追问", "只说换轮毂", { text: "换轮毂", vehicleFiles: [vehicle()] }, "needs_followup；missingFields 包含 part_reference:wheels；提示补充轮毂具体品牌/型号并上传轮毂参考图。", (actual, status) => [
  check(status === 200, `status=${status}`),
  check(actual.parseStatus === "needs_followup", `parseStatus=${actual.parseStatus}`),
  check(actual.missingFields.includes("part_reference:wheels"), JSON.stringify(actual.missingFields)),
  check(actual.assistantContent.includes("轮毂") && actual.assistantContent.includes("具体品牌/型号") && actual.assistantContent.includes("配件参考图"), actual.assistantContent),
])
registerTest("E1b", "E 近似词配件追问", "只说加个车前盖", { text: "加个车前盖", vehicleFiles: [vehicle()] }, "needs_followup；车前盖应归类为 hood；提示补充机盖具体品牌/型号并上传机盖参考图。", (actual, status) => [
  check(status === 200, `status=${status}`),
  check(actual.parseStatus === "needs_followup", `parseStatus=${actual.parseStatus}`),
  check(actual.missingFields.includes("part_reference:hood"), JSON.stringify(actual.missingFields)),
  check(actual.assistantContent.includes("机盖") && actual.assistantContent.includes("具体品牌/型号") && actual.assistantContent.includes("配件参考图"), actual.assistantContent),
], "配件类别别名需要覆盖车前盖、前机盖、前盖、车头盖、前舱盖等 hood 近似词，避免落入泛化追问。")
;[
  ["E1c-wheels", "轮圈", "wheels", "轮毂"],
  ["E1c-calipers", "刹车套件", "calipers", "卡钳"],
  ["E1c-rear-wing", "鸭尾", "rear-wing", "尾翼"],
  ["E1c-front-bumper", "前包围", "front-bumper", "前唇"],
  ["E1c-side-skirts", "门槛条", "side-skirts", "侧裙"],
  ["E1c-diffuser", "后下巴", "diffuser", "扩散器"],
  ["E1c-exhaust", "尾嘴", "exhaust", "排气"],
  ["E1c-lights", "日行灯", "lights", "车灯"],
  ["E1c-mirrors", "反光镜", "mirrors", "后视镜"],
  ["E1c-grille", "鼻孔", "grille", "中网"],
].forEach(([id, alias, categoryId, label]) => {
  registerTest(id, "E 近似词配件追问", `只说加个${alias}`, { text: `加个${alias}`, vehicleFiles: [vehicle()] }, `needs_followup；${alias} 应归类为 ${categoryId}；提示补充${label}具体品牌/型号并上传参考图。`, (actual, status) => [
    check(status === 200, `status=${status}`),
    check(actual.parseStatus === "needs_followup", `parseStatus=${actual.parseStatus}`),
    check(actual.missingFields.includes(`part_reference:${categoryId}`), JSON.stringify(actual.missingFields)),
    check(actual.assistantContent.includes(label) && actual.assistantContent.includes("具体品牌/型号") && actual.assistantContent.includes("配件参考图"), actual.assistantContent),
  ])
})
registerTest("E2", "E 未上传配件追问", "未收录具体型号 ABC999 轮毂", { text: "换 ABC999 轮毂", vehicleFiles: [vehicle()] }, "needs_followup；提示系统暂未收录该配件 ABC999，并要求上传 ABC999 参考图。", (actual, status) => [
  check(status === 200, `status=${status}`),
  check(actual.parseStatus === "needs_followup", `parseStatus=${actual.parseStatus}`),
  check(actual.assistantContent.includes("ABC999") && actual.assistantContent.includes("系统暂未收录"), actual.assistantContent),
])
registerTest("E3", "E 后台资产命中", "具体型号 RSCBMW001 侧裙", { text: "换 RSCBMW001 侧裙", vehicleFiles: [vehicle()] }, "命中后台资产；ready；parts[0].source=asset_library；variant/model 包含 RSCBMW001。", (actual, status) => [
  check(status === 200, `status=${status}`),
  check(actual.dryRun === true, `dryRun=${actual.dryRun}`),
  check(actual.parts.some((item) => item.source === "asset_library" && `${item.model} ${item.variant}`.includes("RSCBMW001")), JSON.stringify(actual.parts)),
])
registerTest("E3a", "E 后台资产关键字命中", "具体关键字 HD14BMWF80-OE 机盖", { text: "换 HD14BMWF80-OE 机盖", vehicleFiles: [vehicle()] }, "命中后台资产；ready；parts[0].source=asset_library；assetId=seibon-oe-carbon-hood。", (actual, status) => [
  check(status === 200, `status=${status}`),
  check(actual.partColorPolicyChoiceRequired === true, `partColorPolicyChoiceRequired=${actual.partColorPolicyChoiceRequired}`),
  check(actual.partColorPolicyCategory === "hood", `partColorPolicyCategory=${actual.partColorPolicyCategory}`),
  check(actual.missingFields.includes("part_color_policy:hood"), JSON.stringify(actual.missingFields)),
])
registerTest("E4", "E 上传部分配件但文字追加未上传配件", "上传机盖图，同时要求轮毂", { text: "换这个机盖，再换轮毂", vehicleFiles: [vehicle()], partFiles: [part(files.hood, "carbon-hood-reference.jpg")] }, "不生图；needs_followup；要求补充轮毂具体品牌/型号并上传轮毂参考图，动态文案只应指向轮毂。", (actual, status) => [
  check(status === 200, `status=${status}`),
  check(actual.parseStatus === "needs_followup", `parseStatus=${actual.parseStatus}`),
  check(actual.missingFields.includes("part_reference:wheels"), JSON.stringify(actual.missingFields)),
  check(actual.assistantContent.includes("轮毂") && actual.assistantContent.includes("具体品牌/型号") && actual.assistantContent.includes("配件参考图") && !actual.assistantContent.includes("机盖，再换轮毂"), actual.assistantContent),
], "动态缺失配件文案应优先使用 missingFields 对应的类别名，或只抽取未上传/未命中的那一项，不能把整句“机盖，再换轮毂”当成配件型号。")
registerTest("E5", "E 上传配件分组", "上传 2 张侧裙图", { text: "装这套侧裙", vehicleFiles: [vehicle()], partFiles: [part(files.sideSkirt1, "side-skirt-primary.jpg"), part(files.sideSkirt2, "side-skirt-install.jpg")] }, "ready；parts.length=1；category=side-skirts；referenceImages=2。", (actual, status) => [
  check(status === 200, `status=${status}`),
  check(actual.parts.length === 1, `parts=${actual.parts.length}`),
  check(actual.parts[0]?.category === "side-skirts", JSON.stringify(actual.parts[0])),
  check(actual.parts[0]?.referenceImages?.length === 2, `refs=${actual.parts[0]?.referenceImages?.length}`),
  check(actual.previewPartImageUrls.length === 2, `previewRefs=${actual.previewPartImageUrls.length}`),
], "Mock guardrail 的中文允许词缺少“侧裙/装/安装/这套”等 Chat 常见表达，导致已上传配件图也被挡在 guardrail 外。")

registerTest("H1", "H 宽松 Guardrail", "原车图 + 做成这样，无配件图", { text: "做成这样", vehicleFiles: [vehicle()] }, "Chat guardrail 放行；parser 返回 needs_followup，不再 400。", (actual, status) => [
  check(status === 200, `status=${status}`),
  check(actual.parseStatus === "needs_followup", `parseStatus=${actual.parseStatus}`),
  check(actual.missingFields.includes("part_category"), JSON.stringify(actual.missingFields)),
])
registerTest("H2", "H 宽松 Guardrail", "原车图 + 侧裙图 + 做成这样", { text: "做成这样", vehicleFiles: [vehicle()], partFiles: [part(files.sideSkirt1, "side-skirt-primary.jpg"), part(files.sideSkirt2, "side-skirt-install.jpg")] }, "有配件图时短文本放行并生成 side-skirts part group。", (actual, status) => [
  check(status === 200, `status=${status}`),
  check(actual.dryRun === true, `dryRun=${actual.dryRun}`),
  check(actual.parts.length === 1, `parts=${actual.parts.length}`),
  check(actual.parts[0]?.category === "side-skirts", JSON.stringify(actual.parts[0])),
  check(actual.parts[0]?.referenceImages?.length === 2, `refs=${actual.parts[0]?.referenceImages?.length}`),
])
registerTest("H3", "H 宽松 Guardrail", "原车图 + 侧裙图 + 照着图片装", { text: "照着图片装", vehicleFiles: [vehicle()], partFiles: [part(files.sideSkirt1, "side-skirt-primary.jpg")] }, "常见口语短句放行，依靠配件识别生成 side-skirts。", (actual, status) => [
  check(status === 200, `status=${status}`),
  check(actual.dryRun === true, `dryRun=${actual.dryRun}`),
  check(actual.parts.length === 1, `parts=${actual.parts.length}`),
  check(actual.parts[0]?.category === "side-skirts", JSON.stringify(actual.parts[0])),
])
registerTest("H4", "H 宽松 Guardrail", "原车图 + 可以", { text: "可以", vehicleFiles: [vehicle()] }, "上下文短回复放行到 parser，由 parser 追问；不再 400。", (actual, status) => [
  check(status === 200, `status=${status}`),
  check(actual.parseStatus === "needs_followup", `parseStatus=${actual.parseStatus}`),
])
registerTest("H5", "H 宽松 Guardrail", "blocked term 仍然拦截", { text: "加 weapon", vehicleFiles: [vehicle()] }, "blocked terms 仍然 400，不因宽松 guardrail 放行。", (actual, status) => [
  check(status === 400, `status=${status}`),
  check(actual.error.includes("weapon") || actual.error.toLowerCase().includes("outside"), actual.error),
])

registerTest("G4", "G 上下文画布", "新会话不传车图", { text: "再低一点" }, "200；追问上传原车图。", (actual, status) => [
  check(status === 200, `status=${status}`),
  check((actual.assistantContent || actual.followUpQuestion).includes("原车照片"), actual.assistantContent || actual.followUpQuestion),
])

registerTest("E3b", "E catalog ambiguity", "brand-only Seibon hood should not auto-pick first asset", { text: "seibon hood", vehicleFiles: [vehicle()], language: "en" }, "needs_followup; brand-only catalog text is not an exact asset match", (actual, status) => [
  check(status === 200, `status=${status}`),
  check(actual.parseStatus === "needs_followup", `parseStatus=${actual.parseStatus}`),
  check(actual.missingFields.includes("part_reference:hood"), JSON.stringify(actual.missingFields)),
  check(!actual.parts.some((item) => item.source === "asset_library"), JSON.stringify(actual.parts)),
])

registerTest("B5", "B color parser", "vehicle + change to military green", { text: "\u6539\u6210\u519b\u7eff\u8272", vehicleFiles: [vehicle()] }, "dry run ready; paint.action=change; target=military green", (actual, status) => [
  check(status === 200, `status=${status}`),
  check(actual.dryRun === true, `dryRun=${actual.dryRun}`),
  check(actual.paint?.action === "change", JSON.stringify(actual.paint)),
  check(actual.paint?.target === "\u519b\u7eff\u8272", JSON.stringify(actual.paint)),
  check(actual.parts.length === 0, `parts=${actual.parts.length}`),
])

registerTest("B6", "B color parser", "vehicle + darker military green not too bright", { text: "\u6539\u6210\u66f4\u6df1\u7684\u519b\u7eff\u8272\uff0c\u4e0d\u8981\u90a3\u4e48\u4eae", vehicleFiles: [vehicle()] }, "dry run ready; paint.action=change; target=military green; prompt carries darker preference", (actual, status) => [
  check(status === 200, `status=${status}`),
  check(actual.paint?.action === "change", JSON.stringify(actual.paint)),
  check(actual.paint?.target === "\u519b\u7eff\u8272", JSON.stringify(actual.paint)),
  check(actual.promptHidden.includes("lower-brightness"), actual.promptHidden),
])

registerTest("B7", "B color parser", "vehicle + typo change to egg yellow", { text: "\u628a\u8fd9\u8f86\u8f66\u5f00\u6210\u86cb\u9ec4\u8272", vehicleFiles: [vehicle()] }, "dry run ready; common typo resolves to yellow body paint", (actual, status) => [
  check(status === 200, `status=${status}`),
  check(actual.paint?.action === "change", JSON.stringify(actual.paint)),
  check(actual.paint?.target === "\u9ec4\u8272", JSON.stringify(actual.paint)),
])

registerTest("B8", "B color parser", "vague color correction asks for target color", { text: "\u4e0d\u662f\u8fd9\u79cd\u7eff\u554a", vehicleFiles: [vehicle()] }, "needs_followup; after fallback cannot confirm, asks for one clearer modification detail", (actual, status) => [
  check(status === 200, `status=${status}`),
  check(actual.parseStatus === "needs_followup", `parseStatus=${actual.parseStatus}`),
  check(actual.missingFields.includes("paint_color"), JSON.stringify(actual.missingFields)),
  check(actual.assistantContent.includes("\u8bf7\u5148\u8865\u5145\u4e00\u4e2a\u66f4\u660e\u786e\u7684\u4fe1\u606f"), actual.assistantContent),
])

registerTest("B9", "B color parser", "freeform English color phrase", { text: "paint it midnight teal", vehicleFiles: [vehicle()], language: "en" }, "dry run ready; paint target keeps freeform natural-language color", (actual, status) => [
  check(status === 200, `status=${status}`),
  check(actual.dryRun === true, `dryRun=${actual.dryRun}`),
  check(actual.paint?.action === "change", JSON.stringify(actual.paint)),
  check(actual.paint?.target === "midnight teal", JSON.stringify(actual.paint)),
])

registerTest("B10", "B color parser", "natural-language brake caliper repaint", { text: "\u80fd\u4e0d\u80fd\u628a\u8fd9\u4e2a\u5361\u94b3\u6539\u6210\u6a59\u8272\u554a", vehicleFiles: [vehicle()] }, "dry run ready; caliper color repaint does not ask for part reference", (actual, status) => [
  check(status === 200, `status=${status}`),
  check(actual.dryRun === true, `dryRun=${actual.dryRun}`),
  check(actual.paint?.action === "keep_original", JSON.stringify(actual.paint)),
  check(actual.parts.some((item) => item.category === "calipers" && item.source === "free_text" && item.color === "\u6a59\u8272"), JSON.stringify(actual.parts)),
  check(!actual.missingFields.includes("part_reference:calipers"), JSON.stringify(actual.missingFields)),
  check(actual.promptHidden.includes("brake caliper") && actual.promptHidden.includes("\u6a59\u8272"), actual.promptHidden),
])

registerTest("B11", "B color parser", "brake caliper repaint without target asks color only", { text: "\u628a\u5361\u94b3\u6539\u8272", vehicleFiles: [vehicle()] }, "needs_followup; asks for target caliper color instead of brand/model/reference", (actual, status) => [
  check(status === 200, `status=${status}`),
  check(actual.parseStatus === "needs_followup", `parseStatus=${actual.parseStatus}`),
  check(actual.missingFields.includes("paint_color"), JSON.stringify(actual.missingFields)),
  check(!actual.missingFields.includes("part_reference:calipers"), JSON.stringify(actual.missingFields)),
  check(actual.assistantContent.includes("\u5239\u8f66\u5361\u94b3") && actual.assistantContent.includes("\u989c\u8272"), actual.assistantContent),
])

registerTest("B12", "B color parser", "typo Brembo caliper plus white body asks for caliper reference", { text: "\u6539\u4e2abembo\u5361\u94b3\uff0c\u518d\u6539\u6210\u767d\u8272", vehicleFiles: [vehicle()] }, "needs_followup; typo brand caliper is a part request, while white remains a body paint intent", (actual, status) => [
  check(status === 200, `status=${status}`),
  check(actual.parseStatus === "needs_followup", `parseStatus=${actual.parseStatus}`),
  check(actual.missingFields.includes("part_reference:calipers"), JSON.stringify(actual.missingFields)),
  check(!actual.missingFields.includes("paint_color"), JSON.stringify(actual.missingFields)),
  check(actual.assistantContent.includes("\u5361\u94b3") && actual.assistantContent.includes("\u914d\u4ef6\u53c2\u8003\u56fe"), actual.assistantContent),
])

registerTest("B13", "B color parser", "exact Brembo GT caliper plus white body", { text: "\u6539\u4e2aBrembo GT\u5361\u94b3\uff0c\u518d\u6539\u6210\u767d\u8272", vehicleFiles: [vehicle()] }, "dry run ready; exact catalog caliper is selected and body paint is white", (actual, status) => [
  check(status === 200, `status=${status}`),
  check(actual.dryRun === true, `dryRun=${actual.dryRun}`),
  check(actual.paint?.action === "change" && actual.paint?.target === "\u767d\u8272", JSON.stringify(actual.paint)),
  check(actual.parts.some((item) => item.category === "calipers" && item.assetId === "brembo-gt-red"), JSON.stringify(actual.parts)),
  check(actual.promptHidden.includes("Brembo") && actual.promptHidden.includes("\u767d\u8272"), actual.promptHidden),
])

registerTest("L1", "L LLM fallback fixture", "vague dark green wording falls back to narrow paint intent", { text: "\u60f3\u8981\u6697\u4e00\u70b9\u7684\u7eff", vehicleFiles: [vehicle()] }, "dry run ready; fallback fixture supplies paint target without external AI", (actual, status) => [
  check(status === 200, `status=${status}`),
  check(actual.dryRun === true, `dryRun=${actual.dryRun}`),
  check(actual.paint?.action === "change", JSON.stringify(actual.paint)),
  check(actual.paint?.target === "\u6df1\u7eff\u8272", JSON.stringify(actual.paint)),
  check(actual.debugSteps.includes("fallback_intent"), JSON.stringify(actual.debugSteps)),
])

registerTest("L2", "L LLM fallback fixture", "vague stance wording falls back to narrow stance intent", { text: "stance more aggressive", vehicleFiles: [vehicle()], language: "en" }, "dry run ready; fallback fixture supplies stance", (actual, status) => [
  check(status === 200, `status=${status}`),
  check(actual.dryRun === true, `dryRun=${actual.dryRun}`),
  check(Number(actual.stance?.value) === 70, JSON.stringify(actual.stance)),
  check(actual.debugSteps.includes("fallback_intent"), JSON.stringify(actual.debugSteps)),
])

registerTest("L3", "L LLM fallback fixture", "fallback category still asks for missing reference", { text: "\u7ed9\u5b83\u6765\u4e2a tail aero", vehicleFiles: [vehicle()] }, "needs_followup; fallback recognizes rear-wing but local validator asks for reference image", (actual, status) => [
  check(status === 200, `status=${status}`),
  check(actual.parseStatus === "needs_followup", `parseStatus=${actual.parseStatus}`),
  check(actual.missingFields.includes("part_reference:rear-wing"), JSON.stringify(actual.missingFields)),
  check(actual.parts.length === 0, JSON.stringify(actual.parts)),
])

registerTest("P1", "P part color policy", "hood keyword hit asks body-color vs exposed carbon", { text: "add HD14BMWF80-OE hood", vehicleFiles: [vehicle()], language: "en" }, "partColorPolicyChoiceRequired=true; category=hood", (actual, status) => [
  check(status === 200, `status=${status}`),
  check(actual.partColorPolicyChoiceRequired === true, `partColorPolicyChoiceRequired=${actual.partColorPolicyChoiceRequired}`),
  check(actual.partColorPolicyCategory === "hood", `partColorPolicyCategory=${actual.partColorPolicyCategory}`),
  check(actual.missingFields.includes("part_color_policy:hood"), JSON.stringify(actual.missingFields)),
])

registerTest("P2", "P part color policy", "confirmed exposed carbon hood proceeds to catalog asset", { text: "add HD14BMWF80-OE hood", vehicleFiles: [vehicle()], language: "en", partColorPolicyConfirmed: true, partColorPolicyCategory: "hood", partColorPolicy: "exposed_carbon" }, "ready; seibon hood selected; colorPolicy=exposed_carbon", (actual, status) => [
  check(status === 200, `status=${status}`),
  check(actual.dryRun === true, `dryRun=${actual.dryRun}`),
  check(actual.parts.some((item) => item.category === "hood" && item.assetId === "seibon-oe-carbon-hood" && item.colorPolicy === "exposed_carbon"), JSON.stringify(actual.parts)),
])

registerTest("P3", "P part color policy", "explicit body-color hood does not ask", { text: "add body color HD14BMWF80-OE hood", vehicleFiles: [vehicle()], language: "en" }, "ready; seibon hood selected; colorPolicy=body_color", (actual, status) => [
  check(status === 200, `status=${status}`),
  check(actual.partColorPolicyChoiceRequired === false, `partColorPolicyChoiceRequired=${actual.partColorPolicyChoiceRequired}`),
  check(actual.parts.some((item) => item.category === "hood" && item.assetId === "seibon-oe-carbon-hood" && item.colorPolicy === "body_color"), JSON.stringify(actual.parts)),
])

registerTest("P4", "P part color policy", "mirror cap keyword hit asks body-color vs exposed carbon", { text: "add Carbon Mirror Caps", vehicleFiles: [vehicle()], language: "en" }, "partColorPolicyChoiceRequired=true; category=mirrors", (actual, status) => [
  check(status === 200, `status=${status}`),
  check(actual.partColorPolicyChoiceRequired === true, `partColorPolicyChoiceRequired=${actual.partColorPolicyChoiceRequired}`),
  check(actual.partColorPolicyCategory === "mirrors", `partColorPolicyCategory=${actual.partColorPolicyCategory}`),
  check(actual.missingFields.includes("part_color_policy:mirrors"), JSON.stringify(actual.missingFields)),
])

registerTest("P5", "P result correction", "mirror color correction uses latest local mirror edit", { text: "\u8033\u6735\u600e\u4e48\u4e0d\u662f\u7c89\u8272\u7684", vehicleFiles: [vehicle()] }, "ready; parts[0]=mirrors/free_text; paint remains keep_original", (actual, status) => [
  check(status === 200, `status=${status}`),
  check(actual.paint?.action === "keep_original", JSON.stringify(actual.paint)),
  check(actual.parts.some((item) => item.category === "mirrors" && item.source === "free_text" && item.colorPolicy === "body_color"), JSON.stringify(actual.parts)),
  check(actual.promptHidden.includes("mirror caps") || actual.promptHidden.includes("mirror housings"), actual.promptHidden),
])

registerTest("P6", "P part color policy", "hood keyword with carbon in model name still asks policy", { text: "add Seibon OE Carbon Hood", vehicleFiles: [vehicle()], language: "en" }, "partColorPolicyChoiceRequired=true; category=hood", (actual, status) => [
  check(status === 200, `status=${status}`),
  check(actual.partColorPolicyChoiceRequired === true, `partColorPolicyChoiceRequired=${actual.partColorPolicyChoiceRequired}`),
  check(actual.partColorPolicyCategory === "hood", `partColorPolicyCategory=${actual.partColorPolicyCategory}`),
  check(actual.missingFields.includes("part_color_policy:hood"), JSON.stringify(actual.missingFields)),
])

registerTest("P7", "P part color policy", "uploaded carbon hood reference asks policy", { text: "", vehicleFiles: [vehicle()], partFiles: [part(files.hood, "carbon-hood-reference.jpg")], language: "en" }, "partColorPolicyChoiceRequired=true; category=hood", (actual, status) => [
  check(status === 200, `status=${status}`),
  check(actual.partColorPolicyChoiceRequired === true, `partColorPolicyChoiceRequired=${actual.partColorPolicyChoiceRequired}`),
  check(actual.partColorPolicyCategory === "hood", `partColorPolicyCategory=${actual.partColorPolicyCategory}`),
  check(actual.missingFields.includes("part_color_policy:hood"), JSON.stringify(actual.missingFields)),
])

registerTest("P8", "P part color policy", "uploaded carbon mirror cap reference asks policy", { text: "", vehicleFiles: [vehicle()], partFiles: [part(files.mirror, "carbon-mirror-caps.jpg")], language: "en" }, "partColorPolicyChoiceRequired=true; category=mirrors", (actual, status) => [
  check(status === 200, `status=${status}`),
  check(actual.partColorPolicyChoiceRequired === true, `partColorPolicyChoiceRequired=${actual.partColorPolicyChoiceRequired}`),
  check(actual.partColorPolicyCategory === "mirrors", `partColorPolicyCategory=${actual.partColorPolicyCategory}`),
  check(actual.missingFields.includes("part_color_policy:mirrors"), JSON.stringify(actual.missingFields)),
])

registerTest("P8b", "P part color policy", "uploaded carbon hood and mirror references ask both policies", { text: "", vehicleFiles: [vehicle()], partFiles: [part(files.hood, "carbon-hood-reference.jpg"), part(files.mirror, "carbon-mirror-caps.jpg")], language: "en" }, "partColorPolicyChoicesRequired=true; categories=hood,mirrors", (actual, status) => [
  check(status === 200, `status=${status}`),
  check(actual.partColorPolicyChoiceRequired === true, `partColorPolicyChoiceRequired=${actual.partColorPolicyChoiceRequired}`),
  check(actual.partColorPolicyChoicesRequired === true, `partColorPolicyChoicesRequired=${actual.partColorPolicyChoicesRequired}`),
  check(actual.partColorPolicyChoices.some((choice) => choice.categoryId === "hood"), JSON.stringify(actual.partColorPolicyChoices)),
  check(actual.partColorPolicyChoices.some((choice) => choice.categoryId === "mirrors"), JSON.stringify(actual.partColorPolicyChoices)),
  check(actual.missingFields.includes("part_color_policy:hood"), JSON.stringify(actual.missingFields)),
  check(actual.missingFields.includes("part_color_policy:mirrors"), JSON.stringify(actual.missingFields)),
])

registerTest("P8c", "P part color policy", "confirmed hood and mirror policies proceed together", {
  text: "",
  vehicleFiles: [vehicle()],
  partFiles: [part(files.hood, "carbon-hood-reference.jpg"), part(files.mirror, "carbon-mirror-caps.jpg")],
  language: "en",
  partColorPolicyConfirmed: true,
  partColorPolicyChoicesJson: JSON.stringify({ hood: "exposed_carbon", mirrors: "body_color" }),
}, "ready; uploaded hood and mirrors use confirmed color policies", (actual, status) => [
  check(status === 200, `status=${status}`),
  check(actual.dryRun === true, `dryRun=${actual.dryRun}`),
  check(actual.partColorPolicyChoiceRequired === false, `partColorPolicyChoiceRequired=${actual.partColorPolicyChoiceRequired}`),
  check(actual.parts.some((item) => item.category === "hood" && item.source === "uploaded_reference" && item.colorPolicy === "exposed_carbon"), JSON.stringify(actual.parts)),
  check(actual.parts.some((item) => item.category === "mirrors" && item.source === "uploaded_reference" && item.colorPolicy === "body_color"), JSON.stringify(actual.parts)),
])

registerTest("P9", "P part color policy", "explicit exposed carbon mirror cap does not ask", { text: "add exposed carbon Mirror Caps", vehicleFiles: [vehicle()], language: "en" }, "ready; mirror cap selected; colorPolicy=exposed_carbon", (actual, status) => [
  check(status === 200, `status=${status}`),
  check(actual.partColorPolicyChoiceRequired === false, `partColorPolicyChoiceRequired=${actual.partColorPolicyChoiceRequired}`),
  check(actual.parts.some((item) => item.category === "mirrors" && item.source === "asset_library" && item.colorPolicy === "exposed_carbon"), JSON.stringify(actual.parts)),
])

registerTest("P10", "P part color policy", "confirmed body-color mirror cap proceeds to catalog asset", { text: "add Carbon Mirror Caps", vehicleFiles: [vehicle()], language: "en", partColorPolicyConfirmed: true, partColorPolicyCategory: "mirrors", partColorPolicy: "body_color" }, "ready; mirror cap selected; colorPolicy=body_color", (actual, status) => [
  check(status === 200, `status=${status}`),
  check(actual.partColorPolicyChoiceRequired === false, `partColorPolicyChoiceRequired=${actual.partColorPolicyChoiceRequired}`),
  check(actual.parts.some((item) => item.category === "mirrors" && item.source === "asset_library" && item.colorPolicy === "body_color"), JSON.stringify(actual.parts)),
])

registerTest("S1", "S stance presets", "raise ride height maps to raise preset", { text: "\u8f66\u8eab\u5347\u9ad8\u4e00\u70b9", vehicleFiles: [vehicle()] }, "dry run ready; stance=25", (actual, status) => [
  check(status === 200, `status=${status}`),
  check(Number(actual.stance?.value) === 25, JSON.stringify(actual.stance)),
])

registerTest("S2", "S stance presets", "flush fitment maps to flush preset", { text: "\u505a\u9f50\u8fb9\u4f4e\u8db4\uff0c\u8f6e\u7709\u9f50\u8fb9", vehicleFiles: [vehicle()] }, "dry run ready; stance=70", (actual, status) => [
  check(status === 200, `status=${status}`),
  check(Number(actual.stance?.value) === 70, JSON.stringify(actual.stance)),
])

registerTest("S3", "S stance presets", "air suspension wording maps to aired-out preset", { text: "\u6539\u6210\u6c14\u52a8\u4f4e\u8db4\uff0c\u8d34\u5730\u4e00\u70b9", vehicleFiles: [vehicle()] }, "dry run ready; stance=90", (actual, status) => [
  check(status === 200, `status=${status}`),
  check(Number(actual.stance?.value) === 90, JSON.stringify(actual.stance)),
])

registerTest("S4", "S stance presets", "English air suspension maps to aired-out preset", { text: "make it air suspension aired out", vehicleFiles: [vehicle()], language: "en" }, "dry run ready; stance=90", (actual, status) => [
  check(status === 200, `status=${status}`),
  check(Number(actual.stance?.value) === 90, JSON.stringify(actual.stance)),
])

registerTest("S5", "S stance presets", "conflicting raise and aired-out stance asks follow-up", { text: "\u5347\u9ad8\u4f46\u662f\u8d34\u5730\u8d9f\u4e0b", vehicleFiles: [vehicle()] }, "needs_followup; user must confirm stance direction", (actual, status) => [
  check(status === 200, `status=${status}`),
  check(actual.parseStatus === "needs_followup", `parseStatus=${actual.parseStatus}`),
  check(actual.missingFields.includes("stance_preset"), JSON.stringify(actual.missingFields)),
])

async function runTests(cookie) {
  const results = []
  async function run(testCase, overrideOptions = undefined) {
    const options = overrideOptions || testCase.options
    const response = await chat(cookie, options)
    const checks = testCase.checker(response.actual, response.status, response.body)
    const result = {
      id: testCase.id,
      group: testCase.group,
      title: testCase.title,
      input: {
        text: options.text,
        contextMode: options.contextMode || "latest",
        vehicleCount: options.vehicleFiles?.length || 0,
        partCount: options.partFiles?.length || 0,
      },
      expected: testCase.expected,
      statusCode: response.status,
      actual: response.actual,
      checks,
      ok: passAll(checks),
      fix: passAll(checks) ? "" : testCase.fix,
    }
    results.push(result)
    return response
  }

  for (const testCase of testCases) {
    await run(testCase)
  }

  const p11Seed = await run(
    {
      id: "P11a",
      group: "P result correction",
      title: "seed previous paint target for mirror correction",
      options: { text: "paint it deep green", vehicleFiles: [vehicle()], language: "en" },
      expected: "ready; previous standardJson stores paint.target=deep green",
      checker: (actual, status) => [
        check(status === 200, `status=${status}`),
        check(Boolean(actual.sessionId), `sessionId=${actual.sessionId}`),
        check(actual.paint?.action === "change", JSON.stringify(actual.paint)),
        check(Boolean(actual.paint?.target), JSON.stringify(actual.paint)),
      ],
      fix: "",
    },
  )
  const p11Target = p11Seed.actual.paint?.target || ""
  await run(
    {
      id: "P11b",
      group: "P result correction",
      title: "mirror correction without color inherits previous paint target",
      options: { text: "why aren't the mirrors that color", sessionId: p11Seed.actual.sessionId, language: "en" },
      expected: "ready; local mirrors correction; prompt inherits previous paint target",
      checker: (actual, status) => [
        check(status === 200, `status=${status}`),
        check(actual.parts.some((item) => item.category === "mirrors" && item.source === "free_text"), JSON.stringify(actual.parts)),
        check(actual.promptHidden.toLowerCase().includes("mirror caps") || actual.promptHidden.toLowerCase().includes("mirror housings"), actual.promptHidden),
        check(Boolean(p11Target) && actual.promptHidden.includes(p11Target), actual.promptHidden),
      ],
      fix: "",
    },
  )

  const f1 = await run(
    {
      id: "F1",
      group: "F 多轮追问",
      title: "第 1 轮未收录型号",
      options: { text: "换 ABC999 轮毂", vehicleFiles: [vehicle()] },
      expected: "追问上传 ABC999 参考图。",
      checker: (actual, status) => [check(status === 200, `status=${status}`), check(actual.assistantContent.includes("ABC999"), actual.assistantContent)],
      fix: "",
    },
  )
  const fSession = f1.actual.sessionId
  await run(
    {
      id: "F2",
      group: "F 多轮追问",
      title: "第 2 轮仍未上传图",
      options: { text: "就是这个型号", sessionId: fSession },
      expected: "应继续围绕 ABC999 追问参考图。",
      checker: (actual, status) => [check(status === 200, `status=${status}`), check(actual.assistantContent.includes("参考图") || actual.assistantContent.includes("配置模式"), actual.assistantContent)],
      fix: "需要把上一轮 missing part_reference 的待补信息写入会话上下文；用户后续只说“就是这个型号/没有图”时，也应沿用上一轮缺失配件，而不是退回泛化追问。",
    },
  )
  await run(
    {
      id: "F3",
      group: "F 多轮追问",
      title: "第 3 轮仍未上传图",
      options: { text: "没有图片", sessionId: fSession },
      expected: "应继续引导上传参考图。",
      checker: (actual, status) => [check(status === 200, `status=${status}`), check(actual.assistantContent.includes("参考图") || actual.assistantContent.includes("配置模式"), actual.assistantContent)],
      fix: "同 F2；追问状态需要跨轮保持。",
    },
  )
  await run(
    {
      id: "F4",
      group: "F 多轮追问",
      title: "第 4 轮仍未上传图",
      options: { text: "继续做", sessionId: fSession },
      expected: "应引导去配置模式。",
      checker: (actual, status) => [check(status === 200, `status=${status}`), check(actual.assistantContent.includes("配置模式"), actual.assistantContent)],
      fix: "多轮失败计数目前依赖 assistant 文案命中，且不记录 pending missing field；应改成结构化 pending_followup 状态后再判断三轮阈值。",
    },
  )

  const g1 = await run(
    {
      id: "G1",
      group: "G 上下文画布",
      title: "第 1 轮原车改灰",
      options: { text: "改成灰色，降低一点", vehicleFiles: [vehicle()] },
      expected: "创建会话；dry run ready；context=latest。",
      checker: (actual, status) => [
        check(status === 200, `status=${status}`),
        check(Boolean(actual.sessionId), `sessionId=${actual.sessionId}`),
        check(actual.contextMode === "latest", `context=${actual.contextMode}`),
      ],
      fix: "",
    },
  )
  const gSession = g1.actual.sessionId
  const gOriginalSource = g1.actual.sourceImageUrl
  await run(
    {
      id: "G1b",
      group: "G context canvas",
      title: "existing vehicle canvas plus part upload allows empty text",
      options: { text: "", sessionId: gSession, partFiles: [part(files.sideSkirt1, "side-skirt-primary.jpg")] },
      expected: "200 dry run ready; existing session vehicle canvas plus uploaded part image can omit text",
      checker: (actual, status) => [
        check(status === 200, `status=${status}`),
        check(actual.dryRun === true, `dryRun=${actual.dryRun}`),
        check(actual.parts.length === 1, `parts=${actual.parts.length}`),
        check(actual.parts[0]?.category === "side-skirts", JSON.stringify(actual.parts[0])),
      ],
      fix: "",
    },
  )
  await run(
    {
      id: "G2",
      group: "G 上下文画布",
      title: "同会话不传车图 latest 续改",
      options: { text: "再降低一点", sessionId: gSession, contextMode: "latest" },
      expected: "不要求上传车图；ready；context=latest；dry run 下 source 复用原始画布。",
      checker: (actual, status) => [
        check(status === 200, `status=${status}`),
        check(actual.contextMode === "latest", `context=${actual.contextMode}`),
        check(Number(actual.stance?.value) === 50, JSON.stringify(actual.stance)),
        check(actual.sourceImageUrl === gOriginalSource, `source=${actual.sourceImageUrl}; original=${gOriginalSource}`),
      ],
      fix: "",
    },
  )
  await run(
    {
      id: "G3",
      group: "G 上下文画布",
      title: "同会话 original 改白色",
      options: { text: "改成白色，降低一点", sessionId: gSession, contextMode: "original" },
      expected: "不要求上传车图；ready；context=original；source 为原始画布。",
      checker: (actual, status) => [
        check(status === 200, `status=${status}`),
        check(actual.contextMode === "original", `context=${actual.contextMode}`),
        check(actual.paint?.action === "change", JSON.stringify(actual.paint)),
        check(actual.sourceImageUrl === gOriginalSource, `source=${actual.sourceImageUrl}; original=${gOriginalSource}`),
      ],
      fix: "",
    },
  )

  const gContextSeed = await run(
    {
      id: "G5",
      group: "G context choice",
      title: "seed a session with a generated result",
      options: { text: "change to white", vehicleFiles: [vehicle()], language: "en" },
      expected: "ready dry-run session that can be marked as having a generated result",
      checker: (actual, status) => [
        check(status === 200, `status=${status}`),
        check(Boolean(actual.sessionId), `sessionId=${actual.sessionId}`),
        check(Boolean(actual.sourceImageUrl), `source=${actual.sourceImageUrl}`),
      ],
      fix: "",
    },
  )
  markLatestAssistantAsResult(gContextSeed.actual.sessionId, gContextSeed.actual.sourceImageUrl)
  await run(
    {
      id: "G6",
      group: "G context choice",
      title: "ready request asks for original/latest inside chat",
      options: { text: "lower it a little", sessionId: gContextSeed.actual.sessionId, language: "en" },
      expected: "contextChoiceRequired=true before generation when a latest result exists and no new vehicle is uploaded",
      checker: (actual, status) => [
        check(status === 200, `status=${status}`),
        check(actual.contextChoiceRequired === true, `contextChoiceRequired=${actual.contextChoiceRequired}`),
        check(actual.assistantContent.includes("original uploaded vehicle photo") || actual.assistantContent.includes("latest generated image"), actual.assistantContent),
      ],
      fix: "",
    },
  )
  await run(
    {
      id: "G7",
      group: "G context choice",
      title: "confirmed original context proceeds to dry run",
      options: { text: "lower it a little", sessionId: gContextSeed.actual.sessionId, contextMode: "original", contextConfirmed: true, language: "en" },
      expected: "confirmed context bypasses the question and produces a standardJson preview",
      checker: (actual, status) => [
        check(status === 200, `status=${status}`),
        check(actual.contextChoiceRequired === false, `contextChoiceRequired=${actual.contextChoiceRequired}`),
        check(actual.contextMode === "original", `context=${actual.contextMode}`),
        check(Number(actual.stance?.value) === 50, JSON.stringify(actual.stance)),
      ],
      fix: "",
    },
  )

  return results
}

function shortActual(actual) {
  return [
    actual.error ? `error=${actual.error}` : "",
    actual.assistantContent ? `assistant=${actual.assistantContent.replace(/\n/g, " / ")}` : "",
    actual.contextChoiceRequired ? `contextChoiceRequired=${actual.contextChoiceRequired}` : "",
    actual.partColorPolicyChoiceRequired ? `partColorPolicyChoiceRequired=${actual.partColorPolicyChoiceRequired}:${actual.partColorPolicyCategory}` : "",
    actual.partColorPolicyChoices?.length ? `partColorPolicyChoices=${actual.partColorPolicyChoices.map((choice) => choice.categoryId).join(",")}` : "",
    actual.parseStatus ? `parseStatus=${actual.parseStatus}` : "",
    actual.missingFields?.length ? `missingFields=${actual.missingFields.join(",")}` : "",
    actual.paint ? `paint=${actual.paint.action}:${actual.paint.target}` : "",
    actual.stance ? `stance=${actual.stance.value}` : "",
    actual.contextMode ? `context=${actual.contextMode}` : "",
    actual.parts?.length ? `parts=${actual.parts.map((partItem) => `${partItem.category}/${partItem.source}/${partItem.model || partItem.variant || ""}/refs:${partItem.referenceImages.length}`).join("; ")}` : "parts=0",
    actual.previewPartImageUrls?.length ? `providerRefs=${actual.previewPartImageUrls.length}` : "",
  ]
    .filter(Boolean)
    .join("\n")
}

function markdownReport(results) {
  const passed = results.filter((item) => item.ok).length
  const failed = results.length - passed
  const now = new Date().toISOString()
  const rows = results
    .map((result) => {
      const status = result.ok ? "正常" : "异常"
      const checks = result.checks.map((item) => `${item.pass ? "PASS" : "FAIL"}: ${item.detail}`).join("<br>")
      return [
        `| ${result.id} | ${result.group} | ${result.title} | ${result.expected.replace(/\|/g, "/")} | ${shortActual(result.actual).replace(/\|/g, "/").replace(/\n/g, "<br>")} | ${status} | ${checks.replace(/\|/g, "/")} | ${result.fix || ""} |`,
      ].join("\n")
    })
    .join("\n")
  const failedList = results
    .filter((item) => !item.ok)
    .map((item) => `- ${item.id} ${item.title}: ${item.fix || "需要进一步确认实际输出是否符合产品预期。"}`)
    .join("\n")
  return [
    "# Chat Mode Dry Run Test Report",
    "",
    `- 测试时间: ${now}`,
    "- 测试方式: 本地启动 Next dev server，登录 demo 用户，POST `/api/chat/messages`。",
    "- 保护开关: `dryRun=1`, `DISABLE_EXTERNAL_AI=1`, `CHAT_DRY_RUN_DEFAULT=1`。",
    "- 范围: A 上传限制、B 基础生成、E 未上传/资产命中/配件分组、F 多轮追问、G 上下文画布、H 宽松 Guardrail。",
    `- 汇总: ${passed}/${results.length} 正常，${failed} 异常。`,
    "",
    "## 测试明细",
    "",
    "| ID | 分组 | 用例 | 期望输出 | 实际输出摘要 | 是否正常 | 检查项 | 后续修改方向 |",
    "| --- | --- | --- | --- | --- | --- | --- | --- |",
    rows,
    "",
    "## 异常汇总",
    "",
    failedList || "无。",
    "",
  ].join("\n")
}

try {
  await waitForServer()
  const cookie = await login()
  const results = await runTests(cookie)
  await fs.mkdir(outputDir, { recursive: true })
  await fs.writeFile(jsonPath, `${JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2)}\n`, "utf8")
  await fs.writeFile(reportPath, markdownReport(results), "utf8")
  console.log(JSON.stringify({ reportPath, jsonPath, total: results.length, passed: results.filter((item) => item.ok).length, failed: results.filter((item) => !item.ok).length }, null, 2))
} finally {
  try {
    execFileSync("taskkill.exe", ["/PID", String(server.pid), "/T", "/F"], { stdio: "ignore" })
  } catch {
    server.kill("SIGTERM")
  }
  server.stdout.destroy()
  server.stderr.destroy()
}
