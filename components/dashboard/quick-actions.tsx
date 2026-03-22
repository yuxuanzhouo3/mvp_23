"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Rocket, Sparkles, Zap, BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { useLocale } from "@/lib/i18n"
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

export function QuickActions() {
  const [promptValue, setPromptValue] = useState("")
  const [generationPreferences, setGenerationPreferences] = useState<GenerationPreferences>({
    region: "intl",
    deploymentTarget: "vercel",
    databaseTarget: "supabase_postgres",
  })
  const [isLoading, setIsLoading] = useState(false)
  const [statusText, setStatusText] = useState("")
  const { t, locale } = useLocale()
  const router = useRouter()
  const editionLabel =
    generationPreferences.region === "cn"
      ? (locale === "zh" ? "国内版入口" : "China entry")
      : (locale === "zh" ? "国际版入口" : "International entry")

  useEffect(() => {
    setGenerationPreferences(loadGenerationPreferences(getCurrentDomainRegion()))
    return subscribeGenerationPreferences((next) => setGenerationPreferences(next))
  }, [])

  async function handleGenerate() {
    const prompt = promptValue.trim()
    if (!prompt) {
      setStatusText("请先输入需求")
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
          region: generationPreferences.region,
          deploymentTarget: generationPreferences.deploymentTarget,
          databaseTarget: generationPreferences.databaseTarget,
        }),
        signal: ctrl.signal,
      })
      clearTimeout(timer)

      if (!postRes.ok) {
        const txt = await postRes.text()
        throw new Error(`POST /api/generate 失败: ${txt}`)
      }

      const postData = (await postRes.json()) as { projectId?: string; jobId?: string }
      const projectId = String(postData.projectId || "").trim()
      const jobId = String(postData.jobId || "").trim()
      if (!projectId || !jobId) {
        throw new Error("生成成功但未返回 projectId/jobId")
      }

      setStatusText("任务已创建，正在打开项目...")
      router.push(`/apps/${projectId}?jobId=${encodeURIComponent(jobId)}`)
    } catch (e: any) {
      const msg = e?.name === "AbortError" ? "生成超时，请重试（模型响应较慢，已等待120秒）" : e?.message || "生成失败"
      setStatusText(msg)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section>
      <h3 className="text-sm font-semibold text-foreground mb-3">{t("quickActions")}</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="rounded-lg border border-border bg-card p-5 flex flex-col gap-3 hover:border-[hsl(var(--primary))]/40 transition-colors group">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[hsl(var(--primary))]/10">
              <Rocket className="h-4.5 w-4.5 text-[hsl(var(--primary))]" />
            </div>
            <div>
              <p className="text-sm font-medium text-card-foreground">{t("generateFromTemplate")}</p>
              <p className="text-xs text-muted-foreground">{t("generateFromTemplateDesc")}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" className="w-full mt-auto text-foreground border-border group-hover:border-[hsl(var(--primary))]/40 group-hover:text-[hsl(var(--primary))] bg-transparent" asChild>
            <Link href="/templates">{t("browseTemplates")}</Link>
          </Button>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 flex flex-col gap-3 hover:border-[hsl(var(--primary))]/40 transition-colors">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[hsl(var(--primary))]/10">
              <Sparkles className="h-4.5 w-4.5 text-[hsl(var(--primary))]" />
            </div>
            <div>
              <p className="text-sm font-medium text-card-foreground">{t("customGeneration")}</p>
              <p className="text-xs text-muted-foreground">{t("customGenerationDesc")} · {editionLabel}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 2xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
            <Input
              placeholder={t("generatePlaceholder")}
              value={promptValue}
              onChange={(e) => setPromptValue(e.target.value)}
              className="h-8 min-w-0 text-xs bg-secondary border-border text-foreground placeholder:text-muted-foreground md:col-span-2 2xl:col-span-1"
            />
            <select
              value={generationPreferences.deploymentTarget}
              onChange={(e) =>
                saveGenerationPreferences({
                  ...generationPreferences,
                  deploymentTarget: e.target.value as GenerationPreferences["deploymentTarget"],
                })
              }
              className="h-8 min-w-0 rounded-md border border-border bg-secondary px-2 text-xs text-foreground"
            >
              {DEPLOYMENT_OPTIONS.filter((item) => item.defaultRegions.length === 0 || item.defaultRegions.includes(generationPreferences.region)).map((item) => (
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
              className="h-8 min-w-0 rounded-md border border-border bg-secondary px-2 text-xs text-foreground"
            >
              {DATABASE_OPTIONS.filter((item) => item.defaultRegions.length === 0 || item.defaultRegions.includes(generationPreferences.region)).map((item) => (
                <option key={item.id} value={item.id}>
                  {locale === "zh" ? item.nameCn : item.nameEn}
                </option>
              ))}
            </select>

            <Button
              size="sm"
              className="h-8 w-full px-3 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90 md:col-span-2 2xl:col-span-1 2xl:w-auto"
              onClick={handleGenerate}
              disabled={isLoading}
            >
              {isLoading ? "生成中..." : t("generate")}
            </Button>
          </div>
          <div className="text-xs text-muted-foreground">
            {locale === "zh"
              ? `当前会根据访问域名自动使用${generationPreferences.region === "cn" ? "国内版" : "国际版"}生成链路。`
              : `This generation card now follows the ${generationPreferences.region === "cn" ? "China" : "international"} flow based on the current domain.`}
          </div>
          {statusText ? <div className="text-xs text-muted-foreground">{statusText}</div> : null}
        </div>

        <div className="rounded-lg border border-border bg-card p-5 flex flex-col gap-3 hover:border-[hsl(var(--primary))]/40 transition-colors">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[hsl(var(--warning))]/10">
              <Zap className="h-4.5 w-4.5 text-[hsl(var(--warning))]" />
            </div>
            <div>
              <p className="text-sm font-medium text-card-foreground">{t("deployments")}</p>
              <p className="text-xs text-muted-foreground">{t("deploymentsDesc")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-auto">
            <Badge className="bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] border-[hsl(var(--success))]/30 hover:bg-[hsl(var(--success))]/15 text-xs">2 {t("live")}</Badge>
            <Badge className="bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/30 hover:bg-[hsl(var(--warning))]/15 text-xs">1 {t("building")}</Badge>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-card p-5 flex flex-col gap-3 hover:border-[hsl(var(--primary))]/40 transition-colors">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[hsl(var(--chart-2))]/10">
              <BarChart3 className="h-4.5 w-4.5 text-[hsl(var(--chart-2))]" />
            </div>
            <div>
              <p className="text-sm font-medium text-card-foreground">{t("usageMetrics")}</p>
              <p className="text-xs text-muted-foreground">{t("usageMetricsDesc")}</p>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 mt-auto">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{t("monthlyLimit")}</span>
              <span className="text-card-foreground font-medium">85%</span>
            </div>
            <Progress value={85} className="h-1.5 bg-secondary [&>div]:bg-[hsl(var(--primary))]" />
          </div>
        </div>
      </div>
    </section>
  )
}
