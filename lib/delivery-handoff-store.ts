import path from "path"
import { promises as fs } from "fs"
import { getDeliveryStatusLabel, type DeliveryStatus } from "@/lib/delivery-readiness"
import { readGitMeta } from "@/lib/git-meta"
import { ensureDir, getWorkspacesDir, writeTextFile } from "@/lib/project-workspace"
import { siteLinks } from "@/lib/site-links"

export type DeliveryHandoffRecord = {
  id: "intl" | "cn"
  title: string
  regionLabel: string
  status: DeliveryStatus
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
}

type DeliveryHandoffStore = {
  records: Record<string, Partial<DeliveryHandoffRecord>>
}

const STORE_FILE = path.join(getWorkspacesDir(), "_delivery_handoff.json")

function normalizeNotes(notes: unknown) {
  if (!Array.isArray(notes)) return undefined
  const normalized = notes.map((item) => String(item ?? "").trim()).filter(Boolean)
  return normalized.length ? normalized : undefined
}

function normalizeIsoDate(value: unknown) {
  const normalized = String(value ?? "").trim()
  if (!normalized) return undefined
  const parsed = Date.parse(normalized)
  if (Number.isNaN(parsed)) return undefined
  return new Date(parsed).toISOString()
}

async function readStore(): Promise<DeliveryHandoffStore> {
  await ensureDir(getWorkspacesDir())
  try {
    const raw = await fs.readFile(STORE_FILE, "utf8")
    const parsed = JSON.parse(raw) as DeliveryHandoffStore
    if (!parsed || typeof parsed !== "object" || !parsed.records || typeof parsed.records !== "object") {
      return { records: {} }
    }
    return parsed
  } catch {
    return { records: {} }
  }
}

async function writeStore(store: DeliveryHandoffStore) {
  await writeTextFile(STORE_FILE, JSON.stringify(store, null, 2))
}

function getMissingFields(record: DeliveryHandoffRecord) {
  const missing: string[] = []
  if (!record.branchName.trim()) missing.push("branch")
  if (!record.productionUrl.trim()) missing.push("production_url")
  if (!record.previewUrl.trim()) missing.push("preview_url")
  if (!record.databaseChoice.trim()) missing.push("database")
  if (!record.lastBuildNote.trim()) missing.push("last_build")
  return missing
}

export async function listDeliveryHandoffs() {
  const store = await readStore()
  const gitMeta = await readGitMeta()
  const baselineVerifiedAt = "2026-04-06T10:30:00+08:00"

  const defaults: DeliveryHandoffRecord[] = [
    {
      id: "intl",
      title: "International web delivery pack",
      regionLabel: "INTL",
      status: "in_progress",
      phase: "2026-04-13 acceptance prep",
      branchName: gitMeta?.branch || "",
      commitHash: gitMeta?.commit || "",
      productionUrl: siteLinks.websiteIntl,
      previewUrl: siteLinks.bossDemo,
      runtimeGuide: "Next.js + one Vercel project + canonical intl public origin + preview / auth / payment callbacks on the same origin family",
      databaseChoice: "Supabase / Neon / managed Postgres (target login: Google + email)",
      lastBuildNote:
        "2026-04-06: latest Next build passed after plan-policy, preview/subdomain, auth-payment readiness, phone-OTP sandbox, and WeChat Pay readiness updates. Keep a fresh build note after the next generate/iterate smoke sweep.",
      latestVerification:
        "2026-04-06: the intl surface keeps Google + email as the target auth shape, build is green, and preview/subdomain/export policy are still aligned with the B-line workspace flow.",
      verifiedAt: baselineVerifiedAt,
      mustCloseItems: [
        "Confirm the final Vercel production URL and preview URL used for boss-demo review.",
        "Lock the release branch name used for the international handoff package.",
        "Complete one fresh generate + iterate smoke on the current branch and sync the note into /admin.",
        "Replace Google sandbox callback with the real OAuth exchange once the official keys are approved.",
      ],
      deferredItems: [
        "International Android packaging remains after the compressed Web closure.",
        "Real iOS and desktop package delivery can stay as managed distribution links until the multi-end window.",
      ],
      notes: [
        "Canonical intl public URL: https://www.mornscience.app/",
        "The older mornhub alias belongs to the same Vercel project but is no longer the delivery default",
        "Target intl auth shape is Google + email; current Google route is still sandbox/demo-social until real OAuth keys land",
        "Target intl payment shape is sandbox-first checkout during staging; real merchant secrets can be added later without changing the current checkout surface",
        "Keep Vercel env, callback URLs, and assigned-subdomain presentation aligned before 4/8 full online testing",
      ],
    },
    {
      id: "cn",
      title: "China web delivery pack",
      regionLabel: "CN",
      status: "in_progress",
      phase: "2026-04-13 acceptance prep",
      branchName: gitMeta?.branch || "",
      commitHash: gitMeta?.commit || "",
      productionUrl: siteLinks.websiteCn,
      previewUrl: siteLinks.bossDemo,
      runtimeGuide: "Next.js + Tencent Cloud / CloudBase-facing host + domestic service split + same-origin preview/payment callback strategy",
      databaseChoice: "CloudBase document or mainland-hosted database (target login: phone verification code + email)",
      lastBuildNote: "2026-04-06: latest Next build passed after China phone-OTP sandbox login and WeChat Pay readiness updates.",
      latestVerification:
        "2026-04-06: China delivery stays on the same admin/download registry, phone verification sandbox is wired, and WeChat Pay can already create/query/update orders with the current merchant credentials.",
      verifiedAt: baselineVerifiedAt,
      mustCloseItems: [
        "Confirm the final Tencent Cloud production URL that will be handed off on 2026-04-13.",
        "Confirm the final China preview URL used for review.",
        "Lock the China-facing release branch name for handoff.",
        "Run one current-branch payment smoke with WeChat Pay staging credentials and record the result.",
        "Keep the phone verification sandbox path ready to swap to the real SMS provider without UI changes.",
      ],
      deferredItems: [
        "WeChat login remains optional after the primary phone verification path is approved.",
        "WeChat Pay webhook signature verification becomes complete once the platform public key and serial are available.",
        "Android real-device payment verification remains a follow-up item after the compressed Web closure.",
      ],
      notes: [
        "Primary CN login target is phone verification code + email; the current implementation is sandbox-first until SMS provider credentials land",
        "Current WeChat Pay credentials are already present locally and should be mirrored to Tencent Cloud env at deployment time",
        "Keep the domestic database choice explicit in the final handoff sheet",
        "Keep Alipay and WeChat Pay visible as the domestic checkout pair during acceptance prep",
      ],
    },
  ]

  return defaults.map((item) => {
    const override = store.records[item.id] ?? {}
    const merged: DeliveryHandoffRecord = {
      ...item,
      ...override,
      notes: normalizeNotes(override.notes) ?? item.notes,
      mustCloseItems: normalizeNotes(override.mustCloseItems) ?? item.mustCloseItems,
      deferredItems: normalizeNotes(override.deferredItems) ?? item.deferredItems,
      phase: String(override.phase ?? item.phase).trim() || item.phase,
      latestVerification: String(override.latestVerification ?? item.latestVerification).trim() || item.latestVerification,
      verifiedAt: normalizeIsoDate(override.verifiedAt) ?? item.verifiedAt,
      updatedAt: typeof override.updatedAt === "string" ? override.updatedAt : undefined,
      status: (override.status as DeliveryStatus | undefined) ?? item.status,
    }
    return {
      ...merged,
      missingFields: getMissingFields(merged),
      statusLabelZh: getDeliveryStatusLabel(merged.status, "zh"),
      statusLabelEn: getDeliveryStatusLabel(merged.status, "en"),
    }
  })
}

export async function updateDeliveryHandoff(input: {
  id: "intl" | "cn"
  status?: DeliveryStatus
  phase?: string
  branchName?: string
  productionUrl?: string
  previewUrl?: string
  runtimeGuide?: string
  databaseChoice?: string
  lastBuildNote?: string
  latestVerification?: string
  verifiedAt?: string
  mustCloseItems?: string[]
  deferredItems?: string[]
  notes?: string[]
}) {
  const id = input.id
  const store = await readStore()
  const current = store.records[id] ?? {}
  store.records[id] = {
    ...current,
    id,
    status: input.status ?? current.status,
    phase: String(input.phase ?? current.phase ?? "").trim(),
    branchName: String(input.branchName ?? current.branchName ?? "").trim(),
    productionUrl: String(input.productionUrl ?? current.productionUrl ?? "").trim(),
    previewUrl: String(input.previewUrl ?? current.previewUrl ?? "").trim(),
    runtimeGuide: String(input.runtimeGuide ?? current.runtimeGuide ?? "").trim(),
    databaseChoice: String(input.databaseChoice ?? current.databaseChoice ?? "").trim(),
    lastBuildNote: String(input.lastBuildNote ?? current.lastBuildNote ?? "").trim(),
    latestVerification: String(input.latestVerification ?? current.latestVerification ?? "").trim(),
    verifiedAt: normalizeIsoDate(input.verifiedAt ?? current.verifiedAt),
    mustCloseItems: normalizeNotes(input.mustCloseItems) ?? normalizeNotes(current.mustCloseItems) ?? [],
    deferredItems: normalizeNotes(input.deferredItems) ?? normalizeNotes(current.deferredItems) ?? [],
    notes: normalizeNotes(input.notes) ?? normalizeNotes(current.notes) ?? [],
    updatedAt: new Date().toISOString(),
  }
  await writeStore(store)
  return (await listDeliveryHandoffs()).find((item) => item.id === id) ?? null
}
