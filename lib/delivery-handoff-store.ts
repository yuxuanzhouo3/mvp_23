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
  const baselineVerifiedAt = "2026-04-03T00:41:35+08:00"

  const defaults: DeliveryHandoffRecord[] = [
    {
      id: "intl",
      title: "International web delivery pack",
      regionLabel: "INTL",
      status: "in_progress",
      phase: "2026-04-07 Web acceptance closure",
      branchName: gitMeta?.branch || "",
      commitHash: gitMeta?.commit || "",
      productionUrl: siteLinks.websiteIntl,
      previewUrl: siteLinks.bossDemo,
      runtimeGuide: "Next.js + one Vercel project + canonical intl public origin https://www.mornscience.app/",
      databaseChoice: "Supabase / Neon / managed Postgres",
      lastBuildNote:
        "2026-04-03: live /api/iterate smoke suite (explain + generate + fix + refactor) passed on port 3103 for project_1774869442252 and stayed anchored to app/editor/page.tsx. The sample workspace still reported pre-existing build failures during generate/fix/refactor.",
      latestVerification:
        "2026-04-03: live /api/iterate explain/generate/fix/refactor smoke passed on port 3103. The online chain stayed anchored to app/editor/page.tsx on /editor, preserved current-file/current-page/current-module priority, and kept the build-failed sample-workspace state separate from the context-priority verification.",
      verifiedAt: baselineVerifiedAt,
      mustCloseItems: [
        "Confirm the final international preview URL used for boss-demo review.",
        "Lock the release branch name used for the international handoff package.",
        "Keep the recorded iterate smoke note aligned between /admin and the final handoff docs if the B-line prompt/context strategy changes again.",
      ],
      deferredItems: [
        "International Android packaging remains after the compressed Web closure.",
        "Real iOS and desktop package delivery can stay as managed distribution links until the multi-end window.",
      ],
      notes: [
        "Canonical intl public URL: https://www.mornscience.app/",
        "The older mornhub alias belongs to the same Vercel project but is no longer the delivery default",
        "Live iterate smoke suite passed on 2026-04-03 and confirmed editor-context priority online",
        "Generate / fix / refactor all stayed anchored to app/editor/page.tsx on /editor",
        "The smoke workspace still has pre-existing build failures, so sample-workspace build cleanup remains separate from the context verification",
        "Confirm the final auth + payment provider setup",
      ],
    },
    {
      id: "cn",
      title: "China web delivery pack",
      regionLabel: "CN",
      status: "in_progress",
      phase: "2026-04-07 Web acceptance closure",
      branchName: gitMeta?.branch || "",
      commitHash: gitMeta?.commit || "",
      productionUrl: siteLinks.websiteCn,
      previewUrl: siteLinks.bossDemo,
      runtimeGuide: "Next.js + China-facing host + domestic service split",
      databaseChoice: "CloudBase document or mainland-hosted database",
      lastBuildNote: "Latest local pnpm build passed",
      latestVerification:
        "2026-04-02: local pnpm build compiled successfully; CN delivery stays on the same admin/download registry, but domestic runtime/database and payment-smoke wording still need final closure.",
      verifiedAt: baselineVerifiedAt,
      mustCloseItems: [
        "Confirm the final China production URL that will be handed off on 2026-04-07.",
        "Confirm the final China preview URL used for review.",
        "Lock the China-facing release branch name for handoff.",
        "Record the latest successful build and payment-smoke note for the China track.",
      ],
      deferredItems: [
        "WeChat login remains phase 2 until the credentials are approved.",
        "WeChat Pay remains phase 2 until merchant configuration is ready.",
        "Android real-device payment verification remains a follow-up item after the compressed Web closure.",
      ],
      notes: [
        "Confirm the domestic database choice in the final handoff sheet",
        "Keep WeChat login/pay marked as phase 2 until credentials are ready",
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
