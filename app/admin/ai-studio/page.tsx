import { headers } from "next/headers"
import { resolveAiProviderRoute } from '@/lib/admin/ai/provider-router'
import { resolveRequestRegion } from '@/lib/config/request-region'
import AiStudioClient from './ai-studio-client'

export const runtime = 'nodejs'

export default function AiStudioPage() {
  const region = resolveRequestRegion(headers().get("host"))
  const route = resolveAiProviderRoute(region)

  return <AiStudioClient region={region} language={route.language} route={route} />
}
