import { ArrowRight, MessageSquareMore, QrCode } from "lucide-react"
import { listDistributionAssets } from "@/lib/distribution-asset-store"
import { siteLinks } from "@/lib/site-links"

const miniProgramChecklist = [
  "保留小程序工程骨架、运行说明和发布路径。",
  "微信登录先预留接口与配置位，等凭据 ready 后再接真实链路。",
  "二维码、发布说明和体验版本入口都可以继续挂在这个页面。",
]

export const dynamic = "force-dynamic"

export default async function MiniProgramDownloadPage() {
  const miniProgramAsset = (await listDistributionAssets()).find((asset) => asset.id === "mini_program")
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(34,197,94,0.10),transparent_24%),linear-gradient(180deg,#f7fff8_0%,#ffffff_50%,#f8fafc_100%)] px-6 py-12 text-slate-900">
      <div className="mx-auto grid max-w-4xl gap-8">
        <section className="rounded-[32px] border border-emerald-100 bg-white p-8 shadow-[0_28px_80px_rgba(15,23,42,0.08)]">
          <div className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">Mini Program</div>
          <div className="mt-5 flex items-center gap-4">
            <div className="rounded-3xl bg-emerald-50 p-4 text-emerald-600">
              <MessageSquareMore className="h-10 w-10" />
            </div>
            <div>
              <h1 className="text-4xl font-semibold tracking-tight">mornstack Mini-program Entry</h1>
              <p className="mt-2 text-sm text-slate-600">这里先承接小程序工程骨架、微信登录预留位和后续发布说明，确保多端交付路径可验收。</p>
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
          {miniProgramChecklist.map((item) => (
            <div key={item} className="rounded-[28px] border border-slate-200 bg-white p-5 text-sm leading-7 text-slate-600">
              {item}
            </div>
          ))}
        </section>

        <section className="rounded-[28px] border border-dashed border-slate-300 bg-white p-6">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
            <QrCode className="h-4 w-4" />
            当前小程序入口
          </div>
          <div className="mt-2 break-all text-sm text-slate-500">{miniProgramAsset?.href || siteLinks.miniProgramGuide}</div>
          {miniProgramAsset ? (
            <div className="mt-4 grid gap-2 text-sm text-slate-600">
              <div>环境变量：{miniProgramAsset.envKey}</div>
              <div>公共路由：{miniProgramAsset.publicPath}</div>
              {miniProgramAsset.updatedAt ? <div>最近更新：{new Date(miniProgramAsset.updatedAt).toLocaleString()}</div> : null}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  )
}
