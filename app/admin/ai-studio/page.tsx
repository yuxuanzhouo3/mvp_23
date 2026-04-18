import { headers } from "next/headers"
import { resolveAiProviderRoute } from '@/lib/admin/ai/provider-router'
import { resolveRequestRegion } from '@/lib/config/request-region'
import AiStudioClient from './ai-studio-client'

export const dynamic = "force-dynamic"
export const runtime = 'nodejs'

export default async function AiStudioPage() {
  const headerStore = await headers()
  const region = resolveRequestRegion(headerStore.get("host"))
  const route = resolveAiProviderRoute(region)

  return <AiStudioClient region={region} language={route.language} route={route} />
}
