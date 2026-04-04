import path from "path"
import { promises as fs } from "fs"
import { DELIVERY_DISTRIBUTION_ASSETS, type DeliveryDistributionAsset, type DeliveryStatus } from "@/lib/delivery-readiness"
import { ensureDir, getWorkspacesDir, writeTextFile } from "@/lib/project-workspace"

type DistributionAssetStoreRecord = {
  id: string
  href?: string
  status?: DeliveryStatus
  notes?: string[]
  updatedAt?: string
}

type DistributionAssetStore = {
  assets: Record<string, DistributionAssetStoreRecord>
}

const STORE_FILE = path.join(getWorkspacesDir(), "_distribution_assets.json")

function normalizeNotes(notes: unknown) {
  if (!Array.isArray(notes)) return undefined
  const normalized = notes.map((item) => String(item ?? "").trim()).filter(Boolean)
  return normalized.length ? normalized : undefined
}

async function readStore(): Promise<DistributionAssetStore> {
  await ensureDir(getWorkspacesDir())
  try {
    const raw = await fs.readFile(STORE_FILE, "utf8")
    const parsed = JSON.parse(raw) as DistributionAssetStore
    if (!parsed || typeof parsed !== "object" || !parsed.assets || typeof parsed.assets !== "object") {
      return { assets: {} }
    }
    return parsed
  } catch {
    return { assets: {} }
  }
}

async function writeStore(store: DistributionAssetStore) {
  await writeTextFile(STORE_FILE, JSON.stringify(store, null, 2))
}

export async function listDistributionAssets() {
  const store = await readStore()
  return DELIVERY_DISTRIBUTION_ASSETS.map((asset) => {
    const override = store.assets[asset.id]
    return {
      ...asset,
      href: String(override?.href ?? asset.href).trim() || asset.href,
      status: override?.status ?? asset.status,
      notes: normalizeNotes(override?.notes) ?? asset.notes,
      updatedAt: override?.updatedAt,
    } satisfies DeliveryDistributionAsset & { updatedAt?: string }
  })
}

export async function updateDistributionAsset(input: {
  id: string
  href?: string
  status?: DeliveryStatus
  notes?: string[]
}) {
  const id = String(input.id ?? "").trim()
  const base = DELIVERY_DISTRIBUTION_ASSETS.find((asset) => asset.id === id)
  if (!base) {
    throw new Error("Unknown distribution asset")
  }

  const nextStatus = input.status
  if (nextStatus && !["ready", "in_progress", "planned", "blocked"].includes(nextStatus)) {
    throw new Error("Invalid status")
  }

  const store = await readStore()
  const current = store.assets[id] ?? { id }
  const next: DistributionAssetStoreRecord = {
    ...current,
    id,
    href: String(input.href ?? current.href ?? base.href).trim() || base.href,
    status: nextStatus ?? current.status ?? base.status,
    notes: normalizeNotes(input.notes) ?? current.notes ?? base.notes,
    updatedAt: new Date().toISOString(),
  }
  store.assets[id] = next
  await writeStore(store)
  return (await listDistributionAssets()).find((asset) => asset.id === id) ?? null
}

export async function getDistributionAssetStorePath() {
  await ensureDir(getWorkspacesDir())
  return STORE_FILE
}
