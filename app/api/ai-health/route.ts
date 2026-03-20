import { NextResponse } from "next/server"
import { requestJsonChatCompletion, resolveAiConfig } from "@/lib/ai-provider"

export const runtime = "nodejs"

export async function GET() {
  try {
    const config = resolveAiConfig()
    const result = await requestJsonChatCompletion({
      config,
      messages: [
        { role: "system", content: "Return strict JSON only: {\"ok\":true,\"message\":\"...\"}" },
        { role: "user", content: "health check" },
      ],
      temperature: 0,
      timeoutMs: 60_000,
    })

    return NextResponse.json({
      ok: true,
      model: config.model,
      baseUrl: config.baseUrl,
      enableThinking: config.enableThinking,
      responsePreview: result.content.slice(0, 200),
    })
  } catch (error: any) {
    const message = error?.message || String(error)
    let errorType = "Unknown"
    let requestId: string | undefined

    if (/Arrearage/i.test(message)) errorType = "Arrearage"
    else if (/Access denied/i.test(message)) errorType = "AccessDenied"
    else if (/Missing API key/i.test(message)) errorType = "MissingApiKey"

    const idMatch = message.match(/request_id['\"]?\s*[:=]\s*['\"]([^'\"]+)['\"]/i)
    if (idMatch?.[1]) requestId = idMatch[1]

    return NextResponse.json(
      {
        ok: false,
        errorType,
        requestId,
        error: message,
      },
      { status: 500 }
    )
  }
}
