export type WorkspacePreviewState = {
  defaultMode: "static_ssr"
  activeMode: "static_ssr" | "dynamic_runtime" | "sandbox_runtime"
  status: "idle" | "building" | "ready" | "failed"
  canonicalUrl: string
  runtimeUrl: string
  sandboxUrl: string | null
  resolvedUrl?: string
  fallbackReason?: string
  sandboxExternalUrl?: string | null
  sandboxStatus: "stopped" | "starting" | "running" | "error"
  supportsDynamicRuntime: boolean
  supportsSandboxRuntime: boolean
  sandboxReadiness?: {
    supported: boolean
    reason: string
    authMode: "oidc" | "token" | "missing"
  }
}

export type WorkspaceRuntimeState = {
  status: "stopped" | "starting" | "running" | "error"
  mode?: "dev" | "prod"
  pid?: number
  port?: number
  url?: string
  lastError?: string
}

export type WorkspaceHistoryItem = {
  id: string
  type: "generate" | "iterate"
  prompt: string
  createdAt: string
  status: "done" | "error"
  summary?: string
  buildStatus?: "ok" | "failed" | "skipped"
  error?: string
}

export type WorkspaceProjectDetailSnapshot = {
  projectId: string
  projectSlug?: string
  createdAt: string
  updatedAt: string
  region: "cn" | "intl"
  deploymentTarget?: string
  databaseTarget?: string
  workspacePath: string
  spec?: {
    title?: string
    kind?: string
    planTier?: string
    modules?: string[]
    features?: string[]
    deploymentTarget?: string
    databaseTarget?: string
  } | null
  presentation?: {
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
  generation?: {
    status: "done" | "error" | "idle"
    summary: string
    buildStatus: "ok" | "failed" | "skipped" | null
    buildLogs?: string[]
    createdAt?: string | null
  }
  delivery?: {
    assignedDomain: string
    subdomainSlots: number
    generationProfile?: "starter" | "builder" | "premium" | "showcase"
    codeExportLevel?: "none" | "manifest" | "full"
    databaseAccessMode?: "online_only" | "managed_config" | "production_access" | "handoff_ready"
    projectLimit?: number
    collaboratorLimit?: number
    routeBudget?: number
    moduleBudget?: number
  }
  preview?: WorkspacePreviewState
  runtime?: WorkspaceRuntimeState
  history: WorkspaceHistoryItem[]
}

export type WorkspaceGenerateTaskSnapshot = {
  projectId?: string
  jobId: string
  status: "queued" | "running" | "done" | "error"
  logs?: string[]
  summary?: string
  contextSummary?: string
  workflowMode?: "act" | "discuss" | "edit_context"
  planner?: {
    workflowMode: "act" | "discuss" | "edit_context"
    productName: string
    productType: string
    archetype:
      | "code_platform"
      | "crm"
      | "api_platform"
      | "community"
      | "website_landing_download"
      | "healthcare"
      | "education"
      | "finance"
      | "recruiting"
      | "support"
      | "commerce_ops"
      | "admin_ops_internal_tool"
    summary: string
    pages: string[]
    routeMap?: string[]
    modules: string[]
    aiTools: string[]
    taskPlan?: string[]
    guardrails?: string[]
    constraints?: string[]
    deploymentTarget: string
    databaseTarget: string
  }
  acceptance?: {
    workflowMode: "act" | "discuss" | "edit_context"
    archetype:
      | "code_platform"
      | "crm"
      | "api_platform"
      | "community"
      | "website_landing_download"
      | "healthcare"
      | "education"
      | "finance"
      | "recruiting"
      | "support"
      | "commerce_ops"
      | "admin_ops_internal_tool"
    quality: "app_grade" | "demo_grade"
    buildStatus: "ok" | "failed" | "skipped"
    previewReadiness: "ready" | "planning_only" | "limited" | "blocked"
    routeCount: number
    moduleCount: number
    contextAnchored: boolean
    contextSummary?: string
    fallbackReason?: string
    criticalMissingPieces: string[]
  }
  changedFiles?: string[]
  buildStatus?: "ok" | "failed" | "skipped"
  buildLogs?: string[]
  templateTitle?: string
  error?: string
}

export type WorkspaceCodeEntrySnapshot = {
  content: string
  symbols?: Array<{ kind: string; name: string; line: number }>
}

export type WorkspaceBootstrapSnapshot = {
  projectId: string
  projectSlug?: string
  region: "cn" | "intl"
  createdAt: string
  updatedAt: string
  project: WorkspaceProjectDetailSnapshot
  generateTask?: WorkspaceGenerateTaskSnapshot | null
  codeFiles: string[]
  codeContents: Record<string, WorkspaceCodeEntrySnapshot>
  source: "server" | "workspace"
}

export const WORKSPACE_SNAPSHOT_STORAGE_KEY = "mornstack:workspace-snapshots"

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined"
}

function normalizeSnapshotList(raw: string | null) {
  if (!raw) return [] as WorkspaceBootstrapSnapshot[]
  try {
    const parsed = JSON.parse(raw) as WorkspaceBootstrapSnapshot[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function readWorkspaceSnapshots() {
  if (!canUseStorage()) return [] as WorkspaceBootstrapSnapshot[]
  return normalizeSnapshotList(window.localStorage.getItem(WORKSPACE_SNAPSHOT_STORAGE_KEY))
}

export function readWorkspaceSnapshot(projectId: string) {
  const normalizedProjectId = String(projectId ?? "").trim()
  if (!normalizedProjectId) return null
  return (
    readWorkspaceSnapshots().find((item) => item.projectId === normalizedProjectId || item.projectSlug === normalizedProjectId) ??
    null
  )
}

export function persistWorkspaceSnapshot(snapshot: WorkspaceBootstrapSnapshot) {
  if (!canUseStorage()) return
  const list = readWorkspaceSnapshots()
  const filtered = list.filter(
    (item) =>
      item.projectId !== snapshot.projectId &&
      item.projectSlug !== snapshot.projectId &&
      item.projectId !== snapshot.projectSlug &&
      item.projectSlug !== snapshot.projectSlug
  )
  window.localStorage.setItem(
    WORKSPACE_SNAPSHOT_STORAGE_KEY,
    JSON.stringify([{ ...snapshot, updatedAt: snapshot.updatedAt || new Date().toISOString() }, ...filtered].slice(0, 18))
  )
}
