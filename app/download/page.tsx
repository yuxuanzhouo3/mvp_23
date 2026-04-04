import { ArrowRight, BadgeCheck, Download, ExternalLink, FileText, Smartphone } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  ANDROID_DELIVERY_SPEC,
  DELIVERY_AUTH_PAYMENT_MIGRATION,
  DELIVERY_CODEPACKS,
  DELIVERY_PERMISSION_RULES,
  DELIVERY_TRACKS,
  getDeliveryStatusLabel,
} from "@/lib/delivery-readiness"
import { listDistributionAssets } from "@/lib/distribution-asset-store"
import { siteLinks } from "@/lib/site-links"

export const dynamic = "force-dynamic"

export default async function DownloadCenterPage() {
  const distributionAssets = await listDistributionAssets()
  const assetByPlatform = Object.fromEntries(distributionAssets.map((asset) => [asset.platform, asset]))
  const managedDownloadChannels = [
    {
      title: "Android APK",
      href: assetByPlatform.android?.href || siteLinks.androidApk,
      note: "Signed APK path for boss demos and device installs",
    },
    {
      title: "iOS App Entry",
      href: assetByPlatform.ios?.href || siteLinks.iosDownload,
      note: "App Store or enterprise iOS distribution entry",
    },
    {
      title: "Desktop Entry",
      href: assetByPlatform.desktop?.href || siteLinks.desktopDownload,
      note: "Desktop installer or web-to-desktop release path",
    },
    {
      title: "Harmony Entry",
      href: assetByPlatform.harmony?.href || siteLinks.harmonyDownload,
      note: "Harmony shell readiness and signing path",
    },
    {
      title: "Mini-program Entry",
      href: assetByPlatform.mini_program?.href || siteLinks.miniProgramGuide,
      note: "Mini-program skeleton and release guide",
    },
  ] as const
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.06),transparent_24%),linear-gradient(180deg,#f8fafc_0%,#ffffff_46%,#f7fafc_100%)] px-6 py-12 text-slate-900">
      <div className="mx-auto grid max-w-6xl gap-8">
        <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-[0_28px_80px_rgba(15,23,42,0.08)]">
          <Badge variant="outline">/download</Badge>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight md:text-5xl">Delivery Download Center</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">
            This page collects the current download surfaces, multi-platform conversion paths, and the 2026-04-14 terminal delivery board in one place.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild>
              <a href={siteLinks.marketCenter}>
                Open market center
                <ArrowRight className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href={siteLinks.adminConsole}>Open admin console</a>
            </Button>
            <Button variant="outline" asChild>
              <a href="/api-docs">Open docs</a>
            </Button>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {managedDownloadChannels.map((channel) => (
            <Card key={channel.title} className="border-slate-200/80">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Smartphone className="h-4 w-4" />
                  {channel.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-sm text-muted-foreground">{channel.note}</div>
                <div className="break-all rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-600">
                  {channel.href}
                </div>
                <Button variant="outline" asChild className="w-full">
                  <a href={channel.href}>
                    Open channel
                    <ExternalLink className="ml-2 h-4 w-4" />
                  </a>
                </Button>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Code delivery packs
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {DELIVERY_CODEPACKS.map((pack) => (
                <div key={pack.id} className="rounded-2xl border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-foreground">{pack.title}</div>
                      <div className="mt-1 text-sm text-muted-foreground">{pack.summary}</div>
                    </div>
                    <Badge variant={pack.status === "ready" ? "secondary" : "outline"}>{getDeliveryStatusLabel(pack.status)}</Badge>
                  </div>
                  <div className="mt-2 text-xs text-muted-foreground">Repo doc: {pack.docPath}</div>
                  <div className="mt-1 text-xs text-muted-foreground break-all">App entry: {pack.appEntry}</div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BadgeCheck className="h-5 w-5" />
                Distribution registry
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {distributionAssets.map((asset) => (
                <div key={asset.id} className="rounded-2xl border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-medium text-foreground">{asset.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground break-all">{asset.href}</div>
                      <div className="mt-2 text-xs text-muted-foreground">Env key: {asset.envKey}</div>
                      <div className="mt-1 text-xs text-muted-foreground">Public route: {asset.publicPath}</div>
                      <div className="mt-1 text-xs text-muted-foreground">Update surface: {asset.updateSurface}</div>
                      {asset.updatedAt ? <div className="mt-1 text-xs text-muted-foreground">Updated: {new Date(asset.updatedAt).toLocaleString()}</div> : null}
                    </div>
                    <Badge variant={asset.status === "ready" ? "secondary" : "outline"}>{getDeliveryStatusLabel(asset.status)}</Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                4.14 delivery board
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {DELIVERY_TRACKS.map((track) => (
                <div key={track.id} className="rounded-2xl border border-border p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-foreground">{track.title}</div>
                      <div className="mt-1 text-sm text-muted-foreground">{track.summary}</div>
                    </div>
                    <Badge variant={track.status === "ready" ? "secondary" : track.status === "blocked" ? "destructive" : "outline"}>
                      {getDeliveryStatusLabel(track.status)}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {track.outputs.slice(0, 3).map((item) => (
                      <span key={item} className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BadgeCheck className="h-5 w-5" />
                Android phase 1 rules
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="rounded-2xl border border-border bg-secondary/20 p-4 text-sm text-muted-foreground">
                <div className="font-medium text-foreground">Reference shell</div>
                <div className="mt-2">{ANDROID_DELIVERY_SPEC.referenceRepo}/{ANDROID_DELIVERY_SPEC.referenceFolder}</div>
              </div>
              <div className="rounded-2xl border border-border bg-secondary/20 p-4 text-sm text-muted-foreground">
                <div className="font-medium text-foreground">Signing</div>
                <div className="mt-2">Keystore: {ANDROID_DELIVERY_SPEC.keystore}</div>
                <div className="mt-1">Package rule: {ANDROID_DELIVERY_SPEC.packageRule}</div>
              </div>
              <div className="rounded-2xl border border-border bg-secondary/20 p-4 text-sm text-muted-foreground">
                <div className="font-medium text-foreground">Migration source</div>
                <div className="mt-2">Login + payment logic reference: {ANDROID_DELIVERY_SPEC.authPaymentSource}</div>
              </div>
              <div className="rounded-2xl border border-dashed border-border p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <FileText className="h-4 w-4" />
                  Delivery notes
                </div>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  The current target is to finish the Android shell, package naming, signing, APK output, and Alipay 0.1 validation before WeChat login moves into phase 2.
                </p>
              </div>
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BadgeCheck className="h-5 w-5" />
                Auth + payment migration lane
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="rounded-2xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-foreground">{DELIVERY_AUTH_PAYMENT_MIGRATION.title}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{DELIVERY_AUTH_PAYMENT_MIGRATION.summary}</div>
                    <div className="mt-2 text-xs text-muted-foreground">Source repo: {DELIVERY_AUTH_PAYMENT_MIGRATION.sourceRepo}</div>
                    <div className="mt-1 text-xs text-muted-foreground">Acceptance doc: {DELIVERY_AUTH_PAYMENT_MIGRATION.docPath}</div>
                  </div>
                  <Badge variant={DELIVERY_AUTH_PAYMENT_MIGRATION.status === "ready" ? "secondary" : "outline"}>
                    {getDeliveryStatusLabel(DELIVERY_AUTH_PAYMENT_MIGRATION.status)}
                  </Badge>
                </div>
                <div className="mt-4 grid gap-2">
                  {DELIVERY_AUTH_PAYMENT_MIGRATION.phases.map((phase) => (
                    <div key={phase} className="rounded-xl border border-border bg-secondary/20 px-3 py-2 text-sm text-foreground">
                      {phase}
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {DELIVERY_PERMISSION_RULES.map((rule) => (
            <Card key={rule.plan}>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg uppercase">{rule.plan}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                <div className="font-medium text-foreground">{rule.title}</div>
                <p className="mt-2 leading-7">{rule.summary}</p>
              </CardContent>
            </Card>
          ))}
        </section>
      </div>
    </main>
  )
}
