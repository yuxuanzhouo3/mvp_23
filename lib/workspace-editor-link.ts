export const WORKSPACE_EDITOR_SOURCE_AI = "ai"

type WorkspaceEditorLinkOptions = {
  projectId: string
  filePath?: string | null
  symbol?: string | null
  element?: string | null
  line?: number | null
  source?: string | null
  pageId?: string | null
  route?: string | null
}

function normalizeValue(value?: string | null) {
  return String(value ?? "").trim()
}

export function buildWorkspaceEditorHref(options: WorkspaceEditorLinkOptions) {
  const params = new URLSearchParams()
  const filePath = normalizeValue(options.filePath)
  const symbol = normalizeValue(options.symbol)
  const element = normalizeValue(options.element)
  const source = normalizeValue(options.source)
  const pageId = normalizeValue(options.pageId)
  const route = normalizeValue(options.route)
  const line = Number(options.line ?? 0)

  if (filePath) params.set("file", filePath)
  if (symbol) params.set("symbol", symbol)
  if (element) params.set("element", element)
  if (Number.isFinite(line) && line > 0) params.set("line", String(line))
  if (source) params.set("from", source)
  if (pageId) params.set("page", pageId)
  if (route) params.set("route", route)

  const query = params.toString()
  return `/apps/${encodeURIComponent(options.projectId)}/editor${query ? `?${query}` : ""}`
}

export function isWorkspaceEditorAiSource(value?: string | null) {
  return normalizeValue(value).toLowerCase() === WORKSPACE_EDITOR_SOURCE_AI
}
