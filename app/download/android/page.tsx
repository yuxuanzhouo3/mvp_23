import { headers } from "next/headers"
import { Smartphone } from "lucide-react"
import { ANDROID_DELIVERY_SPEC } from "@/lib/delivery-readiness"
import { listDistributionAssets } from "@/lib/distribution-asset-store"
import { getRequestSiteLinks } from "@/lib/site-links"

const checklist = [
  "用于老板现场点击演示的 Android 下载入口",
  "可替换为真实 APK 或企业分发地址",
  "和官网、文档、市场页保持统一跳转关系",
]

export const dynamic = "force-dynamic"

export default async function AndroidDownloadPage() {
  const headerStore = await headers()
  const siteLinks = getRequestSiteLinks(headerStore.get("host"))
  const androidAsset = (await listDistributionAssets()).find((asset) => asset.id === "android_apk")
  return (
    <main className="min-h-screen bg-[linear-gradient(180deg,#f6fff7_0%,#ffffff_48%,#f7fafc_100%)] px-6 py-12 text-slate-900">
      <div className="mx-auto grid max-w-4xl gap-8">
        <section className="rounded-[32px] border border-emerald-100 bg-white p-8 shadow-[0_28px_80px_rgba(15,23,42,0.08)]">
          <div className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700">Android Download</div>
          <div className="mt-5 flex items-center gap-4">
            <div className="rounded-3xl bg-emerald-50 p-4 text-emerald-600">
              <Smartphone className="h-10 w-10" />
            </div>
            <div>
              <h1 className="text-4xl font-semibold tracking-tight">Mornstack / MornstackIntl Android APK</h1>
              <p className="mt-2 text-sm text-slate-600">
                这个页面先作为真实演示入口，后续只需要把按钮替换成正式 APK 下载地址即可。intl 默认对外站点统一按
                {" "}
                https://www.mornscience.app/
                {" "}
                口径交付。
              </p>
            </div>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={siteLinks.marketCenter} className="rounded-full bg-slate-900 px-5 py-3 text-sm text-white">
              返回市场页
            </a>
            <a href={siteLinks.websiteCn} className="rounded-full border border-slate-200 px-5 py-3 text-sm">
              打开国内官网
            </a>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {checklist.map((item) => (
            <div key={item} className="rounded-[28px] border border-slate-200 bg-white p-5 text-sm text-slate-600">
              {item}
            </div>
          ))}
        </section>

        <section className="rounded-[28px] border border-dashed border-slate-300 bg-white p-6">
          <div className="text-sm font-medium text-slate-900">当前演示下载地址</div>
          <div className="mt-2 break-all text-sm text-slate-500">{androidAsset?.href || siteLinks.androidApk}</div>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            如果需要上线真实安装包，这里直接改成 CDN、对象存储或企业分发链接即可；页面本身已经可以作为对外入口使用。
          </p>
          {androidAsset?.updatedAt ? <div className="mt-3 text-xs text-slate-500">最近更新：{new Date(androidAsset.updatedAt).toLocaleString()}</div> : null}
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[28px] border border-slate-200 bg-white p-5">
            <div className="text-sm font-medium text-slate-900">签名与包名</div>
            <div className="mt-3 text-sm leading-7 text-slate-600">Keystore: {ANDROID_DELIVERY_SPEC.keystore}</div>
            <div className="mt-2 text-sm leading-7 text-slate-600">包名规范: {ANDROID_DELIVERY_SPEC.packageRule}</div>
            <div className="mt-2 text-sm leading-7 text-slate-600">INTL appName: MornstackIntl</div>
            <div className="mt-2 text-sm leading-7 text-slate-600">INTL package: com.mornstack.android.global</div>
          </div>
          <div className="rounded-[28px] border border-slate-200 bg-white p-5">
            <div className="text-sm font-medium text-slate-900">第一阶段目标</div>
            <div className="mt-3 text-sm leading-7 text-slate-600">APK 构建、真机安装、支付宝 0.1 支付验证优先。</div>
          </div>
          <div className="rounded-[28px] border border-slate-200 bg-white p-5">
            <div className="text-sm font-medium text-slate-900">迁移参考</div>
            <div className="mt-3 text-sm leading-7 text-slate-600">登录与支付复用来源: {ANDROID_DELIVERY_SPEC.authPaymentSource}</div>
          </div>
        </section>
      </div>
    </main>
  )
}
