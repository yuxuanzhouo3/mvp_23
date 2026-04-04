#!/usr/bin/env node

const [, , baseUrlArg, projectIdArg, ...extraArgs] = process.argv

if (!baseUrlArg || !projectIdArg) {
  console.error(
    "Usage: node scripts/run-local-iterate-smoke.mjs <baseUrl> <projectId> [--file app/editor/page.tsx] [--route /editor] [--surface code] [--section editor] [--steps explain,generate,fix,refactor] [--explain \"...\"] [--generate \"...\"] [--fix \"...\"] [--refactor \"...\"]"
  )
  process.exit(1)
}

const baseUrl = baseUrlArg.replace(/\/+$/, "")
const projectId = String(projectIdArg).trim().replace(/[^a-zA-Z0-9_-]/g, "")

function parseOptions(args) {
  const options = {}
  for (let index = 0; index < args.length; index += 1) {
    const token = args[index]
    if (!token.startsWith("--")) {
      console.error(`[FAIL] unexpected argument: ${token}`)
      process.exit(1)
    }
    const key = token.slice(2).trim()
    const value = args[index + 1]
    if (!key || !value || value.startsWith("--")) {
      console.error(`[FAIL] missing value for option: ${token}`)
      process.exit(1)
    }
    options[key] = value
    index += 1
  }
  return options
}

const options = parseOptions(extraArgs)

function inferRouteFromFilePath(filePath) {
  const normalized = String(filePath || "").replace(/\\/g, "/").replace(/^\/+/, "").trim()
  if (!normalized) return ""
  if (normalized === "app/page.tsx") return "/"
  const match = normalized.match(/^app\/(.+)\/page\.(tsx|jsx)$/)
  if (!match?.[1]) return ""
  return `/${match[1]}`
}

function buildDefaultSteps(region) {
  const requestedSteps = String(options.steps || "explain,generate,fix,refactor")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean)

  return [
    {
      mode: "explain",
      prompt:
        options.explain ||
        (region === "cn"
          ? "解释当前文件、当前页面、当前模块分别负责什么，并给出下一步最合理的修改方向。"
          : "Explain what the current file, page, and module are responsible for, then suggest the best next change."),
    },
    {
      mode: "generate",
      prompt:
        options.generate ||
        (region === "cn"
          ? "在当前工作区里补一个很轻的上下文状态说明，不要大改结构。"
          : "Add a very light context status note in the current workspace without broad structural changes."),
    },
    {
      mode: "fix",
      prompt:
        options.fix ||
        (region === "cn"
          ? "如果当前文件里有明显的文案、守卫或焦点状态问题，做最小修复。"
          : "If there are any obvious copy, guard, or focus-state issues in the current file, apply a minimal fix."),
    },
    {
      mode: "refactor",
      prompt:
        options.refactor ||
        (region === "cn"
          ? "围绕当前文件和相邻模块做轻量重构，提升结构清晰度，但不要改成全局大重写。"
          : "Do a light refactor around the current file and nearby module boundary without turning it into a global rewrite."),
    },
  ].filter((step) => requestedSteps.includes(step.mode))
}

async function readProject() {
  const res = await fetch(`${baseUrl}/api/projects?projectId=${encodeURIComponent(projectId)}`)
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json?.project) {
    console.error("[FAIL] project lookup", json)
    process.exit(1)
  }
  return json.project
}

async function run() {
  const project = await readProject()
  const region = project?.region === "cn" ? "cn" : "intl"
  let currentFilePath =
    options.file ||
    (project?.spec?.kind === "code_platform" ? "app/editor/page.tsx" : "app/page.tsx")
  let currentRoute = options.route || inferRouteFromFilePath(currentFilePath) || "/"

  let sharedSession = {
    projectName: project?.presentation?.displayName || project?.spec?.title || projectId,
    specKind: project?.spec?.kind || "workspace",
    workspaceSurface: options.surface || (project?.spec?.kind === "code_platform" ? "code" : "preview"),
    activeSection: options.section || (project?.spec?.kind === "code_platform" ? "editor" : "home"),
    routeId: options.section || (project?.spec?.kind === "code_platform" ? "editor" : "home"),
    routeLabel: options.section || (project?.spec?.kind === "code_platform" ? "Editor" : "Home"),
    filePath: currentFilePath,
    deploymentTarget: project?.deploymentTarget || project?.spec?.deploymentTarget || undefined,
    databaseTarget: project?.databaseTarget || project?.spec?.databaseTarget || undefined,
    region,
    selectedTemplate: undefined,
    workspaceStatus: project?.generation?.buildStatus || undefined,
    readiness: "context_ready",
  }

  const steps = buildDefaultSteps(region)
  const summary = []

  for (const step of steps) {
    const beforeFocus = {
      routeId: sharedSession?.routeId || "",
      filePath: currentFilePath,
      symbolName: sharedSession?.symbolName || "",
      elementName: sharedSession?.elementName || "",
      readiness: sharedSession?.readiness || "",
    }
    const payload = {
      projectId,
      mode: step.mode,
      prompt: step.prompt,
      currentFilePath,
      currentRoute,
      sharedSession,
      openTabs: [currentFilePath],
      relatedPaths: [currentFilePath],
    }

    const res = await fetch(`${baseUrl}/api/iterate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
    const json = await res.json().catch(() => ({}))

    const ok = res.ok && json?.status === "done"
    const afterFocus = {
      routeId: json?.context?.sharedSession?.routeId || beforeFocus.routeId,
      filePath: json?.context?.currentFilePath || currentFilePath,
      symbolName: json?.context?.sharedSession?.symbolName || beforeFocus.symbolName,
      elementName: json?.context?.sharedSession?.elementName || beforeFocus.elementName,
      readiness: json?.context?.sharedSession?.readiness || beforeFocus.readiness,
    }
    console.log(
      `[${ok ? "OK" : "FAIL"}] mode=${step.mode} status=${json?.status ?? res.status} file=${json?.context?.currentFilePath || currentFilePath} route=${json?.context?.currentRoute || currentRoute} build=${json?.build?.status ?? "n/a"}`
    )
    console.log(`  summary=${String(json?.summary ?? "").slice(0, 220)}`)
    console.log(`  focus=${JSON.stringify({ before: beforeFocus, after: afterFocus })}`)
    console.log(
      `  session=${JSON.stringify({
        routeId: json?.context?.sharedSession?.routeId,
        filePath: json?.context?.sharedSession?.filePath,
        symbolName: json?.context?.sharedSession?.symbolName,
        elementName: json?.context?.sharedSession?.elementName,
        lastAction: json?.context?.sharedSession?.lastAction,
        readiness: json?.context?.sharedSession?.readiness,
      })}`
    )

    if (!ok) {
      console.error(JSON.stringify(json, null, 2))
      process.exit(1)
    }

    currentFilePath = json?.context?.currentFilePath || currentFilePath
    currentRoute = json?.context?.currentRoute || currentRoute
    sharedSession = json?.context?.sharedSession || sharedSession

    summary.push({
      mode: step.mode,
      changedFiles: json?.changedFiles || [],
      build: json?.build?.status || "n/a",
      filePath: currentFilePath,
      route: currentRoute,
      readiness: sharedSession?.readiness || "",
    })
  }

  console.log(JSON.stringify({ projectId, summary }, null, 2))
}

await run()
