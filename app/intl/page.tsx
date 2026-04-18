import { headers } from "next/headers"
import { ArrowRight, BookOpen, Globe2, Layers3, Smartphone, Sparkles } from "lucide-react"
import { getRequestSiteLinks } from "@/lib/site-links"

const featureCards = [
  {
    icon: Sparkles,
    title: "Prompt To Product",
    description: "Turn one prompt into a full-stack workspace with generation, iteration, and delivery surfaces already connected.",
    value: "AI generation pipeline",
  },
  {
    icon: Layers3,
    title: "Admin And Market Split",
    description: "Keep internal operations in admin while sales, launch, and outbound assets stay organized in market.",
    value: "Two clear business surfaces",
  },
  {
    icon: Smartphone,
    title: "Web + Mobile Delivery",
    description: "Show official site links, docs, Android APK, and iOS entry points in one polished demo flow.",
    value: "Boss-demo ready",
  },
]

export default async function IntlWebsitePage() {
  const headerStore = await headers()
  const siteLinks = getRequestSiteLinks(headerStore.get("host"))

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_26%),radial-gradient(circle_at_top_right,rgba(16,185,129,0.12),transparent_20%),linear-gradient(180deg,#f7fbff_0%,#ffffff_48%,#f7fafc_100%)] px-6 py-12 text-slate-900">
      <div className="mx-auto grid max-w-6xl gap-10">
        <section className="overflow-hidden rounded-[32px] border border-sky-100 bg-white/95 p-8 shadow-[0_28px_80px_rgba(15,23,42,0.10)]">
          <div className="inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-medium text-sky-700">INTL Website</div>
          <h1 className="mt-4 max-w-4xl text-5xl font-semibold tracking-tight">mornstack builds product demos that are ready to show, sell, and ship.</h1>
          <p className="mt-4 max-w-3xl text-base leading-8 text-slate-600">
            This is the international product-facing entry for founders, product teams, and partners. It connects the website,
            admin backend, market backend, docs, and mobile download flow into one consistent demo surface.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a href={siteLinks.marketCenter} className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm text-white">
              Open market center
              <ArrowRight className="h-4 w-4" />
            </a>
            <a href={siteLinks.adminConsole} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-5 py-3 text-sm">
              Open admin console
            </a>
            <a href={siteLinks.docs} className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-5 py-3 text-sm">
              View docs
            </a>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-3">
          {featureCards.map((item) => {
            const Icon = item.icon
            return (
              <div key={item.title} className="rounded-[28px] border border-slate-200 bg-white p-6">
                <Icon className="h-5 w-5" />
                <h2 className="mt-4 text-xl font-semibold">{item.title}</h2>
                <p className="mt-2 text-sm text-slate-600">{item.description}</p>
                <div className="mt-4 text-sm font-medium text-slate-500">{item.value}</div>
              </div>
            )
          })}
        </section>

        <section className="grid gap-5 md:grid-cols-3">
          <a href={siteLinks.websiteIntl} className="rounded-[28px] border border-slate-200 bg-white p-6 transition-transform hover:-translate-y-0.5">
            <Globe2 className="h-5 w-5" />
            <h2 className="mt-4 text-xl font-semibold">Official website</h2>
            <p className="mt-2 text-sm text-slate-600">The live entry point to share with overseas partners and demo reviewers.</p>
            <div className="mt-4 break-all text-sm text-slate-500">{siteLinks.websiteIntl}</div>
          </a>
          <a href={siteLinks.docs} className="rounded-[28px] border border-slate-200 bg-white p-6 transition-transform hover:-translate-y-0.5">
            <BookOpen className="h-5 w-5" />
            <h2 className="mt-4 text-xl font-semibold">Documentation</h2>
            <p className="mt-2 text-sm text-slate-600">API docs, SDK entry, examples, and operator-facing materials live here.</p>
            <div className="mt-4 break-all text-sm text-slate-500">{siteLinks.docs}</div>
          </a>
          <a href={siteLinks.androidApk} className="rounded-[28px] border border-slate-200 bg-white p-6 transition-transform hover:-translate-y-0.5">
            <Smartphone className="h-5 w-5" />
            <h2 className="mt-4 text-xl font-semibold">Mobile delivery</h2>
            <p className="mt-2 text-sm text-slate-600">Use the download pages to present Android APK and iOS installation paths.</p>
            <div className="mt-4 break-all text-sm text-slate-500">{siteLinks.iosDownload}</div>
          </a>
        </section>
      </div>
    </main>
  )
}
