import path from "path"
import { promises as fs } from "fs"
import { spawn } from "child_process"
import { NextResponse } from "next/server"
import {
  appendProjectHistory,
  ensureDir,
  getProject,
  resolveProjectPath,
  safeProjectId,
  type Region,
} from "@/lib/project-workspace"
import { requestJsonChatCompletion, resolveAiConfig } from "@/lib/ai-provider"
import {
  applyPromptToSpec,
  buildSpecDrivenWorkspaceFiles,
  createAppSpec,
  readProjectSpec,
} from "@/lib/project-spec"
import {
  buildCodePlatformContextRoutes,
  inferCodePlatformElementContext,
  inferCodePlatformModuleContext,
  inferCodePlatformPageContext,
  type WorkspaceElementContext,
  type WorkspaceModuleContext,
  type WorkspacePageContext,
  type WorkspaceSessionContext,
  type WorkspaceSymbolRef,
} from "@/lib/workspace-ai-context"

export const runtime = "nodejs"

type ModelFileEdit = {
  path: string
  content: string
  reason?: string
}

type IterateMode = "explain" | "fix" | "generate" | "refactor"

type EditorRequestContext = {
  currentFilePath?: string
  currentFileContent?: string
  currentFileSymbols?: WorkspaceSymbolRef[]
  focusedLine?: number
  currentRoute?: string
  relatedPaths?: string[]
  currentPage?: WorkspacePageContext
  currentModule?: WorkspaceModuleContext
  currentElement?: WorkspaceElementContext
  sharedSession?: WorkspaceSessionContext
  openTabs?: string[]
}

type IterateResolvedContext = {
  currentFilePath?: string
  currentRoute?: string
  focusedLine?: number
  currentFileSymbols?: WorkspaceSymbolRef[]
  currentPage?: WorkspacePageContext
  currentModule?: WorkspaceModuleContext
  currentElement?: WorkspaceElementContext
  sharedSession?: WorkspaceSessionContext
  openTabs?: string[]
  relatedPaths?: string[]
}

type ModelOutput = {
  summary: string
  analysis?: string
  files?: ModelFileEdit[]
  reasoning?: string
}

function normalizeIterateMode(input: unknown): IterateMode {
  const value = String(input ?? "").trim().toLowerCase()
  if (value === "explain" || value === "fix" || value === "refactor") return value
  return "generate"
}

function sanitizeUiText(input: string) {
  return input.replace(/[<>`{}]/g, "").trim()
}

function hasIntent(prompt: string, patterns: RegExp[]) {
  return patterns.some((re) => re.test(prompt))
}

function extractTargetTitle(prompt: string) {
  const patterns = [
    /(?:\u4fee\u6539|\u66f4\u6539|\u6539)(?:\u9875\u9762)?(?:\u4e3b)?\u6807\u9898(?:\u4e3a|\u6539\u4e3a|\u6539\u6210|:|\uff1a)?\s*["“]?([^"\n”]+)["”]?/i,
    /(?:set|change|update)\s+title\s+(?:to)?\s*["“]?([^"\n”]+)["”]?/i,
  ]
  for (const re of patterns) {
    const m = prompt.match(re)
    if (m?.[1]) {
      const safe = sanitizeUiText(m[1])
      if (safe) return safe
    }
  }
  return null
}

function isChineseUiRequest(prompt: string) {
  return hasIntent(prompt, [/\u4e2d\u6587/, /\u6c49\u5316/, /\u7b80\u4f53/, /chinese/i, /localiz/i])
}

function isDescriptionFieldRequest(prompt: string) {
  return hasIntent(prompt, [/\u63cf\u8ff0/, /\u8be6\u60c5/, /description/i, /detail/i])
}

function isBlockedColumnRequest(prompt: string) {
  return hasIntent(prompt, [/\u963b\u585e/, /\u5361\u4f4f/, /blocked/i, /block column/i])
}

function isAboutPageRequest(prompt: string) {
  return hasIntent(prompt, [
    /\u65b0\u589e\u9875\u9762/,
    /\u65b0\u5efa\u9875\u9762/,
    /\u5173\u4e8e\u9875/,
    /\u65b0\u589e.*about/i,
    /about.*\u9875\u9762/i,
    /about page/i,
    /new page/i,
  ])
}

function isAssigneeFilterRequest(prompt: string) {
  return hasIntent(prompt, [/\u7b5b\u9009/, /\u8fc7\u6ee4/, /filter/i, /assignee filter/i])
}

function normalizePath(p: string) {
  return p.replace(/\\/g, "/").replace(/^\/+/, "")
}

function toSafeSlug(input: string) {
  const cleaned = input
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5\s-_]/g, " ")
    .trim()
  if (!cleaned) return "new-page"
  const pinyinLike = cleaned
    .replace(/[\u4e00-\u9fa5]/g, " page ")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
  return pinyinLike || "new-page"
}

function extractNewPageName(prompt: string) {
  const patterns = [
    /(?:新增|新建|添加)\s*([a-zA-Z0-9\u4e00-\u9fa5\-_ ]{1,30})\s*页面/i,
    /(?:add|create)\s+([a-zA-Z0-9\-_ ]{1,30})\s+page/i,
  ]
  for (const re of patterns) {
    const m = prompt.match(re)
    if (m?.[1]) return sanitizeUiText(m[1]).trim()
  }
  return null
}

function isAllowedFile(relativePath: string) {
  const normalized = normalizePath(relativePath)
  if (!normalized || normalized.includes("..")) {
    return false
  }
  if (normalized.startsWith("node_modules/") || normalized.startsWith(".next/") || normalized.startsWith(".git/")) {
    return false
  }
  return true
}

async function pathExists(filePath: string) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function collectContextFiles(rootDir: string) {
  const out: string[] = []
  const allowedExt = new Set([".ts", ".tsx", ".js", ".jsx", ".json", ".md", ".css", ".prisma"])

  async function walk(currentDir: string) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name)
      const relative = normalizePath(path.relative(rootDir, fullPath))
      if (!relative) continue
      if (!isAllowedFile(relative)) continue
      if (entry.isDirectory()) {
        await walk(fullPath)
        continue
      }
      if (!allowedExt.has(path.extname(entry.name))) continue
      out.push(relative)
      if (out.length >= 60) return
    }
  }

  await walk(rootDir)
  return out
}

function normalizeContextPath(value?: string | null) {
  const normalized = normalizePath(String(value ?? ""))
  return isAllowedFile(normalized) ? normalized : ""
}

function uniqueContextPaths(input: Array<string | undefined | null>) {
  const seen = new Set<string>()
  const out: string[] = []
  for (const item of input) {
    const normalized = normalizeContextPath(item)
    if (!normalized || seen.has(normalized)) continue
    seen.add(normalized)
    out.push(normalized)
  }
  return out
}

function normalizeTextValue(value: unknown) {
  return sanitizeUiText(String(value ?? "")).trim()
}

function normalizeContextSymbols(value: unknown): WorkspaceSymbolRef[] {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => {
      const symbol = item as Record<string, unknown>
      const kind = normalizeTextValue(symbol?.kind)
      const name = normalizeTextValue(symbol?.name)
      const line = Number(symbol?.line ?? 0)
      if (!kind || !name || !Number.isFinite(line) || line <= 0) return null
      return { kind, name, line }
    })
    .filter((item): item is WorkspaceSymbolRef => Boolean(item))
}

function normalizePageContext(value: unknown): WorkspacePageContext | undefined {
  if (!value || typeof value !== "object") return undefined
  const page = value as Record<string, unknown>
  const id = normalizeTextValue(page.id).toLowerCase()
  const label = normalizeTextValue(page.label)
  const route = String(page.route ?? "").trim()
  const filePath = normalizeContextPath(String(page.filePath ?? ""))
  const focus = normalizeTextValue(page.focus)
  const symbols = Array.isArray(page.symbols) ? page.symbols.map((item) => normalizeTextValue(item)).filter(Boolean) : []
  const elements = Array.isArray(page.elements) ? page.elements.map((item) => normalizeTextValue(item)).filter(Boolean) : []
  if (!id && !label && !route && !filePath) return undefined
  return {
    id: id || "workspace",
    label: label || id || "Workspace",
    route: route || "/",
    filePath,
    focus,
    symbols,
    elements,
  }
}

function normalizeModuleContext(value: unknown): WorkspaceModuleContext | undefined {
  if (!value || typeof value !== "object") return undefined
  const module = value as Record<string, unknown>
  const name = normalizeTextValue(module.name)
  if (!name) return undefined
  const source = String(module.source ?? "page")
  const relatedSymbols = Array.isArray(module.relatedSymbols)
    ? module.relatedSymbols.map((item) => normalizeTextValue(item)).filter(Boolean)
    : []
  return {
    name,
    source: source === "symbol" || source === "file" ? source : "page",
    relatedSymbols,
  }
}

function normalizeElementContext(value: unknown): WorkspaceElementContext | undefined {
  if (!value || typeof value !== "object") return undefined
  const element = value as Record<string, unknown>
  const name = normalizeTextValue(element.name)
  if (!name) return undefined
  const source = String(element.source ?? "page")
  const detail = normalizeTextValue(element.detail)
  const options = Array.isArray(element.options)
    ? element.options.map((item) => normalizeTextValue(item)).filter(Boolean)
    : []
  return {
    name,
    source:
      source === "explicit" || source === "editor_rail" || source === "output_panel"
        ? source
        : "page",
    options,
    detail: detail || undefined,
  }
}

function normalizeSessionContext(value: unknown, region: Region): WorkspaceSessionContext | undefined {
  if (!value || typeof value !== "object") return undefined
  const session = value as Record<string, unknown>
  return {
    projectName: normalizeTextValue(session.projectName) || undefined,
    specKind: normalizeTextValue(session.specKind) || undefined,
    workspaceSurface: normalizeTextValue(session.workspaceSurface) || undefined,
    activeSection: normalizeTextValue(session.activeSection) || undefined,
    deploymentTarget: normalizeTextValue(session.deploymentTarget) || undefined,
    databaseTarget: normalizeTextValue(session.databaseTarget) || undefined,
    region: session.region === "cn" || session.region === "intl" ? (session.region as Region) : region,
    selectedTemplate: normalizeTextValue(session.selectedTemplate) || undefined,
    workspaceStatus: normalizeTextValue(session.workspaceStatus) || undefined,
  }
}

function prioritizeContextFiles(files: string[], context: EditorRequestContext) {
  const priority = uniqueContextPaths([
    context.currentFilePath,
    context.currentPage?.filePath,
    ...(context.openTabs ?? []),
    ...(context.relatedPaths ?? []),
  ])
  const remainder = files.filter((file) => !priority.includes(file))
  return [...priority, ...remainder]
}

function buildExplainFallback(prompt: string, context: EditorRequestContext, region: Region): ModelOutput {
  const filePath = normalizeContextPath(context.currentFilePath)
  const symbols = Array.isArray(context.currentFileSymbols) ? context.currentFileSymbols : []
  const focusedLine =
    typeof context.focusedLine === "number" && Number.isFinite(context.focusedLine) && context.focusedLine > 0
      ? context.focusedLine
      : null
  const route = String(context.currentRoute ?? "").trim()
  const pageLabel = context.currentPage?.label || ""
  const pageFocus = context.currentPage?.focus || ""
  const moduleName = context.currentModule?.name || ""
  const elementName = context.currentElement?.name || ""
  const sessionSurface = context.sharedSession?.workspaceSurface || ""
  const sessionSection = context.sharedSession?.activeSection || ""
  const summary = filePath
    ? region === "cn"
      ? `已解释当前文件 ${filePath} 的职责与修改方向。`
      : `Explained the current file ${filePath} and the best next changes.`
    : region === "cn"
      ? "已解释当前页面/模块的职责与修改方向。"
      : "Explained the current page/module and the best next changes."

  const analysisLines = [
    filePath
      ? region === "cn"
        ? `当前文件：${filePath}`
        : `Current file: ${filePath}`
      : region === "cn"
        ? "当前文件：未提供，已回退为页面级解释。"
        : "Current file: not provided, so the explanation falls back to page level.",
    route
      ? region === "cn"
        ? `当前路由：${route}`
        : `Current route: ${route}`
      : "",
    pageLabel
      ? region === "cn"
        ? `当前页面：${pageLabel}`
        : `Current page: ${pageLabel}`
      : "",
    pageFocus
      ? region === "cn"
        ? `页面焦点：${pageFocus}`
        : `Page focus: ${pageFocus}`
      : "",
    moduleName
      ? region === "cn"
        ? `当前模块：${moduleName}`
        : `Current module: ${moduleName}`
      : "",
    elementName
      ? region === "cn"
        ? `当前元素：${elementName}`
        : `Current element: ${elementName}`
      : "",
    sessionSurface || sessionSection
      ? region === "cn"
        ? `工作区会话：${[sessionSurface, sessionSection].filter(Boolean).join(" / ")}`
        : `Workspace session: ${[sessionSurface, sessionSection].filter(Boolean).join(" / ")}`
      : "",
    focusedLine
      ? region === "cn"
        ? `当前焦点行：第 ${focusedLine} 行`
        : `Focused line: ${focusedLine}`
      : "",
    symbols.length
      ? region === "cn"
        ? `当前文件识别到 ${symbols.length} 个符号，可优先围绕这些结构解释与拆分。`
        : `Detected ${symbols.length} symbols in the current file, which are good anchors for explanation and refactoring.`
      : region === "cn"
        ? "当前文件没有识别到显式符号，说明它可能更偏页面布局或配置入口。"
        : "No explicit symbols were detected, which usually means this file is more layout- or config-oriented.",
    region === "cn"
      ? `用户当前意图：${prompt}`
      : `Current user intent: ${prompt}`,
    region === "cn"
      ? "下一步建议：如果你想要我继续改代码，请切换到 fix / generate / refactor 任一模式，我会基于当前文件继续执行。"
      : "Suggested next step: switch to fix, generate, or refactor to keep working directly against this file.",
  ].filter(Boolean)

  return {
    summary,
    analysis: analysisLines.join("\n"),
    reasoning: analysisLines.join("\n"),
    files: [],
  }
}

async function resolveEditorContext(
  projectDir: string,
  body: any,
  region: Region
): Promise<EditorRequestContext> {
  const projectSpec = await readProjectSpec(projectDir)
  const specRegion = projectSpec?.region === "cn" ? "cn" : region
  const currentFileSymbols = normalizeContextSymbols(body?.currentFileSymbols)
  const context: EditorRequestContext = {
    currentFilePath: normalizeContextPath(body?.currentFilePath),
    currentFileContent: typeof body?.currentFileContent === "string" ? body.currentFileContent : undefined,
    currentFileSymbols,
    focusedLine: typeof body?.focusedLine === "number" ? body.focusedLine : undefined,
    currentRoute: typeof body?.currentRoute === "string" ? body.currentRoute : undefined,
    relatedPaths: Array.isArray(body?.relatedPaths) ? body.relatedPaths.map((item: unknown) => String(item)) : undefined,
    openTabs: Array.isArray(body?.openTabs) ? body.openTabs.map((item: unknown) => String(item)) : undefined,
  }

  const routes = buildCodePlatformContextRoutes({
    region: specRegion,
    features: Array.isArray(projectSpec?.features) ? projectSpec.features.filter((item): item is string => typeof item === "string") : [],
  })

  const currentPage =
    normalizePageContext(body?.currentPage) ??
    inferCodePlatformPageContext({
      routes,
      region: specRegion,
      currentFilePath: context.currentFilePath,
      currentRoute: context.currentRoute,
      activeSection: normalizeTextValue(body?.sharedSession?.activeSection),
      previewTab: normalizeTextValue(body?.sharedSession?.workspaceSurface),
    })

  const currentModule =
    normalizeModuleContext(body?.currentModule) ??
    inferCodePlatformModuleContext({
      currentFilePath: context.currentFilePath,
      currentFileSymbols,
      currentPage,
      activeSymbolName: normalizeTextValue(body?.currentModule?.name),
    })

  const currentElement =
    normalizeElementContext(body?.currentElement) ??
    inferCodePlatformElementContext({
      currentPage,
      activeElementName: normalizeTextValue(body?.currentElement?.name),
      previewTab: normalizeTextValue(body?.sharedSession?.workspaceSurface),
    })

  const sharedSession =
    normalizeSessionContext(body?.sharedSession, specRegion) ?? {
      projectName: normalizeTextValue(projectSpec?.title) || undefined,
      specKind: normalizeTextValue(projectSpec?.kind) || undefined,
      workspaceSurface: normalizeTextValue(body?.sharedSession?.workspaceSurface) || undefined,
      activeSection: normalizeTextValue(body?.sharedSession?.activeSection) || currentPage.id,
      deploymentTarget: normalizeTextValue(projectSpec?.deploymentTarget) || undefined,
      databaseTarget: normalizeTextValue(projectSpec?.databaseTarget) || undefined,
      region: specRegion,
      selectedTemplate: normalizeTextValue(body?.sharedSession?.selectedTemplate) || undefined,
      workspaceStatus: normalizeTextValue(body?.sharedSession?.workspaceStatus) || undefined,
    }

  return {
    ...context,
    currentPage,
    currentModule,
    currentElement: {
      ...currentElement,
      options: currentElement.options.length ? currentElement.options : currentPage.elements,
    },
    sharedSession,
    openTabs: uniqueContextPaths(context.openTabs ?? []),
    relatedPaths: uniqueContextPaths([
      context.currentFilePath,
      currentPage.filePath,
      ...(context.relatedPaths ?? []),
      ...(context.openTabs ?? []),
    ]),
  }
}

function serializeEditorContext(context: EditorRequestContext): IterateResolvedContext {
  return {
    currentFilePath: context.currentFilePath || undefined,
    currentRoute: context.currentRoute || undefined,
    focusedLine: typeof context.focusedLine === "number" ? context.focusedLine : undefined,
    currentFileSymbols: context.currentFileSymbols?.length ? context.currentFileSymbols : undefined,
    currentPage: context.currentPage,
    currentModule: context.currentModule,
    currentElement: context.currentElement,
    sharedSession: context.sharedSession,
    openTabs: context.openTabs?.length ? context.openTabs : undefined,
    relatedPaths: context.relatedPaths?.length ? context.relatedPaths : undefined,
  }
}

function extractJsonObject(raw: string) {
  const fenced = raw.match(/```json\s*([\s\S]*?)```/i)
  const payload = fenced?.[1] ?? raw
  const start = payload.indexOf("{")
  const end = payload.lastIndexOf("}")
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model response is not valid JSON")
  }
  return payload.slice(start, end + 1)
}

function sanitizeJsonText(input: string) {
  return input
    .replace(/\u201c|\u201d/g, '"')
    .replace(/\u2018|\u2019/g, "'")
    .replace(/,\s*([}\]])/g, "$1")
}

function parseModelOutput(rawContent: string) {
  const candidate = extractJsonObject(rawContent)
  try {
    return JSON.parse(candidate) as ModelOutput
  } catch {
    const sanitized = sanitizeJsonText(candidate)
    return JSON.parse(sanitized) as ModelOutput
  }
}

function trimText(input: string, maxLen = 1800) {
  const text = String(input ?? "")
  if (text.length <= maxLen) return text
  return `...${text.slice(text.length - maxLen)}`
}

async function readStreamToModelOutput(res: Response): Promise<{ content: string; reasoning: string }> {
  if (!res.body) {
    throw new Error("Empty stream body from model")
  }
  const reader = res.body.getReader()
  const decoder = new TextDecoder("utf-8")
  let buffer = ""
  let content = ""
  let reasoning = ""

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const events = buffer.split("\n\n")
    buffer = events.pop() ?? ""

    for (const evt of events) {
      const lines = evt
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.startsWith("data:"))
      for (const line of lines) {
        const payload = line.slice(5).trim()
        if (!payload || payload === "[DONE]") continue

        let parsed: any
        try {
          parsed = JSON.parse(payload)
        } catch {
          continue
        }
        const delta = parsed?.choices?.[0]?.delta ?? {}
        if (typeof delta.reasoning_content === "string") reasoning += delta.reasoning_content
        if (typeof delta.content === "string") content += delta.content
      }
    }
  }

  return { content: content.trim(), reasoning: reasoning.trim() }
}

async function callEditorModel(
  projectDir: string,
  prompt: string,
  region: Region,
  context: EditorRequestContext,
  body: any,
  mode: IterateMode
): Promise<ModelOutput> {
  const config = resolveAiConfig({
    apiKey: String(body?.apiKey ?? "").trim() || undefined,
    baseUrl: String(body?.baseUrl ?? "").trim() || undefined,
    model: String(body?.model ?? "").trim() || undefined,
    enableThinking: typeof body?.enableThinking === "boolean" ? body.enableThinking : undefined,
    mode: "fixer",
  })

  const files = prioritizeContextFiles(await collectContextFiles(projectDir), context)
  const snapshots: string[] = []
  for (const relativePath of files.slice(0, 20)) {
    const fullPath = path.join(projectDir, relativePath)
    const content =
      context.currentFilePath === relativePath && typeof context.currentFileContent === "string"
        ? context.currentFileContent
        : await fs.readFile(fullPath, "utf8")
    snapshots.push(
      `FILE: ${relativePath}\n` +
        "```text\n" +
        `${content.slice(0, 12000)}\n` +
        "```\n"
    )
  }

  const system = [
    "You are a code editor for an existing Next.js workspace.",
    "Return strict JSON only with this schema:",
    '{"summary":"...","analysis":"","files":[{"path":"relative/path","content":"full file content","reason":"..."}]}',
    "Rules:",
    "- Use relative paths only.",
    "- Do not modify node_modules, .next, or .git.",
    "- Keep changes minimal and executable.",
    "- Always anchor your reasoning in the provided current file/page/module context when it exists.",
    "- If the requested mode is explain, prefer returning analysis with an empty files array unless the user explicitly asks for code edits.",
  ].join("\n")

  const modeDirective =
    mode === "explain"
      ? region === "cn"
        ? "当前模式：explain。请重点解释当前文件、当前页面、当前模块的职责、依赖边界、风险点和下一步修改建议；除非用户明确要求改代码，否则 files 返回空数组。"
        : "Mode: explain. Focus on explaining the current file, page, and module responsibilities, boundaries, risks, and the best next changes. Unless the user explicitly asks for edits, return an empty files array."
      : mode === "fix"
        ? region === "cn"
          ? "当前模式：fix。请优先修复当前文件和当前页面相关的问题，避免大面积重写整个项目。"
          : "Mode: fix. Prioritize repairs tied to the current file and current page instead of rewriting the whole project."
        : mode === "refactor"
          ? region === "cn"
            ? "当前模式：refactor。请围绕当前文件和相关模块重构结构、拆分边界、提升可维护性。"
            : "Mode: refactor. Refactor around the current file and related modules to improve structure and maintainability."
          : region === "cn"
            ? "当前模式：generate。请基于当前文件和页面继续补能力，而不是回到全局空泛修改。"
            : "Mode: generate. Extend capability from the current file and page context instead of drifting back into global edits."

  const currentPageMeta = context.currentPage
    ? [
        `Current page: ${context.currentPage.label} (${context.currentPage.id})`,
        `Page route: ${context.currentPage.route}`,
        context.currentPage.filePath ? `Page file: ${context.currentPage.filePath}` : "",
        context.currentPage.focus ? `Page focus: ${context.currentPage.focus}` : "",
        context.currentPage.elements.length ? `Page elements: ${context.currentPage.elements.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "Current page context: not provided"

  const currentModuleMeta = context.currentModule
    ? [
        `Current module: ${context.currentModule.name}`,
        `Module source: ${context.currentModule.source}`,
        context.currentModule.relatedSymbols.length
          ? `Module symbols: ${context.currentModule.relatedSymbols.join(", ")}`
          : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "Current module context: not provided"

  const currentElementMeta = context.currentElement
    ? [
        `Current element: ${context.currentElement.name}`,
        `Element source: ${context.currentElement.source}`,
        context.currentElement.detail ? `Element detail: ${context.currentElement.detail}` : "",
        context.currentElement.options.length ? `Available elements: ${context.currentElement.options.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "Current element context: not provided"

  const sharedSessionMeta = context.sharedSession
    ? [
        context.sharedSession.projectName ? `Project name: ${context.sharedSession.projectName}` : "",
        context.sharedSession.specKind ? `Workspace kind: ${context.sharedSession.specKind}` : "",
        context.sharedSession.workspaceSurface ? `Workspace surface: ${context.sharedSession.workspaceSurface}` : "",
        context.sharedSession.activeSection ? `Active section: ${context.sharedSession.activeSection}` : "",
        context.sharedSession.selectedTemplate ? `Selected template: ${context.sharedSession.selectedTemplate}` : "",
        context.sharedSession.deploymentTarget ? `Deployment target: ${context.sharedSession.deploymentTarget}` : "",
        context.sharedSession.databaseTarget ? `Database target: ${context.sharedSession.databaseTarget}` : "",
        context.sharedSession.workspaceStatus ? `Workspace status: ${context.sharedSession.workspaceStatus}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "Shared workspace session: not provided"

  const currentFileMeta = context.currentFilePath
    ? [
        `Current file: ${context.currentFilePath}`,
        context.currentRoute ? `Current route: ${context.currentRoute}` : "",
        typeof context.focusedLine === "number" ? `Focused line: ${context.focusedLine}` : "",
        context.currentFileSymbols?.length
          ? `Current symbols: ${context.currentFileSymbols.map((item) => `${item.kind}:${item.name}@${item.line}`).join(", ")}`
          : "Current symbols: none detected",
        typeof context.currentFileContent === "string"
          ? `Current unsaved draft for ${context.currentFilePath}:\n\`\`\`text\n${context.currentFileContent.slice(0, 12000)}\n\`\`\``
          : "",
      ]
        .filter(Boolean)
        .join("\n")
    : "Current file context: not provided"

  const user = [
    `Project region: ${region}`,
    `Requested mode: ${mode}`,
    `User request: ${prompt}`,
    modeDirective,
    currentFileMeta,
    currentPageMeta,
    currentModuleMeta,
    currentElementMeta,
    sharedSessionMeta,
    context.openTabs?.length ? `Open tabs: ${context.openTabs.join(", ")}` : "Open tabs: none",
    context.relatedPaths?.length ? `Related files: ${context.relatedPaths.join(", ")}` : "Related files: none",
    "Current file snapshots:",
    snapshots.join("\n"),
  ].join("\n\n")

  const { content: rawContent, reasoning } = await requestJsonChatCompletion({
    config,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    temperature: 0.2,
    timeoutMs: 120_000,
    mode: "fixer",
  })

  if (!rawContent) {
    throw new Error("Empty model response")
  }

  let parsed: ModelOutput
  try {
    parsed = parseModelOutput(rawContent)
  } catch (err: any) {
    throw new Error(`Model JSON parse failed: ${err?.message || String(err)}\nRaw tail:\n${trimText(rawContent, 1200)}`)
  }

  if (reasoning) parsed.reasoning = reasoning
  if (!Array.isArray(parsed.files)) {
    parsed.files = []
  }
  if (mode !== "explain" && parsed.files.length === 0) {
    throw new Error("Model returned no file edits")
  }
  return parsed
}

async function runBuild(projectDir: string) {
  const hasPackage = await pathExists(path.join(projectDir, "package.json"))
  if (!hasPackage) {
    return { status: "skipped" as const, logs: ["Skipped: no package.json"] }
  }
  const hasModules = await pathExists(path.join(projectDir, "node_modules"))
  if (!hasModules) {
    return { status: "skipped" as const, logs: ["Skipped: node_modules missing; run npm install first"] }
  }

  return new Promise<{ status: "ok" | "failed"; logs: string[] }>((resolve) => {
    const logs: string[] = []
    const child =
      process.platform === "win32"
        ? (() => {
            const npmExecPath = process.env.npm_execpath
            const npmCli =
              npmExecPath && npmExecPath.endsWith(".js")
                ? npmExecPath
                : path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js")
            return spawn(process.execPath, [npmCli, "run", "build"], {
              cwd: projectDir,
              windowsHide: true,
              shell: false,
              creationFlags: 0x08000000,
            } as any)
          })()
        : spawn("npm", ["run", "build"], { cwd: projectDir, windowsHide: true, shell: false })

    child.stdout.on("data", (data) => logs.push(String(data)))
    child.stderr.on("data", (data) => logs.push(String(data)))
    child.on("error", (err) => resolve({ status: "failed", logs: [...logs, err.message] }))
    child.on("close", (code) => resolve({ status: code === 0 ? "ok" : "failed", logs }))
  })
}

async function repairLegacyPrismaImport(projectDir: string) {
  const apiPath = path.join(projectDir, "app", "api", "items", "route.ts")
  if (!(await pathExists(apiPath))) {
    return
  }
  const raw = await fs.readFile(apiPath, "utf8")
  const next = raw
    .replace('import { prisma } from "../../../../lib/prisma";', 'import { prisma } from "../../../lib/prisma";')
    .replace('import { prisma } from "../../lib/prisma";', 'import { prisma } from "../../../lib/prisma";')
  if (next !== raw) {
    await fs.writeFile(apiPath, next, "utf8")
  }
}

function buildIterateContextSummary(context: EditorRequestContext, region: Region) {
  const parts = [
    context.currentPage?.label,
    context.currentModule?.name,
    context.currentElement?.name,
  ].filter(Boolean)
  if (!parts.length) return region === "cn" ? "当前工作区" : "the current workspace"
  return parts.join(" / ")
}

async function tryLocalFallbackEdits(
  projectDir: string,
  prompt: string,
  context: EditorRequestContext,
  mode: IterateMode,
  region: Region
): Promise<ModelOutput | null> {
  const candidatePaths = uniqueContextPaths([
    context.currentFilePath,
    context.currentPage?.filePath,
    "app/page.tsx",
  ])
  const drafts = new Map<string, { raw: string; next: string }>()
  const createdFiles: ModelFileEdit[] = []
  const changes: string[] = []

  async function ensureDraft(relativePath: string) {
    const normalized = normalizeContextPath(relativePath)
    if (!normalized) return null
    const existing = drafts.get(normalized)
    if (existing) return existing
    const absolutePath = path.join(projectDir, normalized)
    if (!(await pathExists(absolutePath))) return null
    const raw = await fs.readFile(absolutePath, "utf8")
    const draft = { raw, next: raw }
    drafts.set(normalized, draft)
    return draft
  }

  if (!(await ensureDraft(candidatePaths[0] || "app/page.tsx"))) {
    return null
  }

  const title = extractTargetTitle(prompt)
  if (title) {
    for (const relativePath of candidatePaths) {
      const draft = await ensureDraft(relativePath)
      if (!draft) continue
      if (/<h1[^>]*>[\s\S]*?<\/h1>/.test(draft.next)) {
        draft.next = draft.next.replace(/<h1([^>]*)>[\s\S]*?<\/h1>/, `<h1$1>${title}</h1>`)
        changes.push(`title -> ${title}`)
        break
      }
      if (draft.next.includes("Generated Task Workspace")) {
        draft.next = draft.next.replace("Generated Task Workspace", title)
        changes.push(`title -> ${title}`)
        break
      }
    }
  }

  const workspacePagePath = candidatePaths.find((item) => item === "app/page.tsx") || candidatePaths[0] || "app/page.tsx"
  const workspaceDraft = await ensureDraft(workspacePagePath)
  if (!workspaceDraft) {
    return null
  }

  if (isChineseUiRequest(prompt)) {
    const before = workspaceDraft.next
    const replacements: Array<[string, string]> = [
      ["Task title", "任务标题"],
      ["Assignee", "负责人"],
      ["Create", "创建"],
      ["Adding...", "创建中..."],
      ["Todo", "待办"],
      ["In Progress", "进行中"],
      ["Done", "完成"],
      ["Doing", "进行中"],
      ["Priority:", "优先级:"],
      ["Unassigned", "未分配"],
      ["Filter by assignee", "按负责人筛选"],
      ["Blocked", "阻塞"],
    ]
    for (const [from, to] of replacements) workspaceDraft.next = workspaceDraft.next.split(from).join(to)
    if (workspaceDraft.next !== before) changes.push("localized labels to Chinese")
  }

  if (isDescriptionFieldRequest(prompt)) {
    const before = workspaceDraft.next
    if (!workspaceDraft.next.includes("const [description, setDescription]")) {
      workspaceDraft.next = workspaceDraft.next.replace(
        '  const [title, setTitle] = useState("");',
        '  const [title, setTitle] = useState("");\n  const [description, setDescription] = useState("");'
      )
      workspaceDraft.next = workspaceDraft.next.replace(
        "          assignee: assignee.trim(),",
        "          description: description.trim(),\n          assignee: assignee.trim(),"
      )
      workspaceDraft.next = workspaceDraft.next.replace(
        '      setTitle("");\n      setAssignee("");',
        '      setTitle("");\n      setDescription("");\n      setAssignee("");'
      )
      workspaceDraft.next = workspaceDraft.next.replace(
        `        <input
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          placeholder="Assignee"
          style={{ width: 160, padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
        />`,
        `        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
          style={{ width: 220, padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
        />
        <input
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          placeholder="Assignee"
          style={{ width: 160, padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
        />`
      )
      workspaceDraft.next = workspaceDraft.next.replace(
        '                    <div style={{ fontWeight: 600 }}>{task.title}</div>',
        '                    <div style={{ fontWeight: 600 }}>{task.title}</div>\n                    {task.description ? <div style={{ fontSize: 12, color: "#444", marginTop: 4 }}>{task.description}</div> : null}'
      )
    }
    if (workspaceDraft.next !== before) changes.push("added description input and card rendering")
  }

  if (isBlockedColumnRequest(prompt)) {
    const before = workspaceDraft.next
    workspaceDraft.next = workspaceDraft.next.replace(
      'status: "todo" | "in_progress" | "done";',
      'status: "todo" | "in_progress" | "blocked" | "done";'
    )
    workspaceDraft.next = workspaceDraft.next.replace(
      '{ key: "in_progress", label: "In Progress" },\n    { key: "done", label: "Done" },',
      '{ key: "in_progress", label: "In Progress" },\n    { key: "blocked", label: "Blocked" },\n    { key: "done", label: "Done" },'
    )
    if (!workspaceDraft.next.includes('setStatus(task.id, "blocked")')) {
      workspaceDraft.next = workspaceDraft.next.replace(
        `{group.key !== "done" ? (
                        <button
                          onClick={() => setStatus(task.id, "done")}
                          style={{ border: "1px solid #ddd", borderRadius: 6, padding: "4px 8px" }}
                        >
                          Done
                        </button>
                      ) : null}`,
        `{group.key !== "blocked" ? (
                        <button
                          onClick={() => setStatus(task.id, "blocked")}
                          style={{ border: "1px solid #ddd", borderRadius: 6, padding: "4px 8px" }}
                        >
                          Blocked
                        </button>
                      ) : null}
                      {group.key !== "done" ? (
                        <button
                          onClick={() => setStatus(task.id, "done")}
                          style={{ border: "1px solid #ddd", borderRadius: 6, padding: "4px 8px" }}
                        >
                          Done
                        </button>
                      ) : null}`
      )
    }
    if (workspaceDraft.next !== before) changes.push("added blocked column and action")
  }

  if (isAssigneeFilterRequest(prompt)) {
    const before = workspaceDraft.next
    if (!workspaceDraft.next.includes("const [assigneeFilter, setAssigneeFilter]")) {
      workspaceDraft.next = workspaceDraft.next.replace(
        '  const [assignee, setAssignee] = useState("");',
        '  const [assignee, setAssignee] = useState("");\n  const [assigneeFilter, setAssigneeFilter] = useState("");'
      )
      workspaceDraft.next = workspaceDraft.next.replace(
        '  const groups: Array<{ key: Task["status"]; label: string }> = [',
        `  const visibleTasks = tasks.filter((t) => {
    const f = assigneeFilter.trim().toLowerCase();
    if (!f) return true;
    return String(t.assignee || "").toLowerCase().includes(f);
  });

  const groups: Array<{ key: Task["status"]; label: string }> = [`
      )
      workspaceDraft.next = workspaceDraft.next.replace("{tasks", "{visibleTasks")
      workspaceDraft.next = workspaceDraft.next.replace(
        `        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as "low" | "medium" | "high")}
          style={{ width: 120, padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
        >`,
        `        <input
          value={assigneeFilter}
          onChange={(e) => setAssigneeFilter(e.target.value)}
          placeholder="Filter by assignee"
          style={{ width: 180, padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
        />
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value as "low" | "medium" | "high")}
          style={{ width: 120, padding: 10, border: "1px solid #ddd", borderRadius: 8 }}
        >`
      )
    }
    if (workspaceDraft.next !== before) changes.push("added assignee filter")
  }

  if (isAboutPageRequest(prompt)) {
    const aboutPath = path.join(projectDir, "app", "about", "page.tsx")
    const aboutTitle = region === "cn" ? "关于当前工作区" : "About This Workspace"
    const aboutContext = buildIterateContextSummary(context, region)
    const aboutContent = `export default function AboutPage() {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui", maxWidth: 860 }}>
      <h1>${aboutTitle}</h1>
      <p style={{ color: "#666" }}>
        ${region === "cn" ? "当模型 API 不可用时，本页面由本地 fallback 规则生成。" : "This page was generated by local fallback rules when the model API was unavailable."}
      </p>
      <p style={{ color: "#666" }}>
        ${region === "cn" ? "当前聚焦：" : "Current focus:"} ${aboutContext}
      </p>
      <a href="/" style={{ textDecoration: "underline" }}>
        ${region === "cn" ? "回到首页" : "Back to Home"}
      </a>
    </main>
  )
}
`
    await ensureDir(path.dirname(aboutPath))
    await fs.writeFile(aboutPath, aboutContent, "utf8")
    createdFiles.push({ path: "app/about/page.tsx", content: aboutContent, reason: "Add about page" })
    const linkTargetPath =
      (context.currentPage?.filePath && /\/page\.(tsx|jsx)$/.test(context.currentPage.filePath) && context.currentPage.filePath) ||
      workspacePagePath
    const linkDraft = await ensureDraft(linkTargetPath)
    if (linkDraft && !linkDraft.next.includes('href="/about"')) {
      linkDraft.next = linkDraft.next.replace(
        "</h1>",
        `</h1>
      <div style={{ marginBottom: 8 }}>
        <a href="/about" style={{ textDecoration: "underline" }}>${region === "cn" ? "关于" : "About"}</a>
      </div>`
      )
    }
    changes.push("added /about page")
  }

  const changedFiles = Array.from(drafts.entries())
    .filter(([, draft]) => draft.next !== draft.raw)
    .map(([relativePath, draft]) => ({
      path: relativePath,
      content: draft.next,
      reason:
        mode === "refactor"
          ? `Refactor fallback applied from ${buildIterateContextSummary(context, region)}`
          : changes.join("; ") || `Fallback update from ${buildIterateContextSummary(context, region)}`,
    }))

  if (changes.length === 0 && changedFiles.length === 0 && createdFiles.length === 0) {
    return null
  }

  return {
    summary: `Local fallback edits applied on ${[...changedFiles.map((file) => file.path), ...createdFiles.map((file) => file.path)].join(", ")}: ${changes.join("; ") || "context-aware fallback"}`,
    reasoning: "Model API unavailable, fallback rule applied.",
    files: [...changedFiles, ...createdFiles],
  }
}

async function tryGenericFallbackEdits(
  projectDir: string,
  prompt: string,
  region: Region,
  context?: EditorRequestContext,
  mode?: IterateMode
): Promise<ModelOutput> {
  const previous = await readProjectSpec(projectDir)
  const baseRegion = previous?.region === "cn" ? "cn" : region
  const basePrompt = previous?.prompt || prompt
  const spec = applyPromptToSpec(
    createAppSpec(basePrompt, baseRegion, previous ?? undefined),
    prompt,
    context
  )
  if (previous?.templateId) {
    spec.templateId = previous.templateId
  }
  if (previous?.templateStyle) {
    spec.templateStyle = previous.templateStyle
  }
  const generated = await buildSpecDrivenWorkspaceFiles(projectDir, spec, context)
  return {
    summary: `Spec-driven fallback applied for ${buildIterateContextSummary(context ?? {}, region)}: "${sanitizeUiText(prompt).slice(0, 80)}"`,
    reasoning: `Model API unavailable, so the request was applied through the local spec-driven workspace editor${mode ? ` in ${mode} mode` : ""}.`,
    files: generated.map((file) => ({
      path: file.path,
      content: file.content,
      reason: file.reason,
    })),
  }
}

export async function POST(req: Request) {
  const now = new Date().toISOString()
  const body = await req.json().catch(() => ({}))
  const projectId = safeProjectId(String(body?.projectId ?? body?.jobId ?? ""))
  const prompt = String(body?.prompt ?? "").trim()
  const mode = normalizeIterateMode(body?.mode)
  const region = (body?.region === "cn" ? "cn" : "intl") as Region

  if (!projectId || !prompt) {
    return NextResponse.json({ error: "projectId and prompt are required" }, { status: 400 })
  }

  const projectDir = await resolveProjectPath(projectId)
  if (!projectDir) {
    return NextResponse.json({ error: "Project not found", projectId }, { status: 404 })
  }
  const project = await getProject(projectId)
  const effectiveRegion = project?.region ?? region

  const backups = new Map<string, string | null>()
  try {
    await repairLegacyPrismaImport(projectDir)
    const baselineBuild = await runBuild(projectDir)
    const requestContext = await resolveEditorContext(projectDir, body, effectiveRegion)
    const responseContext = serializeEditorContext(requestContext)
    let modelResult: ModelOutput

    try {
      modelResult = await callEditorModel(projectDir, prompt, effectiveRegion, requestContext, body, mode)
    } catch (modelErr: any) {
      if (mode === "explain") {
        const explained = buildExplainFallback(prompt, requestContext, effectiveRegion)
        modelResult = {
          ...explained,
          reasoning: `${explained.reasoning}\nOriginal model error: ${modelErr?.message || String(modelErr)}`,
        }
      } else {
        const localFallback = await tryLocalFallbackEdits(projectDir, prompt, requestContext, mode, effectiveRegion)
        if (localFallback) {
          modelResult = {
            ...localFallback,
            reasoning: `${localFallback.reasoning}\nOriginal model error: ${modelErr?.message || String(modelErr)}`,
          }
        } else {
          const specDriven = await tryGenericFallbackEdits(projectDir, prompt, effectiveRegion, requestContext, mode)
          modelResult = {
            ...specDriven,
            reasoning: `${specDriven.reasoning}\nOriginal model error: ${modelErr?.message || String(modelErr)}`,
          }
        }
      }
    }

    const requestedFiles = Array.isArray(modelResult.files) ? modelResult.files : []
    const appliedEdits = mode === "explain" ? [] : requestedFiles

    if (mode === "explain") {
      await appendProjectHistory(projectId, {
        id: `evt_${Date.now()}`,
        type: "iterate",
        prompt,
        createdAt: now,
        status: "done",
        summary: modelResult.summary,
        changedFiles: [],
        buildStatus: "skipped",
        buildLogs: ["Skipped: explain mode does not apply file edits"],
      })

      return NextResponse.json({
        projectId,
        status: "done",
        summary: modelResult.summary,
        thinking: modelResult.reasoning ?? modelResult.analysis ?? "",
        context: responseContext,
        changedFiles: [],
        build: {
          status: "skipped",
          logs: ["Skipped: explain mode does not apply file edits"],
        },
      })
    }

    const changedFiles: string[] = []
    const fileBackups: Array<{ path: string; previousContent: string | null }> = []
    for (const edit of appliedEdits) {
      if (!isAllowedFile(edit.path)) {
        throw new Error(`Blocked path from model: ${edit.path}`)
      }
      const relative = normalizePath(edit.path)
      const absolute = path.resolve(projectDir, relative)
      const root = path.resolve(projectDir)
      if (!absolute.startsWith(root + path.sep) && absolute !== root) {
        throw new Error(`Path escapes workspace: ${relative}`)
      }

      if (!backups.has(absolute)) {
        if (await pathExists(absolute)) {
          const previous = await fs.readFile(absolute, "utf8")
          backups.set(absolute, previous)
          fileBackups.push({ path: relative, previousContent: previous })
        } else {
          backups.set(absolute, null)
          fileBackups.push({ path: relative, previousContent: null })
        }
      }

      await ensureDir(path.dirname(absolute))
      await fs.writeFile(absolute, edit.content, "utf8")
      changedFiles.push(relative)
    }

    const build = await runBuild(projectDir)
    if (build.status === "failed" && baselineBuild.status === "ok") {
      for (const [filePath, oldContent] of backups.entries()) {
        if (oldContent === null) {
          if (await pathExists(filePath)) await fs.rm(filePath, { force: true })
        } else {
          await fs.writeFile(filePath, oldContent, "utf8")
        }
      }
      await appendProjectHistory(projectId, {
        id: `evt_${Date.now()}`,
        type: "iterate",
        prompt,
        createdAt: now,
        status: "error",
        summary: modelResult.summary,
        changedFiles,
        fileBackups,
        buildStatus: "failed",
        buildLogs: build.logs,
        error: "Build failed and changes were rolled back",
      })
      return NextResponse.json(
        {
          projectId,
          status: "error",
          summary: modelResult.summary,
          context: responseContext,
          changedFiles,
          build: { status: "failed", logs: build.logs },
          error: "Build failed and changes were rolled back",
        },
        { status: 500 }
      )
    }

    if (build.status === "failed" && baselineBuild.status === "failed") {
      await appendProjectHistory(projectId, {
        id: `evt_${Date.now()}`,
        type: "iterate",
        prompt,
        createdAt: now,
        status: "done",
        summary: `${modelResult.summary} (Workspace already had build errors before this change; changes kept.)`,
        changedFiles,
        fileBackups,
        buildStatus: "failed",
        buildLogs: build.logs,
      })
      return NextResponse.json({
        projectId,
        status: "done",
        summary: `${modelResult.summary} (Workspace already had build errors before this change; changes kept.)`,
        thinking: modelResult.reasoning ?? "",
        context: responseContext,
        changedFiles,
        build,
        warning: "Build failed, but changes were kept because baseline build was already failing.",
      })
    }

    await appendProjectHistory(projectId, {
      id: `evt_${Date.now()}`,
      type: "iterate",
      prompt,
      createdAt: now,
      status: "done",
      summary: modelResult.summary,
      changedFiles,
      fileBackups,
      buildStatus: build.status,
      buildLogs: build.logs,
    })

    return NextResponse.json({
      projectId,
      status: "done",
      summary: modelResult.summary,
      thinking: modelResult.reasoning ?? "",
      context: responseContext,
      changedFiles,
      build,
    })
  } catch (error: any) {
    await appendProjectHistory(projectId, {
      id: `evt_${Date.now()}`,
      type: "iterate",
      prompt,
      createdAt: now,
      status: "error",
      error: error?.message || String(error),
      buildStatus: "skipped",
    })
    return NextResponse.json(
      {
        projectId,
        status: "error",
        error: error?.message || String(error),
      },
      { status: 500 }
    )
  }
}
