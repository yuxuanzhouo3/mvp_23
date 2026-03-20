"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Rocket, Sparkles, Zap, BarChart3 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { useLocale } from "@/lib/i18n"

export function QuickActions() {
  const [promptValue, setPromptValue] = useState("")
  const { t } = useLocale()
  const router = useRouter()

  return (
    <section>
      <h3 className="text-sm font-semibold text-foreground mb-3">
        {t("quickActions")}
      </h3>
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
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-auto text-foreground border-border group-hover:border-[hsl(var(--primary))]/40 group-hover:text-[hsl(var(--primary))] bg-transparent"
            asChild
          >
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
              <p className="text-xs text-muted-foreground">{t("customGenerationDesc")}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Input
              placeholder={t("generatePlaceholder")}
              value={promptValue}
              onChange={(e) => setPromptValue(e.target.value)}
              className="h-8 text-xs bg-secondary border-border text-foreground placeholder:text-muted-foreground"
            />
            <Button
              size="sm"
              className="h-8 px-3 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90 shrink-0"
              onClick={() => router.push("/apps/kanban-ai")}
            >
              {t("generate")}
            </Button>
          </div>
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
            <Badge className="bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] border-[hsl(var(--success))]/30 hover:bg-[hsl(var(--success))]/15 text-xs">
              2 {t("live")}
            </Badge>
            <Badge className="bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/30 hover:bg-[hsl(var(--warning))]/15 text-xs">
              1 {t("building")}
            </Badge>
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
