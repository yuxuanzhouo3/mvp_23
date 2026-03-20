"use client"

import Link from "next/link"
import { ArrowUpRight, BookOpen, ExternalLink } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/lib/i18n"

export default function ExamplesPage() {
  const { t, locale } = useLocale()
  const isZh = locale === "zh"
  const examples = [
    {
      name: isZh ? "Morncursor AI 代码编辑器" : "Morncursor AI Code Editor",
      category: isZh ? "核心验收" : "Core acceptance",
      target: isZh ? "先测中国版 Cursor 质感和 IDE 主壳" : "Test the China-ready Cursor feel and IDE shell first",
      prompt: t("exMorncursorPrompt"),
    },
    {
      name: isZh ? "销售线索与成交后台" : "Sales Pipeline Workspace",
      category: isZh ? "商用后台" : "Commercial admin",
      target: isZh ? "测后台流程、升级支付和角色结构" : "Validate admin flow, billing upgrade, and role structure",
      prompt: t("exKanbanPrompt"),
    },
    {
      name: isZh ? "官网与下载转化站点" : "Marketing Site and Downloads",
      category: isZh ? "官网转化" : "Marketing funnel",
      target: isZh ? "测首页、下载、文档、注册路径" : "Validate homepage, downloads, docs, and signup paths",
      prompt: t("exWebsitePrompt"),
    },
    {
      name: isZh ? "API 数据与文档平台" : "API Analytics Platform",
      category: isZh ? "数据平台" : "Data platform",
      target: isZh ? "测多页面数据产品与文档结构" : "Validate multi-page data product and docs depth",
      prompt: t("exApiPrompt"),
    },
    {
      name: isZh ? "社区内容与反馈中心" : "Community and Feedback Hub",
      category: isZh ? "社区产品" : "Community product",
      target: isZh ? "测内容流、互动、反馈和公告中心" : "Validate content feeds, engagement, feedback, and announcements",
      prompt: t("exCommunityPrompt"),
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t("examples")}</h1>
        <p className="text-muted-foreground mt-1">{t("examplesDesc")}</p>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        {examples.map((ex) => (
          <Card key={ex.name} className="overflow-hidden border-border/80 bg-card/95 transition-colors hover:border-primary/50">
            <CardContent className="pt-6">
              {(() => {
                const href = `/?prompt=${encodeURIComponent(ex.prompt)}`
                return (
                  <>
              <div className="flex items-center justify-between gap-4">
                <div className="rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                  {ex.category}
                </div>
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="mt-4 text-lg font-semibold text-foreground">{ex.name}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{ex.target}</p>
                  <div className="mt-4 rounded-2xl border border-border bg-secondary/35 p-4 text-sm leading-7 text-muted-foreground">
                    &ldquo;{ex.prompt}&rdquo;
                  </div>
                </div>
                <Button variant="ghost" size="icon" asChild>
                  <Link href={href}>
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <Button variant="outline" size="sm" className="mt-4 w-full" asChild>
                <Link href={href}>
                <BookOpen className="h-4 w-4 mr-2" />
                {t("tryExample")}
                </Link>
              </Button>
                  </>
                )
              })()}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
