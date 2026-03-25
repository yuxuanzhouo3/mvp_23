"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Blocks, BriefcaseBusiness, Database, Layers3, Sparkles, Users2, Workflow } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useLocale } from "@/lib/i18n"
import { getCurrentDomainRegion, loadGenerationPreferences, saveGenerationPreferences } from "@/lib/generation-preferences"
import { siteLinks } from "@/lib/site-links"
import {
  getDatabaseOption,
  getDefaultDatabaseTarget,
  getDefaultDeploymentTarget,
  getDeploymentOption,
  type DatabaseTarget,
  type DeploymentTarget,
} from "@/lib/fullstack-targets"

type GeneratePostResp = {
  projectId?: string
  jobId?: string
  error?: string
}

type RecentApp = {
  projectId: string
  updatedAt: string
  presentation: {
    displayName: string
    subtitle: string
    summary: string
    icon: {
      glyph: string
      from: string
      to: string
      ring: string
    }
  }
}

export default function DashboardPage() {
  const router = useRouter()
  const { locale } = useLocale()
  const isZh = locale === "zh"
  const [prompt, setPrompt] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [status, setStatus] = useState("")
  const [region, setRegion] = useState<"cn" | "intl">("intl")
  const [deploymentTarget, setDeploymentTarget] = useState<DeploymentTarget>("vercel")
  const [databaseTarget, setDatabaseTarget] = useState<DatabaseTarget>("supabase_postgres")
  const [recentApps, setRecentApps] = useState<RecentApp[]>([])

  useEffect(() => {
    const currentRegion = getCurrentDomainRegion()
    const prefs = loadGenerationPreferences(currentRegion)
    setRegion(prefs.region)
    setDeploymentTarget(prefs.deploymentTarget)
    setDatabaseTarget(prefs.databaseTarget)
  }, [])

  useEffect(() => {
    fetch("/api/projects")
      .then((res) => res.json())
      .then((json) => setRecentApps((json.projects ?? []).slice(0, 6)))
      .catch(() => setRecentApps([]))
  }, [])

  async function handleGenerate() {
    const text = prompt.trim()
    if (!text) {
      setStatus(isZh ? "先写一句你要做什么。" : "Start with one sentence.")
      return
    }

    const prefs = loadGenerationPreferences(region)
    const nextPrefs = { ...prefs, region, deploymentTarget, databaseTarget }
    saveGenerationPreferences(nextPrefs)

    try {
      setSubmitting(true)
      setStatus(isZh ? "正在创建项目..." : "Creating project...")

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text,
          region: nextPrefs.region,
          deploymentTarget: nextPrefs.deploymentTarget,
          databaseTarget: nextPrefs.databaseTarget,
        }),
      })

      const json = (await res.json().catch(() => ({}))) as GeneratePostResp
      if (!res.ok) {
        throw new Error(String(json?.error ?? "Generate failed"))
      }

      const projectId = String(json.projectId ?? "").trim()
      const jobId = String(json.jobId ?? "").trim()
      if (!projectId || !jobId) {
        throw new Error(isZh ? "生成成功但没有返回项目编号。" : "Project created without ids.")
      }

      setStatus(isZh ? "项目已创建，正在进入工作区..." : "Project created. Opening workspace...")
      router.push(`/apps/${projectId}?jobId=${encodeURIComponent(jobId)}`)
    } catch (error: any) {
      setStatus(error?.message || (isZh ? "创建失败，请重试。" : "Creation failed."))
    } finally {
      setSubmitting(false)
    }
  }

  const featureCards = isZh
    ? [
        {
          icon: Sparkles,
          title: "一句话生成产品雏形",
          description: "输入需求后，直接生成官网、后台、文档和交付入口，不再从空白页开始。",
        },
        {
          icon: Layers3,
          title: "国内外链路分开",
          description: "自动按入口区分国内版和国际版，部署、数据库和登录路径更清晰。",
        },
        {
          icon: Workflow,
          title: "从生成到交付一条线",
          description: "工作区、演示链接、管理后台和销售后台放在同一套产品流程里。",
        },
      ]
    : [
        {
          icon: Sparkles,
          title: "From prompt to first product",
          description: "Start with one sentence and get a working product shell instead of an empty repo.",
        },
        {
          icon: Layers3,
          title: "Clear CN and intl paths",
          description: "Region-specific hosting, database, and auth flows stay separated from the start.",
        },
        {
          icon: Workflow,
          title: "One flow from build to delivery",
          description: "Workspace, demo links, admin, and market stay connected in one product system.",
        },
      ]

  const audiences = isZh
    ? [
        { icon: BriefcaseBusiness, title: "老板演示", description: "快速讲清产品是什么、能做什么、准备交付到哪一步。" },
        { icon: Users2, title: "产品与运营", description: "用同一个入口看官网、后台、文档和销售闭环，不再来回切页面。" },
        { icon: Blocks, title: "技术交付", description: "把生成、迭代、预览和部署目标放到一个更容易接手的工作区里。" },
      ]
    : [
        { icon: BriefcaseBusiness, title: "Founder demos", description: "Show what the product is, what it can do, and how ready it is to ship." },
        { icon: Users2, title: "Product teams", description: "Website, back office, docs, and sales flow stay in one easy path." },
        { icon: Blocks, title: "Delivery teams", description: "Keep generation, iteration, preview, and deployment intent in one workspace." },
      ]

  const steps = isZh
    ? [
        "写一句你要做的产品",
        "系统生成工作区与关键页面",
        "继续迭代并拿去演示或交付",
      ]
    : [
        "Describe the product in one sentence",
        "Generate the workspace and core pages",
        "Iterate, demo, and hand off from the same flow",
      ]

  const templateHighlights = isZh
    ? [
        { title: "官网与下载站", summary: "首页、定价、下载与文档入口" },
        { title: "销售后台", summary: "客户、线索、成交与交付看板" },
        { title: "API 数据平台", summary: "接口、监控、趋势与告警" },
        { title: "社区反馈中心", summary: "反馈、工单、公告与知识库" },
      ]
    : [
        { title: "Website + downloads", summary: "Home, pricing, downloads, and docs" },
        { title: "Sales admin", summary: "Customers, pipeline, close, and delivery" },
        { title: "API platform", summary: "Endpoints, monitoring, trends, and alerts" },
        { title: "Community hub", summary: "Feedback, tickets, announcements, and docs" },
      ]

  const deploymentOptions =
    region === "cn"
      ? [
          {
            id: "cloudbase" as DeploymentTarget,
            nameCn: "腾讯云",
            nameEn: "Tencent Cloud",
            descriptionCn: "国内默认部署环境，适合云托管与中国区访问链路。",
            descriptionEn: "Default China deployment target for CloudBase hosting and mainland delivery paths.",
          },
          {
            id: "self_hosted" as DeploymentTarget,
            nameCn: "自托管",
            nameEn: "Self-hosted",
            descriptionCn: "适合私有化交付、企业内网或独立服务器部署。",
            descriptionEn: "Useful for private delivery, internal networks, or dedicated servers.",
          },
          {
            id: "render" as DeploymentTarget,
            nameCn: "Docker 环境",
            nameEn: "Docker hosting",
            descriptionCn: "适合需要容器化运行和稳定预发环境的场景。",
            descriptionEn: "Good for containerized deployments and stable staging environments.",
          },
        ]
      : [
          {
            id: "vercel" as DeploymentTarget,
            nameCn: "Vercel",
            nameEn: "Vercel",
            descriptionCn: "海外默认部署环境，适合 Next.js 直出与快速展示。",
            descriptionEn: "Default international deployment target for fast Next.js shipping.",
          },
          {
            id: "railway" as DeploymentTarget,
            nameCn: "Railway",
            nameEn: "Railway",
            descriptionCn: "适合快速部署全栈 Node 服务和独立数据库。",
            descriptionEn: "Useful for shipping full-stack Node services with managed databases.",
          },
          {
            id: "render" as DeploymentTarget,
            nameCn: "Render",
            nameEn: "Render",
            descriptionCn: "适合 Docker 化服务与稳定预发环境。",
            descriptionEn: "Useful for Dockerized services and stable staging environments.",
          },
        ]

  const databaseOptions =
    region === "cn"
      ? [
          {
            id: "cloudbase_document" as DatabaseTarget,
            nameCn: "云文档",
            nameEn: "Cloud Document",
            descriptionCn: "国内默认数据方案，适合云文档型数据与轻量业务模型。",
            descriptionEn: "Default China data path for document-style content and lightweight app data.",
          },
          {
            id: "mysql" as DatabaseTarget,
            nameCn: "MySQL",
            nameEn: "MySQL",
            descriptionCn: "适合传统业务表结构与现有 MySQL 体系接入。",
            descriptionEn: "Good for traditional business schemas and existing MySQL stacks.",
          },
          {
            id: "mongodb" as DatabaseTarget,
            nameCn: "MongoDB",
            nameEn: "MongoDB",
            descriptionCn: "适合更灵活的文档型结构和内容数据。",
            descriptionEn: "Good for flexible document structures and content-heavy models.",
          },
        ]
      : [
          {
            id: "supabase_postgres" as DatabaseTarget,
            nameCn: "Supabase",
            nameEn: "Supabase",
            descriptionCn: "适合国际版登录、权限和关系型业务数据。",
            descriptionEn: "Best for auth, permissions, and relational product data.",
          },
          {
            id: "mysql" as DatabaseTarget,
            nameCn: "MySQL",
            nameEn: "MySQL",
            descriptionCn: "适合传统业务表结构与现有 MySQL 体系接入。",
            descriptionEn: "Good for traditional business schemas and existing MySQL stacks.",
          },
          {
            id: "neon_postgres" as DatabaseTarget,
            nameCn: "Neon",
            nameEn: "Neon",
            descriptionCn: "适合 serverless Postgres 和预览环境分支库。",
            descriptionEn: "Useful for serverless Postgres and preview-branch databases.",
          },
        ]
  const activeDeployment = getDeploymentOption(deploymentTarget)
  const activeDatabase = getDatabaseOption(databaseTarget)
  const currentPathSummary = isZh
    ? `当前路径：${region === "cn" ? "国内" : "海外"} · ${
        region === "cn" && deploymentTarget === "cloudbase"
          ? "腾讯云"
          : activeDeployment.nameCn
      } · ${region === "cn" && databaseTarget === "cloudbase_document" ? "云文档" : activeDatabase.nameCn}`
    : `Current path: ${region === "cn" ? "China" : "Global"} · ${
        region === "cn" && deploymentTarget === "cloudbase" ? "Tencent Cloud" : activeDeployment.nameEn
      } · ${region === "cn" && databaseTarget === "cloudbase_document" ? "Cloud Document" : activeDatabase.nameEn}`

  function applyRegionDefaults(nextRegion: "cn" | "intl") {
    const nextDeployment = getDefaultDeploymentTarget(nextRegion)
    const nextDatabase = getDefaultDatabaseTarget(nextRegion)
    setRegion(nextRegion)
    setDeploymentTarget(nextDeployment)
    setDatabaseTarget(nextDatabase)
    saveGenerationPreferences({
      region: nextRegion,
      deploymentTarget: nextDeployment,
      databaseTarget: nextDatabase,
    })
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-background text-foreground">
      <section className="relative isolate flex min-h-[calc(100vh-4rem)] items-center overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.14),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.95)_0%,rgba(245,249,255,0.98)_100%)] dark:bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.18),transparent_24%),radial-gradient(circle_at_80%_18%,rgba(99,102,241,0.18),transparent_18%),linear-gradient(180deg,#05070b_0%,#07101a_50%,#05070b_100%)]" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-background" />

        <div className="relative mx-auto flex w-full max-w-7xl flex-col px-6 py-14 md:px-8 md:py-20">
          <div className="mx-auto flex max-w-4xl flex-1 flex-col items-center justify-center text-center">
            <div className="inline-flex items-center rounded-full border border-primary/15 bg-primary/8 px-4 py-1 text-xs font-medium tracking-[0.18em] text-primary uppercase">
              {isZh ? "AI 全栈生成平台" : "AI full-stack builder"}
            </div>
            <h1 className="mt-8 max-w-4xl bg-[linear-gradient(180deg,hsl(var(--foreground))_0%,rgba(75,85,140,0.96)_100%)] bg-clip-text text-5xl font-semibold tracking-[-0.06em] text-transparent dark:bg-none dark:text-foreground md:text-7xl">
              {isZh ? "一句话生成全栈应用" : "Build a full-stack app from one prompt"}
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-8 text-muted-foreground md:text-lg">
              {isZh
                ? "从官网、后台到文档和交付入口，先给你一个能看懂、能继续改、能拿去演示的产品工作区。"
                : "From site to back office to docs and delivery, generate a product workspace that is clear, editable, and demo-ready."}
            </p>

            <div className="mx-auto mt-10 w-full max-w-3xl rounded-[32px] border border-border/80 bg-card/88 p-4 shadow-[0_24px_80px_rgba(15,23,42,0.12)] backdrop-blur dark:border-white/10 dark:bg-white/[0.04] dark:shadow-[0_28px_90px_rgba(0,0,0,0.38)]">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
                <Input
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !submitting) {
                      void handleGenerate()
                    }
                  }}
                  placeholder={
                    isZh
                      ? "比如：生成一个中国版 AI 代码平台，包含官网、编辑器、运行面板和销售后台"
                      : "For example: build an AI code platform with site, editor, runtime panel, and sales back office"
                  }
                  className="h-14 rounded-2xl border-border/80 bg-background/90 px-5 text-base shadow-none placeholder:text-muted-foreground dark:border-white/10 dark:bg-white/[0.03]"
                />
                <Button
                  size="lg"
                  onClick={handleGenerate}
                  disabled={submitting}
                  className="h-14 rounded-2xl bg-primary px-7 text-base font-semibold text-primary-foreground shadow-[0_18px_40px_rgba(79,124,255,0.22)] hover:bg-primary/90"
                >
                  {submitting ? (isZh ? "创建中..." : "Creating...") : isZh ? "开始生成" : "Generate"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-3 text-left text-sm text-muted-foreground">
                {status ||
                  (isZh
                    ? currentPathSummary
                    : currentPathSummary)}
              </p>

              <div className="mt-4 rounded-[24px] border border-border/70 bg-background/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div className="text-left">
                    <div className="inline-flex items-center gap-2 text-sm font-medium text-foreground">
                      <Database className="h-4 w-4 text-primary" />
                      {isZh ? "部署与数据配置" : "Deployment and data setup"}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {isZh ? "选择版本入口、部署环境与数据方案，当前路径会实时同步。" : "Pick the edition, deployment environment, and data path for this generation."}
                    </p>
                  </div>
                  <div className="rounded-full border border-primary/15 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                    {currentPathSummary}
                  </div>
                </div>

                <div className="mt-5 space-y-4 text-left">
                  <div>
                    <div className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      {isZh ? "版本入口" : "Edition"}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { key: "cn" as const, label: isZh ? "国内版" : "China" },
                        { key: "intl" as const, label: isZh ? "海外版" : "Global" },
                      ].map((item) => {
                        const active = region === item.key
                        return (
                          <button
                            key={item.key}
                            type="button"
                            onClick={() => applyRegionDefaults(item.key)}
                            className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                              active
                                ? "border-primary/25 bg-primary text-primary-foreground"
                                : "border-border/80 bg-card text-foreground hover:border-primary/25 hover:bg-primary/5 dark:border-white/10 dark:bg-white/[0.03]"
                            }`}
                          >
                            {item.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      {isZh ? "部署环境" : "Deployment"}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {deploymentOptions.map((item) => {
                        const active = deploymentTarget === item.id
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => {
                              setDeploymentTarget(item.id)
                              saveGenerationPreferences({
                                region,
                                deploymentTarget: item.id,
                                databaseTarget,
                              })
                            }}
                            className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                              active
                                ? "border-primary/25 bg-primary text-primary-foreground"
                                : "border-border/80 bg-card text-foreground hover:border-primary/25 hover:bg-primary/5 dark:border-white/10 dark:bg-white/[0.03]"
                            }`}
                          >
                            {isZh && item.id === "cloudbase" ? "腾讯云" : isZh ? item.nameCn : item.nameEn}
                          </button>
                        )
                      })}
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      {isZh && deploymentTarget === "cloudbase"
                        ? "国内默认部署环境，适合云托管与中国区访问链路。"
                        : isZh
                          ? deploymentOptions.find((item) => item.id === deploymentTarget)?.descriptionCn
                          : deploymentOptions.find((item) => item.id === deploymentTarget)?.descriptionEn}
                    </p>
                  </div>

                  <div>
                    <div className="mb-2 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                      {isZh ? "数据 / 文档方案" : "Data / document path"}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {databaseOptions.map((item) => {
                    const active = databaseTarget === item.id
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setDatabaseTarget(item.id)
                          saveGenerationPreferences({
                            ...loadGenerationPreferences(region),
                            region,
                            databaseTarget: item.id,
                          })
                        }}
                        className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                          active
                            ? "border-primary/25 bg-primary text-primary-foreground"
                            : "border-border/80 bg-card text-foreground hover:border-primary/25 hover:bg-primary/5 dark:border-white/10 dark:bg-white/[0.03]"
                        }`}
                      >
                        {isZh && item.id === "cloudbase_document" ? "云文档" : isZh ? item.nameCn : item.nameEn}
                      </button>
                    )
                  })}
                    </div>

                    <p className="mt-3 text-sm text-muted-foreground">
                      {isZh && databaseTarget === "cloudbase_document"
                        ? "国内默认数据方案，适合云文档型数据与轻量业务模型。"
                        : isZh
                          ? databaseOptions.find((item) => item.id === databaseTarget)?.descriptionCn
                          : databaseOptions.find((item) => item.id === databaseTarget)?.descriptionEn}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mx-auto mt-6 grid max-w-3xl gap-3 text-left sm:grid-cols-3">
              {(isZh
                ? ["官网与交付入口", "工作区与关键页面", "国内外部署默认分流"]
                : ["Site and delivery entry", "Workspace and key pages", "Region-aware deployment defaults"]
              ).map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-border/70 bg-card/70 px-4 py-3 text-sm text-muted-foreground dark:border-white/10 dark:bg-white/[0.03]"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-4 md:px-8">
        <div className="rounded-[28px] border border-border/70 bg-card/82 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/[0.03]">
          <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
            <div>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-foreground">{isZh ? "Recent apps" : "Recent apps"}</div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {recentApps.length
                      ? isZh
                        ? "优先展示你最近真正生成过的应用。"
                        : "Your recently generated apps appear here first."
                      : isZh
                        ? "还没有生成记录时，这里会在你创建应用后自动出现。"
                        : "This fills up automatically after you generate apps."}
                  </p>
                </div>
                {recentApps.length ? (
                  <Button variant="ghost" size="sm" asChild>
                    <a href="/projects">{isZh ? "查看全部" : "View all"}</a>
                  </Button>
                ) : null}
              </div>

              {recentApps.length ? (
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {recentApps.slice(0, 4).map((app) => (
                    <a
                      key={app.projectId}
                      href={`/apps/${app.projectId}`}
                      className="rounded-[22px] border border-border/70 bg-background/75 p-4 transition-colors hover:border-primary/30 dark:border-white/10 dark:bg-white/[0.03]"
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-base font-semibold text-white"
                          style={{ background: `linear-gradient(135deg, ${app.presentation.icon.from}, ${app.presentation.icon.to})`, boxShadow: `0 0 0 1px ${app.presentation.icon.ring}` }}
                        >
                          {app.presentation.icon.glyph}
                        </div>
                        <div className="min-w-0">
                          <div className="truncate text-base font-semibold text-foreground">{app.presentation.displayName}</div>
                          <div className="mt-1 text-sm text-muted-foreground">{app.presentation.subtitle}</div>
                        </div>
                      </div>
                      <p className="mt-4 line-clamp-2 text-sm leading-6 text-muted-foreground">{app.presentation.summary}</p>
                      <div className="mt-4 text-xs text-muted-foreground">
                        {isZh ? "最近更新" : "Updated"} · {new Date(app.updatedAt).toLocaleString()}
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="mt-5 rounded-[22px] border border-dashed border-border/80 bg-background/60 p-6 text-sm text-muted-foreground dark:border-white/10 dark:bg-white/[0.02]">
                  {isZh ? "先生成一个应用，这里就会开始显示你的 Recent apps。" : "Generate your first app and this area will turn into Recent apps."}
                </div>
              )}
            </div>

            <div>
              <div className="text-sm font-semibold text-foreground">{isZh ? "Templates" : "Templates"}</div>
              <p className="mt-1 text-sm text-muted-foreground">
                {isZh ? "继续保留模板入口，但已使用用户会优先看到 recent apps。" : "Templates stay available, but recent apps lead for returning users."}
              </p>
              <div className="mt-5 grid gap-3">
                {templateHighlights.map((item) => (
                  <a
                    key={item.title}
                    href="/templates"
                    className="rounded-[22px] border border-border/70 bg-background/75 p-4 transition-colors hover:border-primary/30 dark:border-white/10 dark:bg-white/[0.03]"
                  >
                    <div className="text-base font-semibold text-foreground">{item.title}</div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.summary}</p>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-8 md:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {featureCards.map((item) => {
            const Icon = item.icon
            return (
              <article
                key={item.title}
                className="rounded-[24px] border border-border/70 bg-card/85 p-6 shadow-[0_18px_50px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                <h2 className="mt-5 text-xl font-semibold text-foreground">{item.title}</h2>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.description}</p>
              </article>
            )
          })}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10 md:px-8">
        <div className="max-w-2xl">
          <div className="text-sm uppercase tracking-[0.18em] text-primary/80">{isZh ? "适用对象" : "Who it is for"}</div>
          <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-foreground md:text-4xl">
            {isZh ? "第一次打开，就知道它解决什么问题" : "Make the product value obvious on first view"}
          </h2>
        </div>
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {audiences.map((item) => {
            const Icon = item.icon
            return (
              <article key={item.title} className="rounded-[24px] border border-border/70 bg-card p-6 dark:border-white/10 dark:bg-white/[0.03]">
                <Icon className="h-5 w-5 text-primary" />
                <h3 className="mt-4 text-xl font-semibold text-foreground">{item.title}</h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.description}</p>
              </article>
            )
          })}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-10 md:px-8">
        <div className="rounded-[28px] border border-border/70 bg-card p-8 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(10,15,22,0.92),rgba(7,10,15,0.96))]">
          <div className="max-w-2xl">
            <div className="text-sm uppercase tracking-[0.18em] text-primary/80">{isZh ? "使用流程" : "How it works"}</div>
            <h2 className="mt-4 text-3xl font-semibold tracking-[-0.03em] text-foreground md:text-4xl">
              {isZh ? "三步开始，不堆概念" : "Three simple steps, not a wall of features"}
            </h2>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {steps.map((step, index) => (
              <div key={step} className="rounded-[22px] border border-border/70 bg-background/70 p-5 dark:border-white/10 dark:bg-white/[0.03]">
                <div className="text-sm font-medium text-primary">{`0${index + 1}`}</div>
                <p className="mt-4 text-base leading-7 text-foreground">{step}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20 pt-8 md:px-8">
        <div className="rounded-[30px] border border-primary/15 bg-[linear-gradient(180deg,rgba(79,124,255,0.08)_0%,rgba(255,255,255,0.8)_100%)] p-8 text-center shadow-[0_24px_70px_rgba(15,23,42,0.08)] dark:bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.14),transparent_34%),linear-gradient(180deg,#0b1119_0%,#070b11_100%)] dark:shadow-[0_28px_90px_rgba(5,10,19,0.42)]">
          <h2 className="text-3xl font-semibold tracking-[-0.03em] text-foreground md:text-4xl">
            {isZh ? "先做出一个能讲清楚价值的版本" : "Start with a version that is easy to explain"}
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-8 text-muted-foreground md:text-base">
            {isZh
              ? "先让官网、后台、文档和交付入口形成一条清晰主线，再继续往真实运行和更深的业务细节迭代。"
              : "Get a clean first version across site, back office, docs, and delivery first, then keep iterating into deeper product detail."}
          </p>
          <div className="mt-8">
            <Button asChild size="lg" className="h-12 rounded-2xl bg-primary px-7 text-primary-foreground hover:bg-primary/90">
              <a href={siteLinks.bossDemo}>{isZh ? "查看演示入口" : "Open demo"}</a>
            </Button>
          </div>
        </div>
      </section>
    </main>
  )
}
