export type PreviewSnapshotSpec = {
  title?: string
  kind?: string
  planTier?: string
  modules?: string[]
  features?: string[]
  deploymentTarget?: string
  databaseTarget?: string
} | null

export type PreviewSnapshotDelivery = {
  assignedDomain?: string
  subdomainSlots?: number
  generationProfile?: "starter" | "builder" | "premium" | "showcase"
  codeExportLevel?: "none" | "manifest" | "full"
  databaseAccessMode?: "online_only" | "managed_config" | "production_access" | "handoff_ready"
  projectLimit?: number
  collaboratorLimit?: number
  routeBudget?: number
  moduleBudget?: number
} | null

export type PreviewSnapshotPresentation = {
  displayName: string
  subtitle: string
  summary: string
  routes: string[]
  icon: {
    glyph: string
    from: string
    to: string
    ring: string
  }
}

export type PreviewSnapshotHistoryItem = {
  createdAt: string
  summary?: string
  status: "done" | "error"
  type: "generate" | "iterate"
}

export type PreviewSnapshot = {
  projectId: string
  projectSlug: string
  region: "cn" | "intl"
  spec: PreviewSnapshotSpec
  delivery?: PreviewSnapshotDelivery
  presentation: PreviewSnapshotPresentation
  history: PreviewSnapshotHistoryItem[]
  updatedAt: string
  source: "server" | "workspace"
}

export const PREVIEW_SNAPSHOT_STORAGE_KEY = "mornstack:preview-snapshots"

export function slugifyPreviewKey(input?: string | null) {
  return String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function buildPreviewSnapshotAliases(snapshot: PreviewSnapshot) {
  const aliases = new Set<string>()
  aliases.add(snapshot.projectId)
  if (snapshot.projectSlug) aliases.add(snapshot.projectSlug)
  const displaySlug = slugifyPreviewKey(snapshot.presentation.displayName)
  if (displaySlug) aliases.add(displaySlug)
  return Array.from(aliases)
}
