import { ArrowRight, Download, MonitorSmartphone } from "lucide-react"
import { listDistributionAssets } from "@/lib/distribution-asset-store"
import { siteLinks } from "@/lib/site-links"

const desktopSteps = [
  "Reserve this page for an installer, packaged desktop shell, or public release note page.",
  "Keep the same URL even if the final desktop artifact changes from a zip to an installer.",
  "Mirror the final link in admin and market so the delivery story stays consistent.",
]

export const dynamic = "force-dynamic"

export default async function DesktopDownloadPage() {
  const desktopAsset = (await listDistributionAssets()).find((asset) => asset.id === "desktop")
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.10),transparent_26%),linear-gradient(180deg,#f8fbff_0%,#ffffff_48%,#f8fafc_100%)] px-6 py-12 text-slate-900">
      <div className="mx-auto grid max-w-4xl gap-8">
        <section className="rounded-[32px] border border-sky-100 bg-white p-8 shadow-[0_28px_80px_rgba(15,23,42,0.08)]">
          <div className="inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700">Desktop Distribution</div>
          <div className="mt-5 flex items-center gap-4">
            <div className="rounded-3xl bg-sky-50 p-4 text-sky-600">
              <MonitorSmartphone className="h-10 w-10" />
            </div>
            <div>
              <h1 className="text-4xl font-semibold tracking-tight">mornstack Desktop Entry</h1>
              <p className="mt-2 text-sm text-slate-600">这个页面先作为桌面端交付预留位，后续可以直接替换成安装包、桌面壳或发行说明入口。</p>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={siteLinks.downloadCenter} className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm text-white">
              返回下载中心
              <ArrowRight className="h-4 w-4" />
            </a>
            <a href={siteLinks.marketCenter} className="rounded-full border border-slate-200 px-5 py-3 text-sm">
              打开市场页
            </a>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {desktopSteps.map((item) => (
            <div key={item} className="rounded-[28px] border border-slate-200 bg-white p-5 text-sm leading-7 text-slate-600">
              {item}
            </div>
          ))}
        </section>

        <section className="rounded-[28px] border border-dashed border-slate-300 bg-white p-6">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
            <Download className="h-4 w-4" />
            当前桌面分发地址
          </div>
          <div className="mt-2 break-all text-sm text-slate-500">{desktopAsset?.href || siteLinks.desktopDownload}</div>
          {desktopAsset ? (
            <div className="mt-4 grid gap-2 text-sm text-slate-600">
              <div>环境变量：{desktopAsset.envKey}</div>
              <div>公共路由：{desktopAsset.publicPath}</div>
              {desktopAsset.updatedAt ? <div>最近更新：{new Date(desktopAsset.updatedAt).toLocaleString()}</div> : null}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  )
}
