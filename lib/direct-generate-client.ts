"use client"

import type { Locale } from "@/lib/i18n"
import {
  saveGenerationPreferences,
  type GenerationPreferences,
} from "@/lib/generation-preferences"
import type { PlanTier } from "@/lib/plan-catalog"
import type { GenerateRequestContext, GenerateWorkflowMode } from "@/lib/generate-tasks"

type GenerateApiResponse = {
  projectId?: string
  jobId?: string
  error?: string
}

export type DirectGenerateMessages = {
  emptyPrompt: string
  creating: string
  opening: string
  missingIds: string
  timeout: string
  failed: string
}

export type DirectGenerateExtras = {
  generationPlanTier?: PlanTier
  templateId?: string
  templatePrompt?: string
  workflowMode?: GenerateWorkflowMode
  workspaceContext?: GenerateRequestContext
}

type SubmitDirectGenerateOptions = {
  prompt: string
  locale: Locale
  preferences: GenerationPreferences
  extras?: DirectGenerateExtras
  timeoutMs?: number
  onStatus?: (status: string) => void
  messages?: Partial<DirectGenerateMessages>
}

export function getDirectGenerateMessages(locale: Locale): DirectGenerateMessages {
  const isZh = locale === "zh"
  return {
    emptyPrompt: isZh ? "请先输入你的需求。" : "Start with one sentence.",
    creating: isZh ? "正在创建生成任务..." : "Creating generation task...",
    opening: isZh ? "任务已创建，正在打开工作区..." : "Task created. Opening workspace...",
    missingIds: isZh ? "生成成功但未返回 projectId 或 jobId。" : "Project created without projectId or jobId.",
    timeout: isZh ? "生成超时，请重试（已等待 120 秒）。" : "Generation timed out after 120 seconds. Please try again.",
    failed: isZh ? "生成失败，请重试。" : "Generation failed. Please try again.",
  }
}

export async function submitDirectGenerate({
  prompt,
  locale,
  preferences,
  extras,
  timeoutMs = 120_000,
  onStatus,
  messages,
}: SubmitDirectGenerateOptions) {
  const text = prompt.trim()
  const copy = { ...getDirectGenerateMessages(locale), ...messages }

  if (!text) {
    throw new Error(copy.emptyPrompt)
  }

  saveGenerationPreferences(preferences)
  onStatus?.(copy.creating)

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: text,
        region: preferences.region,
        deploymentTarget: preferences.deploymentTarget,
        databaseTarget: preferences.databaseTarget,
        generationPlanTier: extras?.generationPlanTier,
        templateId: extras?.templateId,
        templatePrompt: extras?.templatePrompt,
        workflowMode: extras?.workflowMode,
        ...(extras?.workspaceContext ?? {}),
      }),
      signal: controller.signal,
    })

    const raw = await response.text()
    let json: GenerateApiResponse = {}

    if (raw) {
      try {
        json = JSON.parse(raw) as GenerateApiResponse
      } catch {
        json = {}
      }
    }

    if (!response.ok) {
      throw new Error(String(json.error ?? raw ?? copy.failed))
    }

    const projectId = String(json.projectId ?? "").trim()
    const jobId = String(json.jobId ?? "").trim()

    if (!projectId || !jobId) {
      throw new Error(copy.missingIds)
    }

    onStatus?.(copy.opening)
    return { projectId, jobId }
  } catch (error: any) {
    if (error?.name === "AbortError") {
      throw new Error(copy.timeout)
    }
    throw new Error(error?.message || copy.failed)
  } finally {
    window.clearTimeout(timer)
  }
}
