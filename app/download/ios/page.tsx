import Link from "next/link"
import { Apple, ArrowRight, BadgeCheck, Smartphone } from "lucide-react"
import { siteLinks } from "@/lib/site-links"

type IosDownloadPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function IosDownloadPage({ searchParams }: IosDownloadPageProps) {
  const params = (await searchParams) ?? {}
  const channelValue = Array.isArray(params.channel) ? params.channel[0] : params.channel
  const isTestFlight = channelValue === "testflight"

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(15,23,42,0.08),transparent_26%),linear-gradient(180deg,#f8fafc_0%,#ffffff_52%,#f7fafc_100%)] px-6 py-12 text-slate-900">
      <div className="mx-auto grid max-w-4xl gap-8">
        <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-[0_28px_80px_rgba(15,23,42,0.08)]">
          <div className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
            {isTestFlight ? "iOS TestFlight" : "iOS Download"}
          </div>
          <div className="mt-5 flex items-center gap-4">
            <div className="rounded-3xl bg-slate-100 p-4 text-slate-900">
              <Apple className="h-10 w-10" />
            </div>
            <div>
              <h1 className="text-4xl font-semibold tracking-tight">
                {isTestFlight ? "mornstack iOS TestFlight" : "mornstack iOS App Entry"}
              </h1>
              <p className="mt-2 text-sm text-slate-600">
                {isTestFlight
                  ? "这个页面用于老板、团队和测试用户走 TestFlight 试用链路。"
                  : "这个页面用于承接正式 App Store 或企业版 iOS 下载入口。"}
              </p>
            </div>
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <div className="rounded-[24px] border border-slate-200 p-5">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                <Smartphone className="h-4 w-4" />
                当前演示地址
              </div>
              <div className="mt-3 break-all text-sm text-slate-500">
                {isTestFlight ? siteLinks.iosTestFlight : siteLinks.iosDownload}
              </div>
            </div>
            <div className="rounded-[24px] border border-slate-200 p-5">
              <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                <BadgeCheck className="h-4 w-4" />
                使用说明
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                后续接入真实 App Store 或 TestFlight 链接时，只需要替换环境变量，不需要改演示页面结构。
              </p>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={siteLinks.marketCenter} className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm text-white">
              返回市场页
              <ArrowRight className="h-4 w-4" />
            </a>
            <a href={siteLinks.websiteIntl} className="rounded-full border border-slate-200 px-5 py-3 text-sm">
              打开国际官网
            </a>
          </div>
        </section>
      </div>
    </main>
  )
}
