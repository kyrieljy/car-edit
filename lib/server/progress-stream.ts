import type { GenerationProgressEvent, GenerationProgressStep, GenerationProgressUpdate } from "@/lib/types"

export type ProgressLanguage = "en" | "zh"
export type ProgressEmitter = (event: GenerationProgressUpdate) => void

const progressMessages: Record<GenerationProgressStep, Record<ProgressLanguage, string>> = {
  upload_validation: { en: "Validating uploads...", zh: "正在校验上传内容..." },
  canvas_resolve: { en: "Resolving...", zh: "正在解析..." },
  guardrail: { en: "Running local safety checks...", zh: "正在进行本地安全检查..." },
  vehicle_recognition: { en: "Recognizing vehicle and parts...", zh: "正在识别车辆及配件..." },
  part_recognition: { en: "Recognizing vehicle and parts...", zh: "正在识别车辆及配件..." },
  local_parse: { en: "Parsing request...", zh: "正在解析需求..." },
  llm_fallback: { en: "Identifying intent...", zh: "正在意图识别..." },
  standard_json: { en: "Building standard JSON...", zh: "正在组装标准 JSON..." },
  prompt_build: { en: "Building generation prompt...", zh: "正在组装提示词..." },
  entitlement: { en: "Checking generation quota...", zh: "正在校验生成额度..." },
  save_source: { en: "Saving source vehicle...", zh: "正在保存原始车辆图..." },
  image_generation: { en: "Generating...", zh: "正在生成..." },
  provider_retry: { en: "Retrying generation service...", zh: "正在重试生成服务..." },
  provider_fallback: { en: "Switching backup generation service...", zh: "正在切换备用生成服务..." },
  result_check: { en: "Checking result...", zh: "正在检查结果..." },
  save_record: { en: "Saving generation record...", zh: "正在保存生成记录..." },
  complete: { en: "Complete.", zh: "已完成。" },
}

const hiddenProgressSteps = new Set<GenerationProgressStep>(["standard_json", "prompt_build", "entitlement"])

export function noopProgress() {
  // Intentionally empty. Keeps JSON endpoints on the same code path without streaming.
}

export function progressMessage(step: GenerationProgressStep, language: ProgressLanguage) {
  return progressMessages[step]?.[language] ?? progressMessages[step]?.en ?? step
}

export function createProgressEvent(update: GenerationProgressUpdate, startedAt: number, language: ProgressLanguage): GenerationProgressEvent {
  return {
    type: "progress",
    step: update.step,
    message: update.message || progressMessage(update.step, language),
    elapsedMs: Date.now() - startedAt,
    provider: update.provider,
    retryAttempt: update.retryAttempt,
    meta: update.meta,
  }
}

export function ndjsonProgressResponse(
  run: (emit: ProgressEmitter) => Promise<Response>,
  language: ProgressLanguage,
) {
  const encoder = new TextEncoder()
  const startedAt = Date.now()
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const write = (value: unknown) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`))
      }
      const emit: ProgressEmitter = (update) => {
        if (hiddenProgressSteps.has(update.step)) return
        write(createProgressEvent(update, startedAt, language))
      }
      run(emit)
        .then(async (response) => {
          const text = await response.text()
          let body: unknown = null
          try {
            body = text ? JSON.parse(text) : null
          } catch {
            body = { error: text || response.statusText || "Request failed" }
          }
          write({ type: "result", status: response.status, ok: response.ok, body })
        })
        .catch((error) => {
          write({
            type: "result",
            status: 500,
            ok: false,
            body: { error: error instanceof Error ? error.message : "Generation failed" },
          })
        })
        .finally(() => controller.close())
    },
  })
  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  })
}
