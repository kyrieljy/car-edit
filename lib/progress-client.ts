import type { GenerationProgressEvent, GenerationProgressStreamEvent } from "@/lib/types"

export type ProgressResponse = {
  status: number
  ok: boolean
  body: any
}

export async function readProgressResponse(
  response: Response,
  onProgress: (event: GenerationProgressEvent) => void,
): Promise<ProgressResponse> {
  const contentType = response.headers.get("content-type") || ""
  if (!response.body || !contentType.includes("application/x-ndjson")) {
    const body = await response.json().catch(() => ({}))
    return { status: response.status, ok: response.ok, body }
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let result: ProgressResponse | null = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() || ""
    for (const line of lines) {
      const event = parseProgressLine(line)
      if (!event) continue
      if (event.type === "progress") {
        onProgress(event)
      } else {
        result = { status: event.status, ok: event.ok, body: event.body }
      }
    }
  }

  buffer += decoder.decode()
  const trailing = parseProgressLine(buffer)
  if (trailing?.type === "progress") onProgress(trailing)
  if (trailing?.type === "result") result = { status: trailing.status, ok: trailing.ok, body: trailing.body }

  return result ?? { status: 500, ok: false, body: { error: "Generation stream ended before returning a result." } }
}

function parseProgressLine(line: string): GenerationProgressStreamEvent | null {
  const text = line.trim()
  if (!text) return null
  try {
    const parsed = JSON.parse(text) as GenerationProgressStreamEvent
    if (parsed?.type === "progress" || parsed?.type === "result") return parsed
  } catch {
    return null
  }
  return null
}
