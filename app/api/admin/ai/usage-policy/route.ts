import { NextRequest, NextResponse } from "next/server"
import { requireAdminSession } from "@/lib/admin/session"
import { getDatabaseAdapter } from "@/lib/admin/database"
import type { AiUsagePolicy } from "@/lib/admin/types"
import { getDefaultAiUsagePolicy, sanitizeAiUsagePolicy } from "@/lib/admin/ai/usage-policy"

export const runtime = "nodejs"

const CONFIG_KEY = "ai_studio_usage_policy"

async function loadPolicy() {
  const adapter = getDatabaseAdapter()
  const stored = await adapter.getConfig(CONFIG_KEY)
  return sanitizeAiUsagePolicy(stored, { allowEmpty: true })
}

async function loadUsageSnapshot(adminId: string, freeTrialUses: number) {
  const adapter = getDatabaseAdapter()
  const jobs = await adapter.listAiGenerationJobs({ created_by: adminId, limit: 1000, offset: 0 })
  const completedJobs = jobs.filter((job) => job.status === "completed")
  const usedGenerations = completedJobs.length

  return {
    adminId,
    usedGenerations,
    remainingFreeUses: Math.max(freeTrialUses - usedGenerations, 0),
    trialExhausted: usedGenerations >= freeTrialUses,
  }
}

export async function GET() {
  try {
    const session = await requireAdminSession()
    const policy = await loadPolicy()
    const usage = await loadUsageSnapshot(session.adminId, policy.free_trial_uses)

    return NextResponse.json({
      success: true,
      policy,
      usage,
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Failed to load AI usage policy" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requireAdminSession()
    const adapter = getDatabaseAdapter()
    const body = (await request.json()) as Partial<AiUsagePolicy>
    const policy = sanitizeAiUsagePolicy(body)
    const usage = await loadUsageSnapshot(session.adminId, policy.free_trial_uses)

    await adapter.setConfig(CONFIG_KEY, policy, "ai", "AI 生成功能额度与免费试用配置")

    return NextResponse.json({
      success: true,
      policy,
      usage,
    })
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || "Failed to update AI usage policy" }, { status: 500 })
  }
}
