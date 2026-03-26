export type PreviewMode = "static_ssr" | "dynamic_runtime" | "sandbox_runtime"

const RUNTIME_PREVIEW_ROOT_SEGMENT = "__preview_root__"

type BuildPreviewUrlArgs = {
  projectId: string
  page?: string | null
  mode?: PreviewMode
}

function normalizeProjectId(projectId: string) {
  return String(projectId).replace(/[^a-zA-Z0-9_-]/g, "")
}

function normalizePage(page?: string | null) {
  const value = String(page ?? "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
  return value === "index" ? "" : value
}

export function buildCanonicalPreviewUrl(projectId: string, page?: string | null) {
  const safeId = encodeURIComponent(normalizeProjectId(projectId))
  const safePage = normalizePage(page)
  return safePage ? `/preview/${safeId}/${safePage}` : `/preview/${safeId}`
}

export function buildRuntimePreviewUrl(projectId: string, page?: string | null) {
  const safeId = encodeURIComponent(normalizeProjectId(projectId))
  const safePage = normalizePage(page)
  return safePage
    ? `/api/projects/${safeId}/preview/${safePage}`
    : `/api/projects/${safeId}/preview/${RUNTIME_PREVIEW_ROOT_SEGMENT}`
}

export function buildSandboxPreviewUrl(projectId: string, page?: string | null) {
  const safeId = encodeURIComponent(normalizeProjectId(projectId))
  const safePage = normalizePage(page)
  return safePage ? `/api/preview-runtime/${safeId}/${safePage}` : `/api/preview-runtime/${safeId}`
}

export function buildPreviewUrl({ projectId, page, mode = "static_ssr" }: BuildPreviewUrlArgs) {
  if (mode === "dynamic_runtime") {
    return buildRuntimePreviewUrl(projectId, page)
  }
  if (mode === "sandbox_runtime") {
    return buildSandboxPreviewUrl(projectId, page)
  }
  return buildCanonicalPreviewUrl(projectId, page)
}

export function isRuntimePreviewRootSegment(segment?: string | null) {
  return String(segment ?? "") === RUNTIME_PREVIEW_ROOT_SEGMENT
}
