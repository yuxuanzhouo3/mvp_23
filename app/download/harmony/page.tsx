import { headers } from "next/headers"
import { ArrowRight, Layers3, ShieldCheck } from "lucide-react"
import { listDistributionAssets } from "@/lib/distribution-asset-store"
import { getRequestSiteLinks } from "@/lib/site-links"

const harmonyChecklist = [
  "保留鸿蒙壳转化说明、签名路径和最小发布检查项。",
  "如果当前还没有可安装包，这个页面也可以先承接转化方案和交付节奏。",
  "后续真实链接 ready 后，只替换环境变量，不需要改页面结构。",
]

export const dynamic = "force-dynamic"

export default async function HarmonyDownloadPage() {
  const headerStore = await headers()
  const siteLinks = getRequestSiteLinks(headerStore.get("host"))
  const harmonyAsset = (await listDistributionAssets()).find((asset) => asset.id === "harmony")
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(244,63,94,0.10),transparent_24%),linear-gradient(180deg,#fff8fb_0%,#ffffff_50%,#fff7ed_100%)] px-6 py-12 text-slate-900">
      <div className="mx-auto grid max-w-4xl gap-8">
        <section className="rounded-[32px] border border-rose-100 bg-white p-8 shadow-[0_28px_80px_rgba(15,23,42,0.08)]">
          <div className="inline-flex rounded-full bg-rose-100 px-3 py-1 text-xs font-medium text-rose-700">Harmony Path</div>
          <div className="mt-5 flex items-center gap-4">
            <div className="rounded-3xl bg-rose-50 p-4 text-rose-600">
              <Layers3 className="h-10 w-10" />
            </div>
            <div>
              <h1 className="text-4xl font-semibold tracking-tight">mornstack Harmony Delivery</h1>
              <p className="mt-2 text-sm text-slate-600">这里先承接鸿蒙转化方案、签名准备和后续包体交付路径，确保 4.14 前有清晰可验收入口。</p>
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
          {harmonyChecklist.map((item) => (
            <div key={item} className="rounded-[28px] border border-slate-200 bg-white p-5 text-sm leading-7 text-slate-600">
              {item}
            </div>
          ))}
        </section>

        <section className="rounded-[28px] border border-dashed border-slate-300 bg-white p-6">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
            <ShieldCheck className="h-4 w-4" />
            当前鸿蒙入口
          </div>
          <div className="mt-2 break-all text-sm text-slate-500">{harmonyAsset?.href || siteLinks.harmonyDownload}</div>
          {harmonyAsset ? (
            <div className="mt-4 grid gap-2 text-sm text-slate-600">
              <div>环境变量：{harmonyAsset.envKey}</div>
              <div>公共路由：{harmonyAsset.publicPath}</div>
              {harmonyAsset.updatedAt ? <div>最近更新：{new Date(harmonyAsset.updatedAt).toLocaleString()}</div> : null}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  )
}
