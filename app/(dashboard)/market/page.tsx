import Link from "next/link"
import { ArrowRight, BarChart3, BookOpen, Download, ExternalLink, Globe2, LockKeyhole, QrCode, ShieldCheck, Smartphone, Sparkles, Wallet } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { siteLinks } from "@/lib/site-links"

const docsLinks = [
  { label: "API Docs", href: "/api-docs", note: "接口和基础 URL" },
  { label: "SDK", href: "/sdk", note: "集成说明与开发入口" },
  { label: "Examples", href: "/examples", note: "示例场景与 demo prompt" },
  { label: "Blog", href: "/blog", note: "对外内容与产品叙事" },
]

const channels = [
  { label: "国际官网", href: siteLinks.websiteIntl, note: "给海外客户和合作方看的主站" },
  { label: "国内官网", href: siteLinks.websiteCn, note: "给国内客户和渠道的落地页" },
  { label: "文档中心", href: siteLinks.docs, note: "演示前发给老板和技术同事" },
  { label: "API Base", href: siteLinks.apiBase, note: "对接方/合作方查看接口时使用" },
]

const mobileAssets = [
  { label: "Android APK", href: siteLinks.androidApk, sub: "安卓安装包直链" },
  { label: "iOS App Store", href: siteLinks.iosDownload, sub: "iPhone 正式下载入口" },
  { label: "iOS TestFlight", href: siteLinks.iosTestFlight, sub: "内测/老板试用入口" },
]

export default function MarketPage() {
  return (
    <div className="grid gap-6">
      <section className="overflow-hidden rounded-[32px] border border-border/70 bg-[radial-gradient(circle_at_top,_rgba(178,150,105,0.12),_transparent_28%),linear-gradient(180deg,#fffdf9_0%,#fbf8f2_52%,#f5f1ea_100%)] p-6 md:p-8 shadow-[0_18px_60px_rgba(98,82,57,0.07)]">
        <div className="grid gap-8 xl:grid-cols-[1.08fr_0.92fr]">
          <div className="max-w-3xl">
            <Badge variant="outline">/market</Badge>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground md:text-6xl">
              面向客户、合作方与团队的统一产品入口
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
              这里集中展示产品官网、文档中心、移动端下载、账号入口与开通路径，帮助客户、合作方和团队成员快速了解产品能力并开始体验。
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild className="shadow-[0_16px_36px_rgba(58,48,35,0.12)]">
                <a href={siteLinks.checkoutEntry}>
                  查看开通方案
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href={siteLinks.loginEntry}>账号登录</a>
              </Button>
            </div>
            <div className="mt-8 grid gap-3 md:grid-cols-3">
              {[
                { title: "产品介绍", text: "官网、文档与示例页面保持统一体验，便于快速理解产品定位。" },
                { title: "快速体验", text: "账号、下载与开通入口保持同一路径，减少试用与采购门槛。" },
                { title: "合作交付", text: "文档、API 与移动端资产统一开放，便于团队与合作方对接。" },
              ].map((item) => (
                <div key={item.title} className="rounded-[1.5rem] border border-white/70 bg-white/80 p-4 shadow-sm">
                  <div className="font-medium text-foreground">{item.title}</div>
                  <div className="mt-2 text-sm text-muted-foreground">{item.text}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-4">
            <div className="rounded-[2rem] border border-stone-200/80 bg-[radial-gradient(circle_at_top,_rgba(255,251,241,0.98),_rgba(250,246,237,0.98)_42%,_rgba(243,238,229,0.99)_100%)] p-6 text-stone-800 shadow-[0_24px_70px_rgba(94,80,58,0.10)]">
              <div className="flex items-center gap-2 text-sm text-stone-700/75">
                <Sparkles className="h-4 w-4" />
                推荐体验路径
              </div>
              <div className="mt-5 space-y-3 text-sm">
                <div className="rounded-2xl border border-stone-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(249,246,239,0.78))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_8px_22px_rgba(104,88,63,0.06)]">1. 浏览官网、文档和示例，快速理解产品能力</div>
                <div className="rounded-2xl border border-stone-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(249,246,239,0.78))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_8px_22px_rgba(104,88,63,0.06)]">2. 根据地区进入账号入口，体验登录与开通流程</div>
                <div className="rounded-2xl border border-stone-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(249,246,239,0.78))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_8px_22px_rgba(104,88,63,0.06)]">3. 查看下载页与移动端交付方式，了解多端覆盖能力</div>
                <div className="rounded-2xl border border-stone-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(249,246,239,0.78))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_8px_22px_rgba(104,88,63,0.06)]">4. 如需深入对接，可继续查看 API 与集成文档</div>
              </div>
            </div>
            <div className="rounded-[2rem] border border-border bg-white/90 p-5">
              <div className="text-sm font-medium text-foreground">公开 URL 一览</div>
              <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                <div>市场页：{siteLinks.marketCenter}</div>
                <div>文档中心：{siteLinks.docs}</div>
                <div>API Base：{siteLinks.apiBase}</div>
                <div>国际官网：{siteLinks.websiteIntl}</div>
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
              官网与文档对外入口
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {channels.map((item) => (
              <div key={item.label} className="rounded-2xl border border-border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{item.label}</div>
                    <div className="truncate text-sm text-muted-foreground">{item.href}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{item.note}</div>
                  </div>
                  <a href={item.href} target="_blank" rel="noreferrer">
                    <Button variant="outline" size="sm">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </a>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              手机端下载资产
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {mobileAssets.map((item) => (
              <div key={item.label} className="rounded-2xl border border-border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{item.label}</div>
                    <div className="truncate text-sm text-muted-foreground">{item.href}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{item.sub}</div>
                  </div>
                  <a href={item.href} target="_blank" rel="noreferrer">
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4" />
                    </Button>
                  </a>
                </div>
              </div>
            ))}
            <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              <div className="mb-2 flex items-center gap-2 font-medium text-foreground">
                <QrCode className="h-4 w-4" />
                使用建议
              </div>
              你可以从这里进入官网、文档和下载页，快速了解产品，并按需进入账号与开通流程。
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="border-border/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LockKeyhole className="h-5 w-5" />
              登录入口
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-muted-foreground">
            <a href={siteLinks.loginEntry} className="rounded-2xl border border-border p-4 transition hover:bg-secondary/40">
              <div className="font-medium text-foreground">国内：微信登录</div>
              <div className="mt-1">适用于中国区账号接入与快速登录体验。</div>
            </a>
            <a href={siteLinks.loginEntry} className="rounded-2xl border border-border p-4 transition hover:bg-secondary/40">
              <div className="font-medium text-foreground">海外：Google / Facebook</div>
              <div className="mt-1">适用于国际用户的常见社交账号接入方式。</div>
            </a>
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              支付联动
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-muted-foreground">
            <div className="rounded-2xl border border-border p-4">国内结账：支付宝 / 微信支付入口</div>
            <div className="rounded-2xl border border-border p-4">海外结账：Stripe / PayPal 入口</div>
            <div className="rounded-2xl border border-dashed border-border p-4">
              支持按地区选择更合适的账号与开通方式，后续将持续完善正式支付链路。
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              文档展示
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {docsLinks.map((item) => (
              <a key={item.label} href={item.href} className="rounded-2xl border border-border p-4 transition-colors hover:bg-secondary/40">
                <div className="font-medium">{item.label}</div>
                <div className="mt-1 text-sm text-muted-foreground">{item.note}</div>
              </a>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              销售后台定位
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-muted-foreground">
            <div className="rounded-2xl border border-border p-4">
              线索入口：官网、下载、演示链接统一收口。
            </div>
            <div className="rounded-2xl border border-border p-4">
              资料出口：文档、案例、价格、下载材料集中展示。
            </div>
            <div className="rounded-2xl border border-border p-4">
              销售协同：让客户、合作方与团队成员都能在一个入口完成了解与接入。
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              快速开始
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm text-muted-foreground">
            <div className="rounded-2xl border border-border p-4">1. 先浏览国际版或中国版官网，了解产品定位</div>
            <div className="rounded-2xl border border-border p-4">2. 查看文档中心与 API 资料，确认接入方式</div>
            <div className="rounded-2xl border border-border p-4">3. 根据地区进入账号入口，完成登录与体验</div>
            <div className="rounded-2xl border border-border p-4">4. 查看下载页与开通方案，继续评估使用路径</div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
