"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowRight, Clapperboard, ExternalLink, FileText, Globe2, Layers3, Presentation, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LATEST_PROMO_BUNDLE_STORAGE_KEY, type StoredPromoBundle } from "@/lib/promo-bundle-client"

type PromoLatestPageProps = {
  mode: "preview" | "video" | "ppt"
}

function EmptyState() {
  return (
    <div className="grid gap-6">
      <section className="overflow-hidden rounded-[32px] border border-border/70 bg-[radial-gradient(circle_at_top,_rgba(178,150,105,0.12),_transparent_28%),linear-gradient(180deg,#fffdf9_0%,#fbf8f2_52%,#f5f1ea_100%)] p-6 md:p-8 shadow-[0_18px_60px_rgba(98,82,57,0.07)]">
        <div className="max-w-3xl">
          <Badge variant="outline">Latest Promo</Badge>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground md:text-6xl">最新宣传页暂时还没有内容</h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
            当前浏览器里还没有保存最新宣传文件夹。先到 `/admin` 生成一次宣传文件夹，随后再打开这里，就能直接查看网页版总览、视频分镜页和 PPT 演示页。
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/admin">
                前往 Admin 生成
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/demo">查看演示入口</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}

export function PromoLatestPage({ mode }: PromoLatestPageProps) {
  const [data, setData] = useState<StoredPromoBundle | null>(null)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(LATEST_PROMO_BUNDLE_STORAGE_KEY)
      if (!raw) return
      setData(JSON.parse(raw) as StoredPromoBundle)
    } catch {
      setData(null)
    }
  }, [])

  if (!data) {
    return <EmptyState />
  }

  const { bundle, input, generator, generatedAt } = data

  const heroTitle =
    mode === "preview"
      ? bundle.campaignTitle
      : mode === "video"
        ? bundle.videoScript.title
        : bundle.pptDeck.title

  const heroBody =
    mode === "preview"
      ? bundle.launchNarrative
      : mode === "video"
        ? "这一页用于直接浏览视频分镜、镜头提示和旁白结构，适合快速走查对外内容。"
        : "这一页用于直接浏览演示 deck 的叙事结构、每页目标和展示重点，便于讲解和设计交接。"

  return (
    <div className="grid gap-6">
      <section className="overflow-hidden rounded-[32px] border border-border/70 bg-[radial-gradient(circle_at_top,_rgba(178,150,105,0.12),_transparent_28%),linear-gradient(180deg,#fffdf9_0%,#fbf8f2_52%,#f5f1ea_100%)] p-6 md:p-8 shadow-[0_18px_60px_rgba(98,82,57,0.07)]">
        <div className="grid gap-8 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="max-w-3xl">
            <Badge variant="outline">
              {mode === "preview" ? "Preview" : mode === "video" ? "Video Storyboard" : "PPT Copy"}
            </Badge>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground md:text-6xl">{heroTitle}</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">{heroBody}</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild className="shadow-[0_16px_36px_rgba(58,48,35,0.12)]">
                <Link href="/admin">
                  重新生成最新宣传包
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/demo">查看演示总览</Link>
              </Button>
              <Button variant="outline" asChild>
                <a href={input.websiteUrl} target="_blank" rel="noreferrer">
                  打开官网
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>

          <div className="rounded-[2rem] border border-stone-200/80 bg-[radial-gradient(circle_at_top,_rgba(255,251,241,0.98),_rgba(250,246,237,0.98)_42%,_rgba(243,238,229,0.99)_100%)] p-6 text-stone-800 shadow-[0_24px_70px_rgba(94,80,58,0.10)]">
            <div className="flex items-center gap-2 text-sm text-stone-700/75">
              <Sparkles className="h-4 w-4" />
              本次生成信息
            </div>
            <div className="mt-5 grid gap-3 text-sm">
              <div className="rounded-2xl border border-stone-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(249,246,239,0.78))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_8px_22px_rgba(104,88,63,0.06)]">
                <div className="font-medium text-stone-900">产品</div>
                <div className="mt-1 text-stone-700">{input.productName}</div>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(249,246,239,0.78))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_8px_22px_rgba(104,88,63,0.06)]">
                <div className="font-medium text-stone-900">生成来源</div>
                <div className="mt-1 uppercase tracking-[0.18em] text-stone-700">{generator}</div>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(249,246,239,0.78))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_8px_22px_rgba(104,88,63,0.06)]">
                <div className="font-medium text-stone-900">生成时间</div>
                <div className="mt-1 text-stone-700">{new Date(generatedAt).toLocaleString("zh-CN")}</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe2 className="h-5 w-5" />
              宣传叙事摘要
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="rounded-2xl border border-border p-4">
              <div className="text-sm font-medium text-foreground">Brand Line</div>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">{bundle.brandLine}</p>
            </div>
            <div className="rounded-2xl border border-border p-4">
              <div className="text-sm font-medium text-foreground">Visual Direction</div>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">{bundle.visualDirection}</p>
            </div>
            <div className="rounded-2xl border border-border p-4">
              <div className="text-sm font-medium text-foreground">Audience</div>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">{input.audience}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers3 className="h-5 w-5" />
              最新宣传页入口
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {[
              { label: "总览页", href: "/generated/promo-assets/latest/index.html", icon: FileText, note: "查看宣传文件夹摘要、视频结构和 deck 结构。" },
              { label: "视频分镜页", href: "/generated/promo-assets/latest/promo-video-storyboard.html", icon: Clapperboard, note: "逐段浏览镜头、节奏、旁白和视觉提示。" },
              { label: "PPT 演示页", href: "/generated/promo-assets/latest/promo-ppt-copy.html", icon: Presentation, note: "逐页浏览讲解逻辑、视觉 cue 和 presenter note。" },
            ].map((item) => {
              const Icon = item.icon
              return (
                <Link key={item.href} href={item.href} className="rounded-2xl border border-border p-4 transition hover:bg-secondary/40">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="rounded-xl bg-secondary p-2">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="font-medium text-foreground">{item.label}</div>
                        <div className="mt-1 text-sm text-muted-foreground">{item.note}</div>
                        <div className="mt-2 text-xs text-muted-foreground break-all">{item.href}</div>
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              )
            })}
          </CardContent>
        </Card>
      </div>

      {mode !== "ppt" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clapperboard className="h-5 w-5" />
              视频分镜
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {bundle.videoScript.scenes.map((scene, index) => (
              <div key={`${scene.title}-${index}`} className="rounded-2xl border border-border p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="font-medium text-foreground">
                    {index + 1}. {scene.title}
                  </div>
                  <Badge variant="outline">{scene.durationSec}s</Badge>
                </div>
                <p className="text-sm text-muted-foreground">Visual cue: {scene.visualCue}</p>
                <p className="mt-2 text-sm text-muted-foreground">Visual: {scene.visual}</p>
                <p className="mt-2 text-sm leading-7 text-foreground">Voiceover: {scene.voiceover}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {mode !== "video" ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Presentation className="h-5 w-5" />
              PPT 讲解结构
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {bundle.pptDeck.slides.map((slide, index) => (
              <div key={`${slide.slideTitle}-${index}`} className="rounded-2xl border border-border p-4">
                <div className="font-medium text-foreground">
                  {index + 1}. {slide.slideTitle}
                </div>
                <p className="mt-2 text-sm text-muted-foreground">Slide goal: {slide.slideGoal}</p>
                <p className="mt-2 text-sm text-muted-foreground">Visual cue: {slide.visualCue}</p>
                <div className="mt-3 grid gap-2">
                  {slide.bullets.map((bullet, bulletIndex) => (
                    <div key={`${slide.slideTitle}-bullet-${bulletIndex}`} className="rounded-xl border border-border/70 bg-secondary/20 px-3 py-2 text-sm text-foreground">
                      {bullet}
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{slide.presenterNote}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
