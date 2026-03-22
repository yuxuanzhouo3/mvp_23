import Link from "next/link"
import { ArrowRight, Clapperboard, CreditCard, ExternalLink, Globe2, Layers3, LockKeyhole, Megaphone, Presentation, ShieldCheck, Smartphone, Sparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { siteLinks } from "@/lib/site-links"

const stablePromoLinks = [
  { label: "最新宣传总览页", href: "/generated/promo-assets/latest/index.html", note: "打开最新宣传包的网页总览，适合先快速讲一遍产品故事" },
  { label: "最新视频分镜页", href: "/generated/promo-assets/latest/promo-video-storyboard.html", note: "逐段展示视频脚本、镜头 cue 和旁白结构" },
  { label: "最新 PPT 演示页", href: "/generated/promo-assets/latest/promo-ppt-copy.html", note: "逐页展示讲解逻辑、视觉提示和 presenter note" },
]

const demoLinks = [
  { label: "Admin", href: siteLinks.adminConsole, icon: ShieldCheck, note: "生成宣传内容、整理链接资产、输出网页化演示材料" },
  { label: "Market", href: siteLinks.marketCenter, icon: Megaphone, note: "集中展示官网、文档、下载、登录与开通入口" },
  { label: "登录入口", href: siteLinks.loginEntry, icon: LockKeyhole, note: "演示国内外账号入口与账号流程" },
  { label: "开通入口", href: siteLinks.checkoutEntry, icon: CreditCard, note: "演示套餐选择与支付链路入口" },
]

const publicSurfaceLinks = [
  { label: "国际官网", href: siteLinks.websiteIntl, icon: Globe2 },
  { label: "国内官网", href: siteLinks.websiteCn, icon: Globe2 },
  { label: "文档中心", href: siteLinks.docs, icon: Clapperboard },
  { label: "Android 下载", href: siteLinks.androidApk, icon: Smartphone },
  { label: "iOS 下载", href: siteLinks.iosDownload, icon: Smartphone },
]

export default function BossDemoPage() {
  return (
    <div className="grid gap-6">
      <section className="overflow-hidden rounded-[32px] border border-border/70 bg-[radial-gradient(circle_at_top,_rgba(251,191,36,0.20),_transparent_30%),linear-gradient(180deg,#fffaf0_0%,#ffffff_52%,#f8fafc_100%)] p-6 md:p-8">
        <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
          <div className="max-w-3xl">
            <Badge variant="outline">/demo</Badge>
            <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground md:text-6xl">产品演示总览入口</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground md:text-base">
              这里把官网、产品入口、宣传演示页、登录与开通路径整理成一条更顺手的演示动线，方便直接点击查看真实页面效果。
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild className="shadow-[0_16px_36px_rgba(58,48,35,0.12)]">
                <a href={siteLinks.marketCenter}>
                  先看 Market
                  <ArrowRight className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Button variant="outline" asChild>
                <a href={siteLinks.adminConsole}>打开 Admin</a>
              </Button>
              <Button variant="outline" asChild>
                <a href={siteLinks.bossDemo} target="_blank" rel="noreferrer">
                  复制线上稳定 URL
                </a>
              </Button>
            </div>
          </div>

          <div className="rounded-[2rem] border border-stone-200/80 bg-[radial-gradient(circle_at_top,_rgba(255,251,241,0.98),_rgba(250,246,237,0.98)_42%,_rgba(243,238,229,0.99)_100%)] p-6 text-stone-800 shadow-[0_24px_70px_rgba(94,80,58,0.10)]">
            <div className="flex items-center gap-2 text-sm text-stone-700/75">
              <Sparkles className="h-4 w-4" />
              推荐浏览顺序
            </div>
            <div className="mt-5 space-y-3 text-sm">
              <div className="rounded-2xl border border-stone-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(249,246,239,0.78))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_8px_22px_rgba(104,88,63,0.06)]">1. 先看当前域名下的 Market，快速理解官网、文档、下载与开通路径</div>
              <div className="rounded-2xl border border-stone-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(249,246,239,0.78))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_8px_22px_rgba(104,88,63,0.06)]">2. 再看当前域名下的登录和支付入口，展示账号与开通链路</div>
              <div className="rounded-2xl border border-stone-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(249,246,239,0.78))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_8px_22px_rgba(104,88,63,0.06)]">3. 在当前域名下的 Admin 生成宣传文件夹，随后直接查看网页化宣传页</div>
              <div className="rounded-2xl border border-stone-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(249,246,239,0.78))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_8px_22px_rgba(104,88,63,0.06)]">4. 打开视频分镜页和 PPT 演示页，直接讲产品故事和方案价值</div>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>稳定演示入口</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {demoLinks.map((item) => {
              const Icon = item.icon
              return (
                <Link key={item.label} href={item.href} className="rounded-2xl border border-border p-4 transition hover:bg-secondary/40">
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
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </div>
                </Link>
              )
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers3 className="h-5 w-5" />
              宣传页入口
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {stablePromoLinks.map((item) => (
              <a key={item.label} href={item.href} target="_blank" rel="noreferrer" className="rounded-2xl border border-border p-4 transition hover:bg-secondary/40">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-foreground">{item.label}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{item.note}</div>
                    <div className="mt-2 text-xs text-muted-foreground break-all">{item.href}</div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </div>
              </a>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Presentation className="h-5 w-5" />
            公开站点入口
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {publicSurfaceLinks.map((item) => {
            const Icon = item.icon
            return (
              <a key={item.label} href={item.href} target="_blank" rel="noreferrer" className="rounded-2xl border border-border p-4 transition hover:bg-secondary/40">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-secondary p-2">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="font-medium text-foreground">{item.label}</div>
                      <div className="mt-1 text-xs text-muted-foreground break-all">{item.href}</div>
                    </div>
                  </div>
                  <ExternalLink className="h-4 w-4 text-muted-foreground" />
                </div>
              </a>
            )
          })}
        </CardContent>
      </Card>
    </div>
  )
}
