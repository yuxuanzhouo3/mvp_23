"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ArrowUpRight, CheckCircle2, Sparkles } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { PLAN_CATALOG, PAID_PLAN_IDS, type PlanTier } from "@/lib/plan-catalog"
import { useLocale } from "@/lib/i18n"

type SessionResponse = {
  subscription?: {
    tier?: PlanTier
  }
}

export function PlanCapabilityPanel() {
  const { locale } = useLocale()
  const [currentTier, setCurrentTier] = useState<PlanTier>("free")

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((json: SessionResponse) => {
        const tier = json?.subscription?.tier
        if (tier && tier in PLAN_CATALOG) {
          setCurrentTier(tier)
        }
      })
      .catch(() => setCurrentTier("free"))
  }, [])

  const isCn = locale === "zh"
  const currentPlan = PLAN_CATALOG[currentTier]
  const comparison = useMemo(() => ["free", ...PAID_PLAN_IDS].map((id) => PLAN_CATALOG[id]), [])

  return (
    <Card className="border-border/80">
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4" />
            {isCn ? "生成能力与套餐差异" : "Generation Capability by Plan"}
          </CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            {isCn
              ? "免费版也能生成像样的首版；更高套餐主要提升模块深度、页面数量、分析能力和持续迭代质量。"
              : "The free tier still generates a polished first version; higher tiers mainly add depth, page count, analytics, and stronger continuous iteration."}
          </p>
        </div>
        <Badge variant="outline">
          {isCn ? `当前：${currentPlan.nameCn}` : `Current: ${currentPlan.nameEn}`}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="rounded-2xl border border-border bg-secondary/30 p-4">
          <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {isCn ? "当前生成档位" : "Current generation tier"}
          </div>
          <div className="mt-2 text-xl font-semibold text-foreground">
            {isCn ? currentPlan.nameCn : currentPlan.nameEn}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {isCn ? currentPlan.generationQualityCn : currentPlan.generationQualityEn}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {(isCn ? currentPlan.deliverablesCn : currentPlan.deliverablesEn).map((item) => (
              <span key={item} className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground">
                {item}
              </span>
            ))}
          </div>
        </div>

        <div className="grid gap-4 xl:grid-cols-5">
          {comparison.map((plan) => {
            const isCurrent = plan.id === currentTier
            return (
              <div
                key={plan.id}
                className={`rounded-2xl border p-4 transition ${
                  isCurrent ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-card"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-lg font-semibold text-foreground">
                      {isCn ? plan.nameCn : plan.nameEn}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {isCn ? plan.summaryCn : plan.summaryEn}
                    </p>
                  </div>
                  {isCurrent ? (
                    <Badge>
                      <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                      {isCn ? "当前" : "Current"}
                    </Badge>
                  ) : null}
                </div>

                <div className="mt-4 text-2xl font-semibold text-foreground">
                  {isCn ? plan.monthlyPriceCn : plan.monthlyPriceEn}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">{isCn ? "/月" : "/mo"}</span>
                </div>

                {plan.badgeCn || plan.badgeEn ? (
                  <div className="mt-2 inline-flex rounded-full bg-orange-500/15 px-2.5 py-1 text-xs font-medium text-orange-600">
                    {isCn ? plan.badgeCn : plan.badgeEn}
                  </div>
                ) : null}

                <p className="mt-4 text-sm leading-6 text-muted-foreground">
                  {isCn ? plan.generationQualityCn : plan.generationQualityEn}
                </p>

                <div className="mt-4 space-y-2">
                  {(isCn ? plan.deliverablesCn : plan.deliverablesEn).map((item) => (
                    <div key={item} className="flex items-center gap-2 text-sm text-foreground">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        <div className="flex justify-end">
          <Button asChild>
            <Link href="/checkout?source=plan-panel&plan=pro">
              {isCn ? "查看升级方案" : "View upgrade plans"}
              <ArrowUpRight className="ml-1.5 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
