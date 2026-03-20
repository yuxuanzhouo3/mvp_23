"use client"

import { useMemo, useState } from "react"
import { ChevronDown, LayoutTemplate, Search, Sparkles } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/lib/i18n"
import {
  TEMPLATE_CATALOG,
  TEMPLATE_CATEGORY_LABELS,
  type TemplateCategory,
  type TemplateItem,
  type TemplateLanguage,
} from "@/lib/template-catalog"

function formatUsage(value: number) {
  return new Intl.NumberFormat("en-US").format(value)
}

function TemplatePreview({ style }: { style: TemplateItem["previewStyle"] }) {
  if (style === "dark-dashboard") {
    return (
      <div className="h-full w-full rounded-[1.4rem] bg-[#0e1017] p-4 text-white">
        <div className="flex items-center justify-between text-[10px] text-white/60">
          <span>TaskFlow</span>
          <span>Dashboard</span>
        </div>
        <div className="mt-4 h-3 w-40 rounded bg-white/90" />
        <div className="mt-2 h-2 w-56 rounded bg-cyan-400/60" />
        <div className="mt-5 grid grid-cols-4 gap-2">
          {["#0ea5e9", "#22c55e", "#f59e0b", "#a855f7"].map((color) => (
            <div key={color} className="rounded-xl border border-white/10 p-2" style={{ background: `${color}20` }}>
              <div className="h-2 w-10 rounded" style={{ background: color }} />
              <div className="mt-3 h-5 w-6 rounded bg-white/90" />
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-[1.2fr_0.8fr] gap-3">
          <div className="rounded-2xl border border-cyan-400/20 bg-slate-900/80 p-3">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="mb-2 rounded-xl border border-white/5 bg-white/5 p-2">
                <div className="h-2.5 w-24 rounded bg-white/90" />
                <div className="mt-2 h-2 w-full rounded bg-white/10" />
              </div>
            ))}
          </div>
          <div className="space-y-3">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="h-3 w-24 rounded bg-white/90" />
              <div className="mt-4 h-24 rounded-full bg-[conic-gradient(#60a5fa,#8b5cf6,#22c55e,#60a5fa)] opacity-85" />
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <div className="h-3 w-24 rounded bg-white/90" />
              <div className="mt-3 space-y-2">
                <div className="h-2 w-2/3 rounded bg-blue-400" />
                <div className="h-2 w-1/2 rounded bg-violet-400" />
                <div className="h-2 w-4/5 rounded bg-cyan-400" />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (style === "spa-landing") {
    return (
      <div className="relative h-full w-full overflow-hidden rounded-[1.4rem] bg-[linear-gradient(135deg,#3f342b_0%,#9f8978_45%,#f5ede2_100%)] p-5 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.1),transparent_58%)]" />
        <div className="relative">
          <div className="flex items-center justify-between text-[10px] text-white/70">
            <span>SERENITY</span>
            <span>Book Appointment</span>
          </div>
          <div className="mt-8 max-w-[70%] text-3xl font-medium leading-tight">
            #1 Luxury Spa & Salon
          </div>
          <div className="mt-4 h-2 w-40 rounded bg-white/75" />
          <div className="mt-8 flex gap-3">
            <div className="rounded-full bg-rose-400 px-4 py-2 text-xs font-medium text-white">Book now</div>
            <div className="rounded-full border border-white/30 px-4 py-2 text-xs">Call us</div>
          </div>
        </div>
      </div>
    )
  }

  if (style === "light-admin") {
    return (
      <div className="h-full w-full rounded-[1.4rem] bg-[#f9fbff] p-4 text-slate-900">
        <div className="flex items-center justify-between text-[10px] text-slate-500">
          <span>Dashboard</span>
          <span>Search</span>
        </div>
        <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm">
          <div className="h-3 w-36 rounded bg-slate-900" />
          <div className="mt-3 flex gap-2">
            <div className="rounded-full bg-blue-600 px-3 py-1 text-[10px] text-white">View Boards</div>
            <div className="rounded-full border border-slate-200 px-3 py-1 text-[10px]">Analytics</div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-4 gap-2">
          {["#2563eb", "#22c55e", "#f59e0b", "#a855f7"].map((color) => (
            <div key={color} className="rounded-xl p-3 text-white" style={{ background: color }}>
              <div className="h-2 w-8 rounded bg-white/80" />
              <div className="mt-4 h-5 w-5 rounded bg-white/90" />
            </div>
          ))}
        </div>
        <div className="mt-4 grid grid-cols-[1.2fr_0.7fr] gap-3">
          <div className="rounded-2xl bg-white p-3 shadow-sm">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="mb-2 rounded-xl border border-slate-100 p-2">
                <div className="h-2.5 w-24 rounded bg-slate-900" />
                <div className="mt-2 h-2 w-20 rounded bg-slate-200" />
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {["#a855f7", "#3b82f6", "#22c55e", "#f97316"].map((color) => (
              <div key={color} className="rounded-xl p-3 text-white" style={{ background: color }}>
                <div className="h-2 w-12 rounded bg-white/80" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (style === "cosmic-app") {
    return (
      <div className="h-full w-full rounded-[1.4rem] bg-[radial-gradient(circle_at_center,#1e293b_0%,#020617_70%)] p-5 text-white">
        <div className="text-[10px] text-white/60">Orbital</div>
        <div className="mt-10 text-4xl font-semibold leading-tight">Connect your world with AI</div>
        <div className="mt-4 h-2 w-1/2 rounded bg-violet-400/80" />
        <div className="mt-10 flex justify-center">
          <div className="h-36 w-36 rounded-full bg-[radial-gradient(circle,#60a5fa_0%,#4338ca_35%,transparent_70%)] shadow-[0_0_50px_rgba(99,102,241,0.4)]" />
        </div>
      </div>
    )
  }

  if (style === "purple-builder") {
    return (
      <div className="h-full w-full rounded-[1.4rem] bg-[linear-gradient(180deg,#4c1d95_0%,#6d28d9_42%,#7c3aed_100%)] p-5 text-white">
        <div className="text-3xl font-semibold">Create Amazing Websites with AI</div>
        <div className="mt-3 h-2 w-2/3 rounded bg-white/75" />
        <div className="mt-8 rounded-3xl bg-white/10 p-4 backdrop-blur">
          <div className="h-3 w-36 rounded bg-white/90" />
          <div className="mt-4 grid gap-3">
            <div className="h-11 rounded-xl bg-white/15" />
            <div className="h-11 rounded-xl bg-white/15" />
            <div className="h-11 rounded-xl bg-white/15" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full rounded-[1.4rem] bg-[#0f172a] p-5 text-white">
      <div className="flex items-center justify-between text-[10px] text-white/60">
        <span>LaunchPad</span>
        <span>Start free</span>
      </div>
      <div className="mt-10 text-5xl font-semibold leading-tight">Turn your skill into a product</div>
      <div className="mt-4 h-2 w-2/3 rounded bg-cyan-400/75" />
      <div className="mt-10 flex gap-3">
        <div className="rounded-full bg-indigo-500 px-4 py-2 text-xs">Start now</div>
        <div className="rounded-full border border-white/25 px-4 py-2 text-xs">See demo</div>
      </div>
    </div>
  )
}

export default function TemplatesPage() {
  const { locale } = useLocale()
  const [query, setQuery] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<TemplateCategory>("all")
  const [language, setLanguage] = useState<"all" | TemplateLanguage>("all")
  const [templateType, setTemplateType] = useState("all")
  const isCn = locale === "zh"

  const filtered = useMemo(() => {
    return TEMPLATE_CATALOG.filter((template) => {
      const text = `${template.titleZh} ${template.titleEn} ${template.subtitleZh} ${template.subtitleEn}`.toLowerCase()
      const matchesQuery = !query.trim() || text.includes(query.trim().toLowerCase())
      const matchesCategory = selectedCategory === "all" || template.categories.includes(selectedCategory)
      const matchesLanguage = language === "all" || template.language === language || template.language === "mixed"
      return matchesQuery && matchesCategory && matchesLanguage && templateType === "all"
    })
  }, [language, query, selectedCategory, templateType])

  const title = isCn ? "应用模板" : "App Templates"
  const subtitle = isCn ? "探索我们社区精心挑选的应用合集。" : "Explore a curated collection of high-quality app templates."

  return (
    <div className="space-y-8">
      <section className="rounded-[2rem] bg-[linear-gradient(180deg,#fafaf8_0%,#ffffff_100%)] p-6 shadow-sm md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-3 py-1 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" />
              {isCn ? "Base44 风格模板广场" : "Base44-style template gallery"}
            </div>
            <h1 className="mt-5 text-5xl font-semibold tracking-tight text-foreground md:text-7xl">{title}</h1>
            <p className="mt-5 max-w-3xl text-lg text-muted-foreground">{subtitle}</p>
          </div>
          <Button asChild className="hidden md:inline-flex">
            <Link href="/checkout?plan=builder">
              {isCn ? "升级获取更多模板" : "Upgrade for more templates"}
            </Link>
          </Button>
        </div>

        <div className="mt-10 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div className="relative w-full xl:max-w-xl">
            <Search className="pointer-events-none absolute left-6 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={isCn ? "搜索应用" : "Search templates"}
              className="h-14 w-full rounded-full border border-border bg-white pl-14 pr-5 text-base outline-none transition focus:border-foreground/20"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setLanguage(language === "zh" ? "en" : "zh")}
              className="inline-flex h-12 items-center gap-3 rounded-2xl border border-border bg-white px-5 text-sm text-foreground"
            >
              <span>{language === "zh" ? "中文" : language === "en" ? "英语" : isCn ? "英语" : "English"}</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
            <button
              type="button"
              onClick={() => setTemplateType(templateType === "all" ? "featured" : "all")}
              className="inline-flex h-12 items-center gap-3 rounded-2xl border border-border bg-white px-5 text-sm text-foreground"
            >
              <span>{templateType === "all" ? (isCn ? "所有模板" : "All templates") : isCn ? "精选模板" : "Featured"}</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-8">
          <div className="flex flex-wrap gap-3">
            {Object.entries(TEMPLATE_CATEGORY_LABELS).map(([key, label]) => {
              const active = selectedCategory === key
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedCategory(key as TemplateCategory)}
                  className={`rounded-full px-4 py-2 text-sm transition ${
                    active ? "bg-slate-800 text-white" : "border border-border bg-white text-foreground"
                  }`}
                >
                  {isCn ? label.zh : label.en}
                </button>
              )
            })}
          </div>
        </div>
      </section>

      <section className="grid gap-8 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((template) => (
          <article key={template.id} className="group">
            <div className="aspect-[1.45/1] overflow-hidden rounded-[1.8rem] border border-border bg-white shadow-[0_18px_60px_rgba(15,23,42,0.08)] transition duration-300 group-hover:-translate-y-1 group-hover:shadow-[0_26px_80px_rgba(15,23,42,0.12)]">
              <TemplatePreview style={template.previewStyle} />
            </div>
            <div className="mt-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-2xl font-semibold text-foreground">{isCn ? template.titleZh : template.titleEn}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{isCn ? template.subtitleZh : template.subtitleEn}</p>
                <div className="mt-3 text-sm text-muted-foreground">
                  {isCn ? template.authorZh : template.authorEn}
                  <span className="mx-2">•</span>
                  <span>{formatUsage(template.usageCount)}</span>
                </div>
              </div>
              <div className="shrink-0 text-right text-3xl font-medium text-foreground">{template.priceLabel}</div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {template.categories.slice(0, 3).map((category) => (
              <span key={category} className="rounded-full border border-border bg-white px-3 py-1 text-sm text-muted-foreground">
                  {isCn ? TEMPLATE_CATEGORY_LABELS[category].zh : TEMPLATE_CATEGORY_LABELS[category].en}
                </span>
              ))}
            </div>

            <div className="mt-4 rounded-2xl border border-border bg-secondary/20 p-3">
              <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {isCn ? "预期页面" : "Expected pages"}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(isCn ? template.expectedPagesZh : template.expectedPagesEn).map((page) => (
                  <span key={page} className="rounded-full bg-white px-3 py-1 text-xs text-foreground shadow-sm">
                    {page}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-4 flex gap-3">
              <Button asChild className="rounded-full">
                <Link href={`/?template=${template.id}`}>{isCn ? "使用模板" : "Use template"}</Link>
              </Button>
              <Button variant="outline" asChild className="rounded-full">
                <Link href={`/checkout?plan=builder`}>{isCn ? "查看套餐" : "View plans"}</Link>
              </Button>
            </div>
          </article>
        ))}
      </section>

      <section className="rounded-[2rem] border border-dashed border-border bg-white p-6 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary">
          <LayoutTemplate className="h-6 w-6 text-foreground" />
        </div>
        <h2 className="mt-4 text-2xl font-semibold text-foreground">{isCn ? "还要继续扩模板库" : "Keep expanding the library"}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
          {isCn
            ? "下一步我会继续补更多行业模板，并把每个模板的预期页面结构、组件模块和生成档位写得更清楚。"
            : "Next, we can keep adding more vertical templates and attach clearer page/module expectations to each one."}
        </p>
      </section>
    </div>
  )
}
