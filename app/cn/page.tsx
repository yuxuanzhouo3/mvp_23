import { ArrowRight, BookOpen, Globe2, ShieldCheck, Smartphone } from "lucide-react"
import { siteLinks } from "@/lib/site-links"

export default function ChinaWebsitePage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(251,191,36,0.16),transparent_26%),linear-gradient(180deg,#fff8ef_0%,#ffffff_48%,#fffaf4_100%)] px-6 py-12 text-slate-900">
      <div className="mx-auto grid max-w-6xl gap-10">
        <section className="rounded-[32px] border border-amber-100 bg-white/95 p-8 shadow-[0_28px_80px_rgba(15,23,42,0.08)]">
          <div className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700">CN Website</div>
          <h1 className="mt-4 text-5xl font-semibold tracking-tight">mornstack 国内官网</h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
            面向国内老板、客户与合作伙伴的产品展示入口。这里可以集中展示官网介绍、文档、移动端下载，以及进入后台和销售后台的演示链路。
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={siteLinks.marketCenter} className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm text-white">
              打开销售后台
              <ArrowRight className="h-4 w-4" />
            </a>
            <a href={siteLinks.adminConsole} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-5 py-3 text-sm">
              打开管理后台
            </a>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-3">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6">
            <Globe2 className="h-5 w-5" />
            <h2 className="mt-4 text-xl font-semibold">官网与演示 URL</h2>
            <p className="mt-2 text-sm text-slate-600">统一对外演示入口，适合老板和客户直接打开。</p>
            <div className="mt-4 break-all text-sm text-slate-500">{siteLinks.websiteCn}</div>
          </div>
          <div className="rounded-[28px] border border-slate-200 bg-white p-6">
            <BookOpen className="h-5 w-5" />
            <h2 className="mt-4 text-xl font-semibold">文档展示</h2>
            <p className="mt-2 text-sm text-slate-600">API 文档、SDK 和示例说明都可以从这里延伸展示。</p>
            <div className="mt-4 text-sm text-slate-500">{siteLinks.docs}</div>
          </div>
          <div className="rounded-[28px] border border-slate-200 bg-white p-6">
            <Smartphone className="h-5 w-5" />
            <h2 className="mt-4 text-xl font-semibold">手机端下载</h2>
            <p className="mt-2 text-sm text-slate-600">支持 Android APK 和 iOS 下载页，便于现场扫码或点击演示。</p>
            <div className="mt-4 text-sm text-slate-500">{siteLinks.androidApk}</div>
          </div>
        </section>

        <section className="rounded-[28px] border border-slate-200 bg-white p-8">
          <div className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <ShieldCheck className="h-4 w-4" />
            建议演示顺序
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-4">
            {["先看官网", "再看文档", "再点下载", "最后进 admin 生成宣传视频与 PPT"].map((item) => (
              <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                {item}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  )
}
