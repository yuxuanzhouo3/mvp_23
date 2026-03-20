"use client"

import { useState } from "react"
import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Sparkles, MessageSquare, LayoutTemplate } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { useLocale } from "@/lib/i18n"
import { getAccessiblePlanTiers, PLAN_CATALOG, type PlanTier } from "@/lib/plan-catalog"
import { getTemplateById } from "@/lib/template-catalog"

type GeneratePostResp = {
  projectId?: string
  jobId?: string
  status?: string
  prompt?: string
  error?: string
}

export function AiInputPanel() {
  const [value, setValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [statusText, setStatusText] = useState<string>("")
  const [planTier, setPlanTier] = useState<PlanTier>("free")
  const [selectedPlanTier, setSelectedPlanTier] = useState<PlanTier>("free")
  const [loadedTemplateId, setLoadedTemplateId] = useState("")
  const { t, locale } = useLocale()
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((json) => {
        const tier = json?.subscription?.tier
        if (tier && tier in PLAN_CATALOG) {
          setPlanTier(tier)
          setSelectedPlanTier(tier)
        }
      })
      .catch(() => {
        setPlanTier("free")
        setSelectedPlanTier("free")
      })
  }, [])

  useEffect(() => {
    const allowed = getAccessiblePlanTiers(planTier)
    if (!allowed.includes(selectedPlanTier)) {
      setSelectedPlanTier(planTier)
    }
  }, [planTier, selectedPlanTier])

  useEffect(() => {
    const templateId = String(searchParams.get("template") ?? "").trim()
    if (!templateId || templateId === loadedTemplateId) return
    const template = getTemplateById(templateId)
    if (!template) return
    const prompt = locale === "zh" ? template.promptZh : template.promptEn
    setValue(prompt)
    setLoadedTemplateId(templateId)
    setStatusText(
      locale === "zh"
        ? `已载入模板：${template.titleZh}。你可以直接生成，或先补充修改要求。`
        : `Template loaded: ${template.titleEn}. You can generate now or refine the prompt first.`
    )
  }, [loadedTemplateId, locale, searchParams])

  useEffect(() => {
    const promptFromUrl = String(searchParams.get("prompt") ?? "").trim()
    if (!promptFromUrl) return
    setValue(promptFromUrl)
    setStatusText(
      locale === "zh"
        ? "已载入示例 prompt。你可以直接生成，或先继续补充细节。"
        : "Example prompt loaded. You can generate now or refine it further first."
    )
  }, [locale, searchParams])

  async function handleGenerate() {
    const prompt = value.trim()
    if (!prompt) {
      setStatusText("请先输入你的需求（prompt）")
      return
    }

    try {
      setIsLoading(true)
      setStatusText("正在创建生成任务...")

      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 120_000)
      const postRes = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          generationPlanTier: selectedPlanTier,
          templateId: loadedTemplateId || undefined,
          templatePrompt:
            activeTemplate ? (locale === "zh" ? activeTemplate.promptZh : activeTemplate.promptEn) : undefined,
        }),
        signal: ctrl.signal,
      })
      clearTimeout(timer)

      if (!postRes.ok) {
        const txt = await postRes.text()
        throw new Error(`POST /api/generate 失败: ${txt}`)
      }

      const postData = (await postRes.json()) as GeneratePostResp
      const projectId = String(postData.projectId || "").trim()
      const jobId = String(postData.jobId || "").trim()
      if (!projectId || !jobId) {
        throw new Error("生成成功但未返回 projectId/jobId")
      }
      setStatusText("任务已创建，正在打开 AI 工作区...")
      router.push(`/apps/${projectId}?jobId=${encodeURIComponent(jobId)}`)
    } catch (e: any) {
      const msg = e?.name === "AbortError" ? "生成超时，请重试（模型响应较慢，已等待120秒）" : e?.message || "发生未知错误"
      setStatusText(msg)
    } finally {
      setIsLoading(false)
    }
  }

  const planDesc =
    locale === "zh" ? PLAN_CATALOG[selectedPlanTier].generationQualityCn : PLAN_CATALOG[selectedPlanTier].generationQualityEn
  const activeTemplate = getTemplateById(loadedTemplateId)
  const accessiblePlans = getAccessiblePlanTiers(planTier)

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-[hsl(var(--primary))]" />
        <span className="text-xs font-medium text-muted-foreground">{t("aiThinking")}</span>
        </div>
        <Badge variant="outline">
          {PLAN_CATALOG[planTier].nameCn} / {PLAN_CATALOG[planTier].nameEn}
        </Badge>
      </div>

      {activeTemplate ? (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-border bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
          <div className="flex items-center gap-2 min-w-0">
            <LayoutTemplate className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">
              {locale === "zh" ? `当前模板：${activeTemplate.titleZh}` : `Active template: ${activeTemplate.titleEn}`}
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => {
              setLoadedTemplateId("")
              setValue("")
              setStatusText(locale === "zh" ? "已清除模板基线。" : "Template baseline cleared.")
              router.replace("/")
            }}
          >
            {locale === "zh" ? "清除" : "Clear"}
          </Button>
        </div>
      ) : null}

      <div className="mb-3 flex flex-col gap-2 xl:flex-row xl:items-center">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{locale === "zh" ? "生成档位" : "Generation tier"}</span>
          <select
            value={selectedPlanTier}
            onChange={(e) => setSelectedPlanTier(e.target.value as PlanTier)}
            className="h-8 rounded-md border border-border bg-secondary px-2 text-xs text-foreground"
          >
            {accessiblePlans
              .slice()
              .reverse()
              .map((tier) => (
                <option key={tier} value={tier}>
                  {locale === "zh" ? PLAN_CATALOG[tier].nameCn : PLAN_CATALOG[tier].nameEn}
                </option>
              ))}
          </select>
          <span>
            {locale === "zh"
              ? `你当前最高可用：${PLAN_CATALOG[planTier].nameCn}`
              : `Highest available: ${PLAN_CATALOG[planTier].nameEn}`}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2 xl:flex-row">
        <Input
          placeholder={t("aiPlaceholder")}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-9 bg-secondary border-border text-sm text-foreground placeholder:text-muted-foreground"
        />

        <div className="flex gap-2 xl:shrink-0">
          <Button
            size="sm"
            className="h-9 flex-1 xl:flex-none bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90 shrink-0"
            onClick={handleGenerate}
            disabled={isLoading}
          >
            <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
            {isLoading ? "生成中..." : t("discussWithAI")}
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="h-9 text-foreground border-border shrink-0 hidden sm:flex bg-transparent"
          >
            {t("viewSuggestions")}
          </Button>
        </div>
      </div>

      <div className="mt-3 text-xs text-muted-foreground">
        {locale === "zh" ? `当前生成档位：${planDesc}` : `Current generation tier: ${planDesc}`}
      </div>
      {statusText ? <div className="mt-2 text-xs text-muted-foreground">{statusText}</div> : null}
    </section>
  )
}
