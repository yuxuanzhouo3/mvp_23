"use client"

import Link from "next/link"
import { useState } from "react"
import { Clapperboard, Copy, ExternalLink, FileText, Globe2, Link2, QrCode, Smartphone, WandSparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { LATEST_PROMO_BUNDLE_STORAGE_KEY, type PromoBundleData, type StoredPromoBundle } from "@/lib/promo-bundle-client"
import { siteLinks } from "@/lib/site-links"

type PromoVideoResponse = {
  status: string
  appName: string
  websiteUrl: string
  audience: string
  highlights: string[]
  totalDurationSec: number
  output: {
    aspectRatio: string
    format: string
    resolution: string
    status: string
  }
  scenes: Array<{
    title: string
    durationSec: number
    visual: string
    voiceover: string
  }>
}

type PromoBundleResponse = {
  status: string
  generator: string
  folderPath: string
  files: string[]
  publicUrls?: {
    preview?: string
    readme?: string
    videoScript?: string
    videoStoryboard?: string
    pptDeck?: string
    pptCopy?: string
    bundleJson?: string
    briefJson?: string
    latestPreview?: string
    latestVideoStoryboard?: string
    latestPptCopy?: string
  }
  bundle: PromoBundleData
}

const defaultHighlights = [
  "Prompt -> full-stack app generation",
  "Template-driven visual consistency",
  "Live preview and iterative editing",
  "Website + docs + mobile delivery surfaces",
]

export default function AdminPage() {
  const [appName, setAppName] = useState("mornstack")
  const [websiteUrl, setWebsiteUrl] = useState(siteLinks.websiteIntl)
  const [audience, setAudience] = useState("Product teams, founders, developers, and digital operators")
  const [highlights, setHighlights] = useState(defaultHighlights.join("\n"))
  const [references, setReferences] = useState("可补充品牌语气、产品定位、已有页面模块、行业案例、参考产品或希望突出展示的能力。")
  const [result, setResult] = useState<PromoVideoResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [statusText, setStatusText] = useState("")
  const [bundleResult, setBundleResult] = useState<PromoBundleResponse | null>(null)

  async function handleGeneratePromo() {
    try {
      setLoading(true)
      setStatusText("正在生成宣传视频脚本...")
      const res = await fetch("/api/admin/promo-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appName,
          websiteUrl,
          audience,
          highlights: highlights.split("\n").map((item) => item.trim()).filter(Boolean),
          references,
        }),
      })
      const json = (await res.json()) as PromoVideoResponse
      if (!res.ok) {
        throw new Error("宣传视频生成失败")
      }
      setResult(json)
      setStatusText("宣传视频分镜脚本已生成，可直接用于演示或交给剪辑/视频生成服务。")
    } catch (error: any) {
      setStatusText(error?.message || "宣传视频生成失败")
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerateBundle() {
    try {
      setLoading(true)
      setStatusText("正在生成宣传文件夹...")
      const res = await fetch("/api/admin/promo-bundle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: appName,
          websiteUrl,
          audience,
          highlights: highlights.split("\n").map((item) => item.trim()).filter(Boolean),
          references,
        }),
      })
      const json = (await res.json()) as PromoBundleResponse
      if (!res.ok) {
        throw new Error("宣传文件夹生成失败")
      }
      setBundleResult(json)
      const latestPromoBundle: StoredPromoBundle = {
        generatedAt: new Date().toISOString(),
        generator: json.generator,
        input: {
          productName: appName,
          websiteUrl,
          audience,
          highlights: highlights.split("\n").map((item) => item.trim()).filter(Boolean),
          references,
        },
        bundle: json.bundle,
      }
      window.localStorage.setItem(LATEST_PROMO_BUNDLE_STORAGE_KEY, JSON.stringify(latestPromoBundle))
      setStatusText(`宣传文件夹已生成：${json.folderPath}`)
    } catch (error: any) {
      setStatusText(error?.message || "宣传文件夹生成失败")
    } finally {
      setLoading(false)
    }
  }

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text)
    setStatusText("已复制到剪贴板")
  }

  const assetLinks = [
    { label: "国际官网", value: siteLinks.websiteIntl, icon: Globe2 },
    { label: "国内官网", value: siteLinks.websiteCn, icon: Globe2 },
    { label: "文档中心", value: siteLinks.docs, icon: FileText },
    { label: "Android APK", value: siteLinks.androidApk, icon: Smartphone },
    { label: "iOS App Store", value: siteLinks.iosDownload, icon: Smartphone },
    { label: "iOS TestFlight", value: siteLinks.iosTestFlight, icon: QrCode },
  ]

  return (
    <div className="grid gap-6">
      <section className="rounded-3xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <Badge variant="outline">/admin</Badge>
            <h1 className="mt-3 text-3xl font-semibold">运营与内容资产中心</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              这里集中管理官网链接、文档入口、移动端下载和宣传内容生成，用于快速整理产品介绍与对外展示素材。
            </p>
          </div>
          <div className="grid gap-2 text-sm text-muted-foreground">
            <div>官网聚合页：{siteLinks.marketCenter}</div>
            <div>后台控制台：{siteLinks.adminConsole}</div>
            <div>API Base：{siteLinks.apiBase}</div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <WandSparkles className="h-5 w-5" />
              AI 生成宣传内容
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Input value={appName} onChange={(e) => setAppName(e.target.value)} placeholder="产品名" />
            <Input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="官网 URL" />
            <Input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="目标受众" />
            <textarea
              value={highlights}
              onChange={(e) => setHighlights(e.target.value)}
              className="min-h-36 rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="每行一个核心卖点"
            />
            <textarea
              value={references}
              onChange={(e) => setReferences(e.target.value)}
              className="min-h-28 rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="补充参考：品牌语气、参考产品、已有页面模块、行业关键词、希望重点呈现的场景"
            />
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleGeneratePromo} disabled={loading}>
                <Clapperboard className="mr-2 h-4 w-4" />
                {loading ? "生成中..." : "生成宣传视频脚本"}
              </Button>
              <Button variant="secondary" onClick={handleGenerateBundle} disabled={loading}>
                <FileText className="mr-2 h-4 w-4" />
                生成宣传文件夹
              </Button>
              <Button variant="outline" onClick={() => copyText(siteLinks.marketCenter)}>
                <Copy className="mr-2 h-4 w-4" />
                复制市场页 URL
              </Button>
            </div>
            {statusText ? <p className="text-sm text-muted-foreground">{statusText}</p> : null}
            <p className="text-xs text-muted-foreground">
              生成结果会同步到当前浏览器的 latest 宣传页，可直接打开网页查看总览、视频分镜页和 PPT 演示页。
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>对外展示资产</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {assetLinks.map((item) => {
              const Icon = item.icon
              return (
                <div key={item.label} className="rounded-2xl border border-border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="rounded-xl bg-secondary p-2">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium">{item.label}</div>
                        <div className="truncate text-sm text-muted-foreground">{item.value}</div>
                      </div>
                    </div>
                    <a href={item.value} target="_blank" rel="noreferrer">
                      <Button variant="outline" size="sm">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </a>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      {result ? (
        <Card>
          <CardHeader>
            <CardTitle>宣传视频分镜结果</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="secondary">{result.output.status}</Badge>
              <Badge variant="outline">{result.output.aspectRatio}</Badge>
              <Badge variant="outline">{result.output.resolution}</Badge>
              <Badge variant="outline">{result.totalDurationSec}s</Badge>
            </div>
            <div className="grid gap-3">
              {result.scenes.map((scene, index) => (
                <div key={scene.title} className="rounded-2xl border border-border p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="font-medium">
                      {index + 1}. {scene.title}
                    </div>
                    <Badge variant="outline">{scene.durationSec}s</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">画面：{scene.visual}</p>
                  <p className="mt-2 text-sm">旁白：{scene.voiceover}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {bundleResult ? (
        <Card>
          <CardHeader>
            <CardTitle>宣传文件夹产物</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="rounded-2xl border border-border p-4">
              <div className="text-sm font-medium">文件夹路径</div>
              <div className="mt-1 break-all text-sm text-muted-foreground">{bundleResult.folderPath}</div>
              <div className="mt-3 text-sm text-muted-foreground">Brand line: {bundleResult.bundle.brandLine}</div>
              {bundleResult.bundle.campaignTitle ? (
                <div className="mt-2 text-sm text-muted-foreground">Campaign: {bundleResult.bundle.campaignTitle}</div>
              ) : null}
              {bundleResult.bundle.visualDirection ? (
                <div className="mt-2 text-sm text-muted-foreground">Visual direction: {bundleResult.bundle.visualDirection}</div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="secondary">{bundleResult.generator}</Badge>
                {bundleResult.files.map((file) => (
                  <Badge key={file} variant="outline">
                    {file}
                  </Badge>
                ))}
              </div>
            </div>
            {bundleResult.publicUrls ? (
              <div className="grid gap-3 rounded-2xl border border-border p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Link2 className="h-4 w-4" />
                  可直接点击的公开预览
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {[
                    { label: "固定 latest 预览", href: bundleResult.publicUrls.latestPreview },
                    { label: "固定 latest 视频页", href: bundleResult.publicUrls.latestVideoStoryboard },
                    { label: "固定 latest PPT 页", href: bundleResult.publicUrls.latestPptCopy },
                    { label: "老板预览页", href: bundleResult.publicUrls.preview },
                    { label: "视频分镜页", href: bundleResult.publicUrls.videoStoryboard },
                    { label: "PPT 成品页", href: bundleResult.publicUrls.pptCopy },
                    { label: "README", href: bundleResult.publicUrls.readme },
                    { label: "视频脚本", href: bundleResult.publicUrls.videoScript },
                    { label: "PPT 提纲", href: bundleResult.publicUrls.pptDeck },
                    { label: "Bundle JSON", href: bundleResult.publicUrls.bundleJson },
                    { label: "Brief JSON", href: bundleResult.publicUrls.briefJson },
                  ]
                    .filter((item) => item.href)
                    .map((item) => (
                      <Link
                        key={item.label}
                        href={item.href!}
                        target="_blank"
                        className="rounded-2xl border border-border p-4 transition hover:bg-secondary/40"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-medium text-foreground">{item.label}</div>
                            <div className="mt-1 text-xs text-muted-foreground break-all">{item.href}</div>
                          </div>
                          <ExternalLink className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </Link>
                    ))}
                </div>
              </div>
            ) : null}
            <div className="rounded-2xl border border-border p-4 text-sm text-muted-foreground">
              生成结果会输出视频脚本、PPT 提纲、结构化 JSON 和网页预览页。当前线上 latest 页面会优先读取这台浏览器刚生成的最新宣传包，便于直接演示。
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
