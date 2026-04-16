"use client"

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Sparkles, MessageSquare, LayoutTemplate, Wand2, MessagesSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { submitDirectGenerate } from "@/lib/direct-generate-client"
import { useLocale } from "@/lib/i18n"
import { getAccessiblePlanTiers, PLAN_CATALOG, type PlanTier } from "@/lib/plan-catalog"
import type { GenerateWorkflowMode } from "@/lib/generate-tasks"
import { getTemplateById } from "@/lib/template-catalog"
import {
  DATABASE_OPTIONS,
  DEPLOYMENT_OPTIONS,
} from "@/lib/fullstack-targets"
import {
  getCurrentDomainRegion,
  loadGenerationPreferences,
  saveGenerationPreferences,
  subscribeGenerationPreferences,
  type GenerationPreferences,
} from "@/lib/generation-preferences"

export function AiInputPanel() {
  const { t, locale } = useLocale()
  const [value, setValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [statusText, setStatusText] = useState<string>("")
  const [planTier, setPlanTier] = useState<PlanTier>("free")
  const [selectedPlanTier, setSelectedPlanTier] = useState<PlanTier>("free")
  const [workflowMode, setWorkflowMode] = useState<GenerateWorkflowMode>("act")
  const [loadedTemplateId, setLoadedTemplateId] = useState("")
  const [generationPreferences, setGenerationPreferences] = useState<GenerationPreferences>({
    region: "intl",
    deploymentTarget: "vercel",
    databaseTarget: "supabase_postgres",
  })
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    fetch("/api/auth/runtime-session")
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
    setGenerationPreferences(loadGenerationPreferences(getCurrentDomainRegion()))
    return subscribeGenerationPreferences((next) => setGenerationPreferences(next))
  }, [])

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
    try {
      setIsLoading(true)
      const result = await submitDirectGenerate({
        prompt: value,
        locale,
        preferences: generationPreferences,
        extras: {
          generationPlanTier: selectedPlanTier,
          templateId: loadedTemplateId || undefined,
          templatePrompt: activeTemplate ? (locale === "zh" ? activeTemplate.promptZh : activeTemplate.promptEn) : undefined,
          workflowMode,
        },
        onStatus: setStatusText,
        messages: {
          emptyPrompt: locale === "zh" ? "请先输入你的需求（prompt）" : "Enter your prompt first.",
          opening: locale === "zh" ? "任务已创建，正在打开 AI 工作区..." : "Task created. Opening AI workspace...",
          failed: locale === "zh" ? "发生未知错误" : "Something went wrong.",
        },
      })

      router.push(`/apps/${result.projectId}?jobId=${encodeURIComponent(result.jobId)}`)
    } catch (e: any) {
      setStatusText(e?.message || (locale === "zh" ? "发生未知错误" : "Something went wrong."))
    } finally {
      setIsLoading(false)
    }
  }

  const planDesc =
    locale === "zh" ? PLAN_CATALOG[selectedPlanTier].generationQualityCn : PLAN_CATALOG[selectedPlanTier].generationQualityEn
  const activeTemplate = getTemplateById(loadedTemplateId)
  const accessiblePlans = getAccessiblePlanTiers(planTier)
  const deploymentOptions = DEPLOYMENT_OPTIONS.filter((item) => item.defaultRegions.length === 0 || item.defaultRegions.includes(generationPreferences.region))
  const databaseOptions = DATABASE_OPTIONS.filter((item) => item.defaultRegions.length === 0 || item.defaultRegions.includes(generationPreferences.region))
  const editionLabel =
    generationPreferences.region === "cn"
      ? (locale === "zh" ? "国内版入口" : "China entry")
      : (locale === "zh" ? "国际版入口" : "International entry")
  const workflowHint =
    workflowMode === "act"
      ? locale === "zh"
        ? "Act：直接生成完整应用骨架并进入工作台。"
        : "Act: generate the app skeleton directly and open the workspace."
      : locale === "zh"
        ? "Discuss：先产出 plan/spec，再决定是否进入代码生成。"
        : "Discuss: produce the plan/spec first before committing to code generation."

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

      <div className="mb-3 flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {([
            {
              key: "act" as const,
              label: locale === "zh" ? "Act" : "Act",
              icon: Wand2,
            },
            {
              key: "discuss" as const,
              label: locale === "zh" ? "Discuss" : "Discuss",
              icon: MessagesSquare,
            },
          ] satisfies Array<{ key: GenerateWorkflowMode; label: string; icon: typeof Wand2 }>).map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setWorkflowMode(item.key)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition ${
                  workflowMode === item.key
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-secondary/40 text-muted-foreground hover:border-foreground/30 hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </button>
            )
          })}
          <span className="text-xs text-muted-foreground">{workflowHint}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
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
          <Badge variant="secondary">{editionLabel}</Badge>
        </div>
        <div className="grid gap-2 md:grid-cols-2">
          <select
            value={generationPreferences.deploymentTarget}
            onChange={(e) =>
              saveGenerationPreferences({
                ...generationPreferences,
                deploymentTarget: e.target.value as GenerationPreferences["deploymentTarget"],
              })
            }
            className="h-9 rounded-md border border-border bg-secondary px-3 text-xs text-foreground"
          >
            {deploymentOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {locale === "zh" ? item.nameCn : item.nameEn}
              </option>
            ))}
          </select>
          <select
            value={generationPreferences.databaseTarget}
            onChange={(e) =>
              saveGenerationPreferences({
                ...generationPreferences,
                databaseTarget: e.target.value as GenerationPreferences["databaseTarget"],
              })
            }
            className="h-9 rounded-md border border-border bg-secondary px-3 text-xs text-foreground"
          >
            {databaseOptions.map((item) => (
              <option key={item.id} value={item.id}>
                {locale === "zh" ? item.nameCn : item.nameEn}
              </option>
            ))}
          </select>
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
            {isLoading
              ? locale === "zh"
                ? "生成中..."
                : "Working..."
              : workflowMode === "discuss"
                ? locale === "zh"
                  ? "先输出 Plan / Spec"
                  : "Plan / Spec first"
                : t("discussWithAI")}
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
      <div className="mt-2 text-xs text-muted-foreground">
        {locale === "zh"
          ? `当前会根据访问链接自动锁定为${generationPreferences.region === "cn" ? "国内版" : "国际版"}，这里只保留部署环境与数据库切换。`
          : `The active link now locks this workspace to the ${generationPreferences.region === "cn" ? "China" : "international"} edition, while deployment and database targets remain selectable.`}
      </div>
      {statusText ? <div className="mt-2 text-xs text-muted-foreground">{statusText}</div> : null}
    </section>
  )
}
