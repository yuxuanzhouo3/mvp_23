export type AiChatMessage = {
  role: "system" | "user" | "assistant"
  content: string
}

export type AiConfig = {
  apiKey: string
  baseUrl: string
  model: string
  enableThinking: boolean
}

export function resolveAiConfig(options?: {
  apiKey?: string
  baseUrl?: string
  model?: string
  enableThinking?: boolean
}): AiConfig {
  const envEnableThinking = String(process.env.DASHSCOPE_ENABLE_THINKING ?? "").toLowerCase() === "true"
  const genericEnableThinking = String(process.env.AI_ENABLE_THINKING ?? "").toLowerCase() === "true"
  const apiKey =
    String(options?.apiKey ?? "").trim() ||
    process.env.DASHSCOPE_API_KEY ||
    process.env.AI_API_KEY ||
    process.env.INTERNAL_AI_API_KEY ||
    process.env.OPENAI_API_KEY ||
    ""

  if (!apiKey) {
    throw new Error("Missing API key. Set AI_API_KEY, INTERNAL_AI_API_KEY, DASHSCOPE_API_KEY, or OPENAI_API_KEY.")
  }

  const baseUrl =
    String(options?.baseUrl ?? "").trim() ||
    process.env.DASHSCOPE_BASE_URL ||
    process.env.AI_BASE_URL ||
    process.env.INTERNAL_AI_BASE_URL ||
    process.env.OPENAI_BASE_URL ||
    "https://dashscope.aliyuncs.com/compatible-mode/v1"

  const model =
    String(options?.model ?? "").trim() ||
    process.env.DASHSCOPE_MODEL ||
    process.env.AI_MODEL ||
    process.env.INTERNAL_AI_MODEL ||
    process.env.OPENAI_MODEL ||
    "deepseek-v3.2"

  const enableThinking = options?.enableThinking ?? (genericEnableThinking || envEnableThinking)

  return { apiKey, baseUrl, model, enableThinking }
}

async function readStreamText(res: Response) {
  if (!res.body) {
    return { content: "", reasoning: "" }
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder("utf-8")
  let buffer = ""
  let content = ""
  let reasoning = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const events = buffer.split("\n\n")
    buffer = events.pop() ?? ""

    for (const evt of events) {
      const lines = evt
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("data:"))

      for (const line of lines) {
        const payload = line.slice(5).trim()
        if (!payload || payload === "[DONE]") continue

        let parsed: any
        try {
          parsed = JSON.parse(payload)
        } catch {
          continue
        }
        const delta = parsed?.choices?.[0]?.delta ?? {}
        if (typeof delta.reasoning_content === "string") reasoning += delta.reasoning_content
        if (typeof delta.content === "string") content += delta.content
      }
    }
  }

  return { content: content.trim(), reasoning: reasoning.trim() }
}

export async function requestJsonChatCompletion(args: {
  config: AiConfig
  messages: AiChatMessage[]
  temperature?: number
  timeoutMs?: number
}): Promise<{ content: string; reasoning: string }> {
  const { config, messages } = args
  const temperature = args.temperature ?? 0.2
  const timeoutMs = args.timeoutMs ?? 120_000
  const url = `${config.baseUrl.replace(/\/+$/, "")}/chat/completions`

  const payload: Record<string, unknown> = {
    model: config.model,
    temperature,
    stream: true,
    messages,
    response_format: { type: "json_object" },
  }

  if (config.enableThinking) {
    payload.extra_body = { enable_thinking: true }
  }

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(payload),
    signal: ctrl.signal,
  })
  clearTimeout(timer)

  if (!res.ok) {
    const txt = await res.text()
    throw new Error(`Model request failed (${res.status}): ${txt}`)
  }

  const streamed = await readStreamText(res)
  if (streamed.content) {
    return streamed
  }

  const fallbackPayload = { ...payload, stream: false }
  const fallbackRes = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`,
    },
    body: JSON.stringify(fallbackPayload),
  })

  if (!fallbackRes.ok) {
    const txt = await fallbackRes.text()
    throw new Error(`Model fallback request failed (${fallbackRes.status}): ${txt}`)
  }

  const json = await fallbackRes.json()
  const content = String(json?.choices?.[0]?.message?.content ?? "").trim()
  return { content, reasoning: streamed.reasoning }
}
