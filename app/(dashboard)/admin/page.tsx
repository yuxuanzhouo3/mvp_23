"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { Clapperboard, Copy, ExternalLink, FileText, Globe2, Link2, QrCode, Smartphone, WandSparkles } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { DELIVERY_AUTH_PAYMENT_MIGRATION, DELIVERY_CODEPACKS, DELIVERY_DISTRIBUTION_ASSETS, DELIVERY_PERMISSION_RULES, DELIVERY_TRACKS, getDeliveryStatusLabel, type DeliveryDistributionAsset } from "@/lib/delivery-readiness"
import { LATEST_PROMO_BUNDLE_STORAGE_KEY, type PromoBundleData, type StoredPromoBundle } from "@/lib/promo-bundle-client"
import { siteLinks } from "@/lib/site-links"

type PromoVideoResponse = {
  status: string
  appName: string
  websiteUrl: string
  audience: string
  highlights: string[]
  totalDurationSec: number
  output: {
    aspectRatio: string
    format: string
    resolution: string
    status: string
  }
  scenes: Array<{
    title: string
    durationSec: number
    visual: string
    voiceover: string
  }>
}

type PromoBundleResponse = {
  status: string
  generator: string
  folderPath: string
  files: string[]
  publicUrls?: {
    preview?: string
    readme?: string
    videoScript?: string
    videoStoryboard?: string
    pptDeck?: string
    pptCopy?: string
    bundleJson?: string
    briefJson?: string
    latestPreview?: string
    latestVideoStoryboard?: string
    latestPptCopy?: string
  }
  bundle: PromoBundleData
}

type ManagedDistributionAsset = DeliveryDistributionAsset & {
  updatedAt?: string
}

type DeliveryHandoffRecord = {
  id: "intl" | "cn"
  title: string
  regionLabel: string
  status: "ready" | "in_progress" | "planned" | "blocked"
  phase: string
  branchName: string
  commitHash: string
  productionUrl: string
  previewUrl: string
  runtimeGuide: string
  databaseChoice: string
  lastBuildNote: string
  latestVerification: string
  verifiedAt?: string
  mustCloseItems: string[]
  deferredItems: string[]
  notes: string[]
  updatedAt?: string
  missingFields: string[]
  statusLabelZh: string
  statusLabelEn: string
}

type ControlProgressState = "ready" | "pending" | "blocked"

type PlatformControlMeta = {
  assetId: DeliveryDistributionAsset["id"]
  title: string
  phase: string
  gapCategory: string
  latestVerification: string
  nextStep: string
}

type SharedCheckpointMeta = {
  id: string
  title: string
  owner: "A" | "B" | "C"
  phase: string
  gapCategory: string
  summary: string
  latestVerification: string
  nextStep: string
}

const defaultHighlights = [
  "Prompt -> full-stack app generation",
  "Template-driven visual consistency",
  "Live preview and iterative editing",
  "Website + docs + mobile delivery surfaces",
]

const missingFieldLabels: Record<string, string> = {
  branch: "release branch",
  production_url: "production URL",
  preview_url: "preview URL",
  database: "database choice",
  last_build: "latest build note",
}

const platformControlMeta: PlatformControlMeta[] = [
  {
    assetId: "android_apk",
    title: "Android",
    phase: "Business validation",
    gapCategory: "Manual validation / payment follow-up",
    latestVerification:
      "2026-04-02: Android Studio sync, emulator boot, debug install, and app launch all completed successfully.",
    nextStep: "Validate core interaction, watch Logcat, then verify the Alipay 0.1 path before expanding to WeChat work.",
  },
  {
    assetId: "ios_store",
    title: "iOS",
    phase: "Distribution prep",
    gapCategory: "Post-4/07 multi-end follow-up",
    latestVerification:
      "The App Store and TestFlight slots are already managed by /admin and /download, but the real package links still need final upload.",
    nextStep: "Keep both channels editable in the registry and swap in the real App Store/TestFlight links during the multi-end window.",
  },
  {
    assetId: "desktop",
    title: "Desktop",
    phase: "Distribution prep",
    gapCategory: "Post-4/07 multi-end follow-up",
    latestVerification:
      "The desktop slot is visible in the registry and the download center, but there is no installer artifact uploaded yet.",
    nextStep: "Attach the packaged installer or desktop landing page once the multi-end package exists.",
  },
  {
    assetId: "harmony",
    title: "Harmony",
    phase: "Reserved conversion lane",
    gapCategory: "Post-4/07 multi-end follow-up",
    latestVerification:
      "The Harmony slot is reserved in the registry and docs, while the actual conversion and signing work has not started yet.",
    nextStep: "Keep the route and registry stable now, then open the Harmony shell/signing pass after Web acceptance closure.",
  },
  {
    assetId: "mini_program",
    title: "Mini-program",
    phase: "Reserved conversion lane",
    gapCategory: "Post-4/07 multi-end follow-up",
    latestVerification:
      "The mini-program slot is visible and manageable from the same registry, but the engineering shell is still pending.",
    nextStep: "Preserve the release slot and QR guidance path, then build the actual mini-program shell after 2026-04-07 Web closure.",
  },
]

const sharedDeliveryCheckpoints: SharedCheckpointMeta[] = [
  {
    id: "iterate_online_smoke",
    title: "B-line online iterate smoke",
    owner: "B",
    phase: "2026-04-07 Web acceptance closure",
    gapCategory: "Live chain verification",
    summary:
      "Restore next dev on port 3103 and verify that /api/iterate still prioritizes the current file, page, and module in the live chain.",
    latestVerification: "Pending live pass on port 3103.",
    nextStep: "Start the local app server, run one real iterate request, and record the result back into the handoff note.",
  },
  {
    id: "android_business_validation",
    title: "Android business validation",
    owner: "C",
    phase: "Business validation",
    gapCategory: "Manual validation / payment follow-up",
    summary:
      "2026-04-02 debug install is already done. The next step is emulator interaction + Logcat + Alipay 0.1 validation, while WeChat login/pay stays phase 2.",
    latestVerification: "2026-04-02: debug install and app launch already completed.",
    nextStep: "Keep Android paused for now and resume with interaction, Logcat, and Alipay validation after Web closure.",
  },
]

function toControlProgressState(status: DeliveryHandoffRecord["status"] | ManagedDistributionAsset["status"]): ControlProgressState {
  if (status === "ready") return "ready"
  if (status === "blocked") return "blocked"
  return "pending"
}

function getControlProgressLabel(state: ControlProgressState) {
  if (state === "ready") return "ready"
  if (state === "blocked") return "blocked"
  return "pending"
}

function getControlProgressLabelZh(state: ControlProgressState) {
  if (state === "ready") return "已就绪"
  if (state === "blocked") return "阻塞中"
  return "待收口"
}

function getControlProgressVariant(state: ControlProgressState) {
  if (state === "ready") return "secondary" as const
  if (state === "blocked") return "destructive" as const
  return "outline" as const
}

function formatTimestamp(value?: string) {
  if (!value) return "pending"
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleString()
}

function toDateTimeLocal(value?: string) {
  if (!value) return ""
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return ""
  const pad = (num: number) => String(num).padStart(2, "0")
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`
}

function fromDateTimeLocal(value: string) {
  const normalized = String(value ?? "").trim()
  if (!normalized) return ""
  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return ""
  return parsed.toISOString()
}

export default function AdminPage() {
  const [appName, setAppName] = useState("MornstackIntl")
  const [websiteUrl, setWebsiteUrl] = useState(siteLinks.websiteIntl)
  const [audience, setAudience] = useState("Product teams, founders, developers, and digital operators")
  const [highlights, setHighlights] = useState(defaultHighlights.join("\n"))
  const [references, setReferences] = useState("可补充品牌语气、产品定位、已有页面模块、行业案例、参考产品或希望突出展示的能力。")
  const [result, setResult] = useState<PromoVideoResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [statusText, setStatusText] = useState("")
  const [bundleResult, setBundleResult] = useState<PromoBundleResponse | null>(null)
  const [distributionAssets, setDistributionAssets] = useState<ManagedDistributionAsset[]>(DELIVERY_DISTRIBUTION_ASSETS)
  const [distributionSavingId, setDistributionSavingId] = useState("")
  const [deliveryHandoffRecords, setDeliveryHandoffRecords] = useState<DeliveryHandoffRecord[]>([])
  const [deliveryHandoffSavingId, setDeliveryHandoffSavingId] = useState("")

  useEffect(() => {
    let cancelled = false

    async function loadDistributionAssets() {
      try {
        const res = await fetch("/api/admin/distribution-assets", { cache: "no-store" })
        if (!res.ok) return
        const json = (await res.json()) as { assets?: ManagedDistributionAsset[] }
        if (!cancelled && Array.isArray(json.assets) && json.assets.length) {
          setDistributionAssets(json.assets)
        }
      } catch {
        // keep default asset registry if the runtime store is not ready yet
      }
    }

    void loadDistributionAssets()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function loadDeliveryHandoff() {
      try {
        const res = await fetch("/api/admin/delivery-handoff", { cache: "no-store" })
        if (!res.ok) return
        const json = (await res.json()) as { records?: DeliveryHandoffRecord[] }
        if (!cancelled && Array.isArray(json.records)) {
          setDeliveryHandoffRecords(json.records)
        }
      } catch {
        // keep the section empty if the runtime store has not been initialized yet
      }
    }

    void loadDeliveryHandoff()
    return () => {
      cancelled = true
    }
  }, [])

  async function handleGeneratePromo() {
    try {
      setLoading(true)
      setStatusText("正在生成宣传视频脚本...")
      const res = await fetch("/api/admin/promo-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appName,
          websiteUrl,
          audience,
          highlights: highlights.split("\n").map((item) => item.trim()).filter(Boolean),
          references,
        }),
      })
      const json = (await res.json()) as PromoVideoResponse
      if (!res.ok) {
        throw new Error("宣传视频生成失败")
      }
      setResult(json)
      setStatusText("宣传视频分镜脚本已生成，可直接用于演示或交给剪辑/视频生成服务。")
    } catch (error: any) {
      setStatusText(error?.message || "宣传视频生成失败")
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerateBundle() {
    try {
      setLoading(true)
      setStatusText("正在生成宣传文件夹...")
      const res = await fetch("/api/admin/promo-bundle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName: appName,
          websiteUrl,
          audience,
          highlights: highlights.split("\n").map((item) => item.trim()).filter(Boolean),
          references,
        }),
      })
      const json = (await res.json()) as PromoBundleResponse
      if (!res.ok) {
        throw new Error("宣传文件夹生成失败")
      }
      setBundleResult(json)
      const latestPromoBundle: StoredPromoBundle = {
        generatedAt: new Date().toISOString(),
        generator: json.generator,
        input: {
          productName: appName,
          websiteUrl,
          audience,
          highlights: highlights.split("\n").map((item) => item.trim()).filter(Boolean),
          references,
        },
        bundle: json.bundle,
      }
      window.localStorage.setItem(LATEST_PROMO_BUNDLE_STORAGE_KEY, JSON.stringify(latestPromoBundle))
      setStatusText(`宣传文件夹已生成：${json.folderPath}`)
    } catch (error: any) {
      setStatusText(error?.message || "宣传文件夹生成失败")
    } finally {
      setLoading(false)
    }
  }

  async function copyText(text: string) {
    await navigator.clipboard.writeText(text)
    setStatusText("已复制到剪贴板")
  }

  function updateDistributionAssetField(
    assetId: string,
    field: "href" | "status" | "notes",
    value: string
  ) {
    setDistributionAssets((current) =>
      current.map((asset) => {
        if (asset.id !== assetId) return asset
        if (field === "notes") {
          return {
            ...asset,
            notes: value.split("\n").map((item) => item.trim()).filter(Boolean),
          }
        }
        if (field === "status") {
          return {
            ...asset,
            status: value as ManagedDistributionAsset["status"],
          }
        }
        return {
          ...asset,
          href: value,
        }
      })
    )
  }

  async function handleSaveDistributionAsset(asset: ManagedDistributionAsset) {
    try {
      setDistributionSavingId(asset.id)
      setStatusText(`正在保存 ${asset.title}...`)
      const res = await fetch("/api/admin/distribution-assets", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: asset.id,
          href: asset.href,
          status: asset.status,
          notes: asset.notes,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as { asset?: ManagedDistributionAsset; error?: string }
      if (!res.ok || !json.asset) {
        throw new Error(json.error || "分发资源保存失败")
      }
      setDistributionAssets((current) => current.map((item) => (item.id === asset.id ? json.asset! : item)))
      setStatusText(`${asset.title} 已保存，/download 会读取同一份分发配置。`)
    } catch (error: any) {
      setStatusText(error?.message || "分发资源保存失败")
    } finally {
      setDistributionSavingId("")
    }
  }

  function updateDeliveryHandoffField(
    recordId: "intl" | "cn",
    field:
      | "branchName"
      | "productionUrl"
      | "previewUrl"
      | "runtimeGuide"
      | "databaseChoice"
      | "lastBuildNote"
      | "status"
      | "phase"
      | "latestVerification"
      | "verifiedAt"
      | "mustCloseItems"
      | "deferredItems"
      | "notes",
    value: string
  ) {
    setDeliveryHandoffRecords((current) =>
      current.map((record) => {
        if (record.id !== recordId) return record
        if (field === "notes" || field === "mustCloseItems" || field === "deferredItems") {
          return {
            ...record,
            [field]: value.split("\n").map((item) => item.trim()).filter(Boolean),
          }
        }
        if (field === "status") {
          return {
            ...record,
            status: value as DeliveryHandoffRecord["status"],
          }
        }
        return {
          ...record,
          [field]: value,
        }
      })
    )
  }

  async function handleSaveDeliveryHandoff(record: DeliveryHandoffRecord) {
    try {
      setDeliveryHandoffSavingId(record.id)
      setStatusText(`正在保存 ${record.title}...`)
      const res = await fetch("/api/admin/delivery-handoff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: record.id,
          status: record.status,
          phase: record.phase,
          branchName: record.branchName,
          productionUrl: record.productionUrl,
          previewUrl: record.previewUrl,
          runtimeGuide: record.runtimeGuide,
          databaseChoice: record.databaseChoice,
          lastBuildNote: record.lastBuildNote,
          latestVerification: record.latestVerification,
          verifiedAt: record.verifiedAt,
          mustCloseItems: record.mustCloseItems,
          deferredItems: record.deferredItems,
          notes: record.notes,
        }),
      })
      const json = (await res.json().catch(() => ({}))) as { record?: DeliveryHandoffRecord; error?: string }
      if (!res.ok || !json.record) {
        throw new Error(json.error || "交付包保存失败")
      }
      setDeliveryHandoffRecords((current) => current.map((item) => (item.id === record.id ? json.record! : item)))
      setStatusText(`${record.title} 已保存，4/07 前验收字段已同步更新。`)
    } catch (error: any) {
      setStatusText(error?.message || "交付包保存失败")
    } finally {
      setDeliveryHandoffSavingId("")
    }
  }

  const assetMap = useMemo(
    () =>
      Object.fromEntries(distributionAssets.map((asset) => [asset.id, asset])) as Record<string, ManagedDistributionAsset>,
    [distributionAssets]
  )

  const handoffSummary = useMemo(
    () =>
      deliveryHandoffRecords.map((record) => {
        const missingLabels = record.missingFields.map((field) => missingFieldLabels[field] ?? field)
        const progressState = toControlProgressState(record.status)
        return {
          ...record,
          missingLabels,
          progressState,
          mustCloseCount: missingLabels.length + record.mustCloseItems.length,
          deferredCount: record.deferredItems.length,
          readyForHandoff: progressState === "ready" && missingLabels.length === 0 && record.mustCloseItems.length === 0,
        }
      }),
    [deliveryHandoffRecords]
  )

  const platformBoard = useMemo(
    () =>
      platformControlMeta.map((item) => {
        const asset = assetMap[item.assetId]
        const progressState = toControlProgressState(asset?.status ?? "planned")
        return {
          ...item,
          asset,
          progressState,
          progressLabel: getControlProgressLabel(progressState),
          progressLabelZh: getControlProgressLabelZh(progressState),
        }
      }),
    [assetMap]
  )

  const latestCheckpoint = useMemo(() => {
    const timestamps = [
      ...handoffSummary.map((record) => record.verifiedAt),
      ...handoffSummary.map((record) => record.updatedAt),
      ...distributionAssets.map((asset) => asset.updatedAt),
    ]
      .filter(Boolean)
      .map((item) => Date.parse(String(item)))
      .filter((item) => Number.isFinite(item))

    if (!timestamps.length) return ""
    return new Date(Math.max(...timestamps)).toISOString()
  }, [distributionAssets, handoffSummary])

  const controlPlaneSummary = useMemo(() => {
    const readyPlatforms = platformBoard.filter((item) => item.progressState === "ready").length
    const blockedPlatforms = platformBoard.filter((item) => item.progressState === "blocked").length
    return {
      mustCloseCount: handoffSummary.reduce((total, record) => total + record.mustCloseCount, 0) + 1,
      deferredCount:
        handoffSummary.reduce((total, record) => total + record.deferredCount, 0) +
        sharedDeliveryCheckpoints.filter((item) => item.phase !== "2026-04-07 Web acceptance closure").length,
      readyHandoffs: handoffSummary.filter((record) => record.readyForHandoff).length,
      totalHandoffs: handoffSummary.length,
      readyPlatforms,
      pendingPlatforms: platformBoard.length - readyPlatforms - blockedPlatforms,
      blockedPlatforms,
      latestCheckpoint,
    }
  }, [handoffSummary, latestCheckpoint, platformBoard])

  const sharedCheckpointBoard = useMemo(
    () =>
      sharedDeliveryCheckpoints.map((item) => {
        if (item.id === "iterate_online_smoke") {
          const iterateNote = handoffSummary
            .map((record) => record.latestVerification)
            .find((value) => /iterate smoke|3103|current file|current page|current module/i.test(value))
          const passed = /passed|completed|verified|success/i.test(iterateNote ?? "")
          const failed = /failed|error|blocked/i.test(iterateNote ?? "")
          return {
            ...item,
            state: (passed ? "ready" : failed ? "blocked" : "pending") as ControlProgressState,
            latestVerification: iterateNote || item.latestVerification,
            updatedAt: passed || failed ? controlPlaneSummary.latestCheckpoint : "",
          }
        }

        return {
          ...item,
          state: "pending" as ControlProgressState,
          updatedAt: controlPlaneSummary.latestCheckpoint,
        }
      }),
    [controlPlaneSummary.latestCheckpoint, handoffSummary]
  )

  const webAcceptanceSummary = useMemo(() => {
    const mustCloseGaps = [
      ...handoffSummary.flatMap((record) => [
        ...(record.missingLabels.length ? [`${record.regionLabel}: ${record.missingLabels.join(" / ")}`] : []),
        ...record.mustCloseItems.map((item) => `${record.regionLabel}: ${item}`),
      ]),
      ...sharedCheckpointBoard
        .filter((item) => item.phase === "2026-04-07 Web acceptance closure" && item.state !== "ready")
        .map((item) => `${item.owner}线: ${item.title} - ${item.summary}`),
    ]

    const deferredGaps = [
      ...handoffSummary.flatMap((record) => record.deferredItems.map((item) => `${record.regionLabel}: ${item}`)),
      ...platformBoard
        .filter((item) => item.progressState !== "ready")
        .map((item) => `${item.title}: ${item.nextStep}`),
      ...sharedCheckpointBoard
        .filter((item) => item.phase !== "2026-04-07 Web acceptance closure")
        .map((item) => `${item.owner}线: ${item.title} - ${item.summary}`),
    ]

    return {
      mustCloseGaps,
      deferredGaps,
    }
  }, [handoffSummary, platformBoard, sharedCheckpointBoard])

  const assetLinks = [
    { label: "国际官网", value: siteLinks.websiteIntl, icon: Globe2 },
    { label: "国内官网", value: siteLinks.websiteCn, icon: Globe2 },
    { label: "文档中心", value: siteLinks.docs, icon: FileText },
    { label: "Android APK", value: assetMap.android_apk?.href || siteLinks.androidApk, icon: Smartphone },
    { label: "iOS App Store", value: assetMap.ios_store?.href || siteLinks.iosDownload, icon: Smartphone },
    { label: "iOS TestFlight", value: siteLinks.iosTestFlight, icon: QrCode },
  ]

  return (
    <div className="grid gap-6">
      <section className="rounded-3xl border border-border bg-card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <Badge variant="outline">/admin</Badge>
            <h1 className="mt-3 text-3xl font-semibold">运营、交付与内容资产中心</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              这里集中管理官网链接、交付收口、分发位状态和宣传内容生成，用于把 `/admin` 作为 2026-04-07 Web 验收与 2026-04-14 终验前的统一控制面。
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              intl 默认对外域名统一按 `https://www.mornscience.app/` 交付；旧 `mornhub` 域名若仍可访问，也视为同一个 Vercel 项目的 alias，而不是另一套独立系统。
            </p>
          </div>
          <div className="grid gap-2 text-sm text-muted-foreground">
            <div>官网聚合页：{siteLinks.marketCenter}</div>
            <div>后台控制台：{siteLinks.adminConsole}</div>
            <div>API Base：{siteLinks.apiBase}</div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>交付控制总览</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-border p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Must close by 4/07</div>
                <div className="mt-2 text-2xl font-semibold">{controlPlaneSummary.mustCloseCount}</div>
                <div className="mt-1 text-sm text-muted-foreground">仍需在 Web 验收前收口的关键项</div>
              </div>
              <div className="rounded-2xl border border-border p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Deferred after 4/07</div>
                <div className="mt-2 text-2xl font-semibold">{controlPlaneSummary.deferredCount}</div>
                <div className="mt-1 text-sm text-muted-foreground">留到多端 / 人工验证阶段的事项</div>
              </div>
              <div className="rounded-2xl border border-border p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Web handoff ready</div>
                <div className="mt-2 text-2xl font-semibold">
                  {controlPlaneSummary.readyHandoffs}/{controlPlaneSummary.totalHandoffs}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">国际版 / 国内版代码包已进入可交付状态</div>
              </div>
              <div className="rounded-2xl border border-border p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Platform slots</div>
                <div className="mt-2 text-2xl font-semibold">
                  {controlPlaneSummary.readyPlatforms}/{platformBoard.length}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  ready {controlPlaneSummary.readyPlatforms} · pending {controlPlaneSummary.pendingPlatforms} · blocked {controlPlaneSummary.blockedPlatforms}
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-border p-4">
              <div className="text-sm font-medium">最新验证时间</div>
              <div className="mt-2 text-sm text-muted-foreground">{formatTimestamp(controlPlaneSummary.latestCheckpoint)}</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>共享验证跑道</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {sharedCheckpointBoard.map((item) => (
              <div key={item.id} className="rounded-2xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{item.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{item.owner} 线 · {item.phase}</div>
                  </div>
                  <Badge variant={getControlProgressVariant(item.state)}>{getControlProgressLabel(item.state)}</Badge>
                </div>
                <div className="mt-3 text-sm text-muted-foreground">{item.summary}</div>
                <div className="mt-3 grid gap-1 text-xs text-muted-foreground">
                  <div>缺口归类：{item.gapCategory}</div>
                  <div>最近验证：{item.latestVerification}</div>
                  <div>下一步：{item.nextStep}</div>
                  <div>最近更新时间：{formatTimestamp(item.updatedAt)}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <WandSparkles className="h-5 w-5" />
              AI 生成宣传内容
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Input value={appName} onChange={(e) => setAppName(e.target.value)} placeholder="产品名" />
            <Input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="官网 URL" />
            <Input value={audience} onChange={(e) => setAudience(e.target.value)} placeholder="目标受众" />
            <textarea
              value={highlights}
              onChange={(e) => setHighlights(e.target.value)}
              className="min-h-36 rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="每行一个核心卖点"
            />
            <textarea
              value={references}
              onChange={(e) => setReferences(e.target.value)}
              className="min-h-28 rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="补充参考：品牌语气、参考产品、已有页面模块、行业关键词、希望重点呈现的场景"
            />
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleGeneratePromo} disabled={loading}>
                <Clapperboard className="mr-2 h-4 w-4" />
                {loading ? "生成中..." : "生成宣传视频脚本"}
              </Button>
              <Button variant="secondary" onClick={handleGenerateBundle} disabled={loading}>
                <FileText className="mr-2 h-4 w-4" />
                生成宣传文件夹
              </Button>
              <Button variant="outline" onClick={() => copyText(siteLinks.marketCenter)}>
                <Copy className="mr-2 h-4 w-4" />
                复制市场页 URL
              </Button>
            </div>
            {statusText ? <p className="text-sm text-muted-foreground">{statusText}</p> : null}
            <p className="text-xs text-muted-foreground">
              生成结果会同步到当前浏览器的 latest 宣传页，可直接打开网页查看总览、视频分镜页和 PPT 演示页。
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>对外展示资产</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {assetLinks.map((item) => {
              const Icon = item.icon
              return (
                <div key={item.label} className="rounded-2xl border border-border p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="rounded-xl bg-secondary p-2">
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium">{item.label}</div>
                        <div className="truncate text-sm text-muted-foreground">{item.value}</div>
                      </div>
                    </div>
                    <a href={item.value} target="_blank" rel="noreferrer">
                      <Button variant="outline" size="sm">
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </a>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>4.14 交付看板</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {DELIVERY_TRACKS.map((track) => (
              <div key={track.id} className="rounded-2xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium">{track.title}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{track.summary}</div>
                  </div>
                  <Badge variant={track.status === "ready" ? "secondary" : track.status === "blocked" ? "destructive" : "outline"}>
                    {getDeliveryStatusLabel(track.status, "zh")}
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
            <CardTitle>分发资源位</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {distributionAssets.map((asset) => {
              const platformMeta = platformBoard.find((item) => item.assetId === asset.id)
              return (
                <div key={asset.id} className="rounded-2xl border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-medium">{asset.title}</div>
                      {platformMeta ? <div className="mt-1 text-xs text-muted-foreground">{platformMeta.title} · {platformMeta.phase}</div> : null}
                      <div className="mt-2 text-xs text-muted-foreground">环境变量：{asset.envKey}</div>
                      <div className="mt-1 text-xs text-muted-foreground">公共路由：{asset.publicPath}</div>
                      <div className="mt-2 text-xs text-muted-foreground">更新面：{asset.updateSurface}</div>
                      <div className="mt-1 text-xs text-muted-foreground">最近验证：{platformMeta?.latestVerification ?? "pending"}</div>
                      <div className="mt-1 text-xs text-muted-foreground">下一步：{platformMeta?.nextStep ?? asset.notes[0] ?? "待补充"}</div>
                      <div className="mt-1 text-xs text-muted-foreground">缺口归类：{platformMeta?.gapCategory ?? "Distribution slot"}</div>
                      {asset.updatedAt ? <div className="mt-1 text-xs text-muted-foreground">最近更新：{formatTimestamp(asset.updatedAt)}</div> : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={getControlProgressVariant(toControlProgressState(asset.status))}>
                        {getControlProgressLabel(toControlProgressState(asset.status))}
                      </Badge>
                      <Badge variant={asset.status === "ready" ? "secondary" : asset.status === "blocked" ? "destructive" : "outline"}>
                        {getDeliveryStatusLabel(asset.status, "zh")}
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3">
                    <Input
                      value={asset.href}
                      onChange={(e) => updateDistributionAssetField(asset.id, "href", e.target.value)}
                      placeholder="https://cdn.example.com/app.apk"
                    />
                    <select
                      value={asset.status}
                      onChange={(e) => updateDistributionAssetField(asset.id, "status", e.target.value)}
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="planned">planned</option>
                      <option value="in_progress">in_progress</option>
                      <option value="ready">ready</option>
                      <option value="blocked">blocked</option>
                    </select>
                    <textarea
                      value={asset.notes.join("\n")}
                      onChange={(e) => updateDistributionAssetField(asset.id, "notes", e.target.value)}
                      className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm"
                      placeholder="每行一条交付说明"
                    />
                    <div className="flex flex-wrap justify-between gap-3">
                      <div className="text-xs text-muted-foreground break-all">{asset.href}</div>
                      <Button size="sm" onClick={() => handleSaveDistributionAsset(asset)} disabled={distributionSavingId === asset.id}>
                        {distributionSavingId === asset.id ? "保存中..." : "保存分发配置"}
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <CardHeader>
            <CardTitle>4/07 Web 验收缺口</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl border border-border p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Code packs</div>
                <div className="mt-2 text-2xl font-semibold">
                  {controlPlaneSummary.readyHandoffs}/{controlPlaneSummary.totalHandoffs}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">国际版 / 国内版交付字段与 must-close 状态</div>
              </div>
              <div className="rounded-2xl border border-border p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Must close</div>
                <div className="mt-2 text-2xl font-semibold">{webAcceptanceSummary.mustCloseGaps.length}</div>
                <div className="mt-1 text-sm text-muted-foreground">必须在 2026-04-07 前完成的 Web 项</div>
              </div>
              <div className="rounded-2xl border border-border p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Deferred</div>
                <div className="mt-2 text-2xl font-semibold">{webAcceptanceSummary.deferredGaps.length}</div>
                <div className="mt-1 text-sm text-muted-foreground">留到多端 / 人工验证阶段的项</div>
              </div>
              <div className="rounded-2xl border border-border p-4">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Latest checkpoint</div>
                <div className="mt-2 text-sm font-semibold">{formatTimestamp(controlPlaneSummary.latestCheckpoint)}</div>
                <div className="mt-1 text-sm text-muted-foreground">当前控制面记录到的最新验证时间</div>
              </div>
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-2xl border border-border p-4">
                <div className="text-sm font-medium">必须 4/07 前收口</div>
                {webAcceptanceSummary.mustCloseGaps.length ? (
                  <div className="mt-3 grid gap-2">
                    {webAcceptanceSummary.mustCloseGaps.map((gap) => (
                      <div key={gap} className="rounded-xl border border-border bg-secondary/20 px-3 py-2 text-sm text-foreground">
                        {gap}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-900">
                    当前 must-close Web 项已全部收口。
                  </div>
                )}
              </div>

              <div className="rounded-2xl border border-border p-4">
                <div className="text-sm font-medium">留到多端 / 人工阶段</div>
                {webAcceptanceSummary.deferredGaps.length ? (
                  <div className="mt-3 grid gap-2">
                    {webAcceptanceSummary.deferredGaps.map((gap) => (
                      <div key={gap} className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
                        {gap}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-3 rounded-xl border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
                    当前没有额外的 deferred 项。
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>国际版 / 国内版网页状态</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {handoffSummary.length ? handoffSummary.map((record) => (
              <div key={record.id} className="rounded-2xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{record.regionLabel}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{record.title}</div>
                    <div className="mt-2 text-xs text-muted-foreground">Phase: {record.phase}</div>
                    <div className="mt-1 text-xs text-muted-foreground">最近验证：{record.latestVerification || "pending"}</div>
                    <div className="mt-1 text-xs text-muted-foreground">验证时间：{formatTimestamp(record.verifiedAt)}</div>
                    <div className="mt-1 text-xs text-muted-foreground">更新时间：{formatTimestamp(record.updatedAt)}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant={record.readyForHandoff ? "secondary" : getControlProgressVariant(record.progressState)}>
                      {record.readyForHandoff ? "可交付" : getControlProgressLabel(record.progressState)}
                    </Badge>
                    <Badge variant={record.readyForHandoff ? "secondary" : record.status === "blocked" ? "destructive" : "outline"}>
                      {record.readyForHandoff ? "required closed" : record.statusLabelZh}
                    </Badge>
                  </div>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-muted-foreground">
                  <div>Branch: {record.branchName || "pending"}</div>
                  <div>Prod: {record.productionUrl || "pending"}</div>
                  <div>Preview: {record.previewUrl || "pending"}</div>
                  <div>Database: {record.databaseChoice || "pending"}</div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {record.missingLabels.length ? record.missingLabels.map((item) => (
                    <Badge key={item} variant="outline">{item}</Badge>
                  )) : (
                    <Badge variant="secondary">required fields complete</Badge>
                  )}
                </div>
                <div className="mt-4 grid gap-3 xl:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-secondary/20 p-3">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Must close</div>
                    <div className="mt-2 grid gap-2">
                      {record.mustCloseItems.length ? record.mustCloseItems.map((item) => (
                        <div key={item} className="rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground">
                          {item}
                        </div>
                      )) : (
                        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-900">
                          该 track 当前没有额外 must-close 项。
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border bg-background p-3">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Deferred</div>
                    <div className="mt-2 grid gap-2">
                      {record.deferredItems.length ? record.deferredItems.map((item) => (
                        <div key={item} className="rounded-xl border border-border bg-secondary/20 px-3 py-2 text-sm text-muted-foreground">
                          {item}
                        </div>
                      )) : (
                        <div className="rounded-xl border border-border px-3 py-2 text-sm text-muted-foreground">
                          当前没有额外 deferred 项。
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )) : (
              <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                网页交付状态正在初始化。
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>代码交付包</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {DELIVERY_CODEPACKS.map((pack) => (
              <div key={pack.id} className="rounded-2xl border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{pack.title}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{pack.summary}</div>
                    <div className="mt-2 text-xs text-muted-foreground">Doc: {pack.docPath}</div>
                    <div className="mt-1 text-xs text-muted-foreground break-all">入口：{pack.appEntry}</div>
                  </div>
                  <Badge variant={pack.status === "ready" ? "secondary" : "outline"}>{getDeliveryStatusLabel(pack.status, "zh")}</Badge>
                </div>
                <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                  <div>环境变量：{pack.envKeys.slice(0, 4).join(" / ")}</div>
                  <div>数据库：{pack.databaseNotes[0]}</div>
                  <div>分支说明：{pack.branchNotes[0]}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>套餐与资源限制</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {DELIVERY_PERMISSION_RULES.map((rule) => (
              <div key={rule.plan} className="rounded-2xl border border-border p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-medium uppercase">{rule.plan}</div>
                  <Badge variant={rule.status === "ready" ? "secondary" : "outline"}>{getDeliveryStatusLabel(rule.status, "zh")}</Badge>
                </div>
                <div className="mt-2 text-sm text-foreground">{rule.title}</div>
                <div className="mt-1 text-sm text-muted-foreground">{rule.summary}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>国际版 / 国内版代码交付包收口</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {deliveryHandoffRecords.length ? deliveryHandoffRecords.map((record) => (
            <div key={record.id} className="rounded-2xl border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{record.title}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{record.regionLabel} · commit {record.commitHash || "pending"}</div>
                  <div className="mt-1 text-xs text-muted-foreground">Phase: {record.phase || "pending"}</div>
                  <div className="mt-1 text-xs text-muted-foreground">最近验证：{record.latestVerification || "pending"}</div>
                  <div className="mt-1 text-xs text-muted-foreground">验证时间：{formatTimestamp(record.verifiedAt)}</div>
                  {record.updatedAt ? <div className="mt-1 text-xs text-muted-foreground">最近更新：{formatTimestamp(record.updatedAt)}</div> : null}
                </div>
                <Badge variant={record.status === "ready" ? "secondary" : record.status === "blocked" ? "destructive" : "outline"}>
                  {record.statusLabelZh}
                </Badge>
              </div>

              <div className="mt-4 grid gap-3 xl:grid-cols-2">
                <Input
                  value={record.phase}
                  onChange={(e) => updateDeliveryHandoffField(record.id, "phase", e.target.value)}
                  placeholder="2026-04-07 Web acceptance closure"
                />
                <Input
                  value={record.branchName}
                  onChange={(e) => updateDeliveryHandoffField(record.id, "branchName", e.target.value)}
                  placeholder="release branch"
                />
                <Input
                  value={record.productionUrl}
                  onChange={(e) => updateDeliveryHandoffField(record.id, "productionUrl", e.target.value)}
                  placeholder="https://product.example.com"
                />
                <Input
                  value={record.previewUrl}
                  onChange={(e) => updateDeliveryHandoffField(record.id, "previewUrl", e.target.value)}
                  placeholder="https://preview.example.com"
                />
                <Input
                  type="datetime-local"
                  value={toDateTimeLocal(record.verifiedAt)}
                  onChange={(e) => updateDeliveryHandoffField(record.id, "verifiedAt", fromDateTimeLocal(e.target.value))}
                  placeholder="Verification time"
                />
                <Input
                  value={record.databaseChoice}
                  onChange={(e) => updateDeliveryHandoffField(record.id, "databaseChoice", e.target.value)}
                  placeholder="Supabase / CloudBase / ..."
                />
                <Input
                  value={record.runtimeGuide}
                  onChange={(e) => updateDeliveryHandoffField(record.id, "runtimeGuide", e.target.value)}
                  placeholder="Runtime and deployment guide"
                />
                <Input
                  value={record.lastBuildNote}
                  onChange={(e) => updateDeliveryHandoffField(record.id, "lastBuildNote", e.target.value)}
                  placeholder="Latest build note"
                />
                <textarea
                  value={record.latestVerification}
                  onChange={(e) => updateDeliveryHandoffField(record.id, "latestVerification", e.target.value)}
                  className="min-h-24 rounded-md border border-input bg-background px-3 py-2 text-sm xl:col-span-2"
                  placeholder="最近一次验证说明"
                />
                <select
                  value={record.status}
                  onChange={(e) => updateDeliveryHandoffField(record.id, "status", e.target.value)}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm xl:col-span-2"
                >
                  <option value="planned">planned</option>
                  <option value="in_progress">in_progress</option>
                  <option value="ready">ready</option>
                    <option value="blocked">blocked</option>
                  </select>
                <textarea
                  value={record.mustCloseItems.join("\n")}
                  onChange={(e) => updateDeliveryHandoffField(record.id, "mustCloseItems", e.target.value)}
                  className="min-h-28 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="必须 4/07 前收口的缺口，每行一条"
                />
                <textarea
                  value={record.deferredItems.join("\n")}
                  onChange={(e) => updateDeliveryHandoffField(record.id, "deferredItems", e.target.value)}
                  className="min-h-28 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder="留到后续多端 / 人工阶段的缺口，每行一条"
                />
                <textarea
                  value={record.notes.join("\n")}
                  onChange={(e) => updateDeliveryHandoffField(record.id, "notes", e.target.value)}
                  className="min-h-28 rounded-md border border-input bg-background px-3 py-2 text-sm xl:col-span-2"
                  placeholder="每行一条交付说明"
                />
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  {record.missingFields.length ? record.missingFields.map((item) => (
                    <Badge key={item} variant="outline">{item}</Badge>
                  )) : (
                    <Badge variant="secondary">required fields complete</Badge>
                  )}
                </div>
                <Button size="sm" onClick={() => handleSaveDeliveryHandoff(record)} disabled={deliveryHandoffSavingId === record.id}>
                  {deliveryHandoffSavingId === record.id ? "保存中..." : "保存交付包"}
                </Button>
              </div>
            </div>
          )) : (
            <div className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              交付包收口记录正在初始化。
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>登录与支付迁移线</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="rounded-2xl border border-border p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium">{DELIVERY_AUTH_PAYMENT_MIGRATION.title}</div>
                <div className="mt-1 text-sm text-muted-foreground">{DELIVERY_AUTH_PAYMENT_MIGRATION.summary}</div>
                <div className="mt-2 text-xs text-muted-foreground">参考仓库：{DELIVERY_AUTH_PAYMENT_MIGRATION.sourceRepo}</div>
                <div className="mt-1 text-xs text-muted-foreground">验收文档：{DELIVERY_AUTH_PAYMENT_MIGRATION.docPath}</div>
              </div>
              <Badge variant={DELIVERY_AUTH_PAYMENT_MIGRATION.status === "ready" ? "secondary" : "outline"}>
                {getDeliveryStatusLabel(DELIVERY_AUTH_PAYMENT_MIGRATION.status, "zh")}
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

      {result ? (
        <Card>
          <CardHeader>
            <CardTitle>宣传视频分镜结果</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex flex-wrap gap-2 text-sm">
              <Badge variant="secondary">{result.output.status}</Badge>
              <Badge variant="outline">{result.output.aspectRatio}</Badge>
              <Badge variant="outline">{result.output.resolution}</Badge>
              <Badge variant="outline">{result.totalDurationSec}s</Badge>
            </div>
            <div className="grid gap-3">
              {result.scenes.map((scene, index) => (
                <div key={scene.title} className="rounded-2xl border border-border p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <div className="font-medium">
                      {index + 1}. {scene.title}
                    </div>
                    <Badge variant="outline">{scene.durationSec}s</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">画面：{scene.visual}</p>
                  <p className="mt-2 text-sm">旁白：{scene.voiceover}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {bundleResult ? (
        <Card>
          <CardHeader>
            <CardTitle>宣传文件夹产物</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="rounded-2xl border border-border p-4">
              <div className="text-sm font-medium">文件夹路径</div>
              <div className="mt-1 break-all text-sm text-muted-foreground">{bundleResult.folderPath}</div>
              <div className="mt-3 text-sm text-muted-foreground">Brand line: {bundleResult.bundle.brandLine}</div>
              {bundleResult.bundle.campaignTitle ? (
                <div className="mt-2 text-sm text-muted-foreground">Campaign: {bundleResult.bundle.campaignTitle}</div>
              ) : null}
              {bundleResult.bundle.visualDirection ? (
                <div className="mt-2 text-sm text-muted-foreground">Visual direction: {bundleResult.bundle.visualDirection}</div>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="secondary">{bundleResult.generator}</Badge>
                {bundleResult.files.map((file) => (
                  <Badge key={file} variant="outline">
                    {file}
                  </Badge>
                ))}
              </div>
            </div>
            {bundleResult.publicUrls ? (
              <div className="grid gap-3 rounded-2xl border border-border p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <Link2 className="h-4 w-4" />
                  可直接点击的公开预览
                </div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {[
                    { label: "固定 latest 预览", href: bundleResult.publicUrls.latestPreview },
                    { label: "固定 latest 视频页", href: bundleResult.publicUrls.latestVideoStoryboard },
                    { label: "固定 latest PPT 页", href: bundleResult.publicUrls.latestPptCopy },
                    { label: "老板预览页", href: bundleResult.publicUrls.preview },
                    { label: "视频分镜页", href: bundleResult.publicUrls.videoStoryboard },
                    { label: "PPT 成品页", href: bundleResult.publicUrls.pptCopy },
                    { label: "README", href: bundleResult.publicUrls.readme },
                    { label: "视频脚本", href: bundleResult.publicUrls.videoScript },
                    { label: "PPT 提纲", href: bundleResult.publicUrls.pptDeck },
                    { label: "Bundle JSON", href: bundleResult.publicUrls.bundleJson },
                    { label: "Brief JSON", href: bundleResult.publicUrls.briefJson },
                  ]
                    .filter((item) => item.href)
                    .map((item) => (
                      <Link
                        key={item.label}
                        href={item.href!}
                        target="_blank"
                        className="rounded-2xl border border-border p-4 transition hover:bg-secondary/40"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className="font-medium text-foreground">{item.label}</div>
                            <div className="mt-1 text-xs text-muted-foreground break-all">{item.href}</div>
                          </div>
                          <ExternalLink className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </Link>
                    ))}
                </div>
              </div>
            ) : null}
            <div className="rounded-2xl border border-border p-4 text-sm text-muted-foreground">
              生成结果会输出视频脚本、PPT 提纲、结构化 JSON 和网页预览页。当前线上 latest 页面会优先读取这台浏览器刚生成的最新宣传包，便于直接演示。
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  )
}
