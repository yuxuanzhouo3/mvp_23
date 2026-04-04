#!/usr/bin/env node

import fs from "fs/promises"
import path from "path"

const args = process.argv.slice(2)
const strictBuild = args.includes("--strict-build")
const projectIdArg = args.find((item) => !item.startsWith("--"))

if (!projectIdArg) {
  console.error("Usage: node scripts/check-workspace-health.mjs <projectId> [--strict-build]")
  process.exit(1)
}

const projectId = String(projectIdArg).trim().replace(/[^a-zA-Z0-9_-]/g, "")
const rootDir = process.cwd()
const workspacesDir = path.join(rootDir, "workspaces")
const storePath = path.join(workspacesDir, "_projects.json")
const workspacePath = path.join(workspacesDir, projectId)
const specPath = path.join(workspacePath, "spec.json")

async function exists(targetPath) {
  try {
    await fs.access(targetPath)
    return true
  } catch {
    return false
  }
}

function printCheck(ok, label, detail = "") {
  const prefix = ok ? "[OK]" : "[FAIL]"
  console.log(`${prefix} ${label}${detail ? ` :: ${detail}` : ""}`)
  return ok
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8")
  return JSON.parse(raw)
}

async function run() {
  let failures = 0

  const storeExists = await exists(storePath)
  if (!printCheck(storeExists, "projects store", storePath)) failures += 1
  if (!storeExists) process.exit(1)

  const store = await readJson(storePath)
  const project = store?.projects?.[projectId] ?? null
  if (!printCheck(Boolean(project), "project record", projectId)) failures += 1
  if (!project) process.exit(1)

  const workspaceExists = await exists(workspacePath)
  if (!printCheck(workspaceExists, "workspace directory", workspacePath)) failures += 1

  const specExists = await exists(specPath)
  if (!printCheck(specExists, "spec.json", specPath)) failures += 1

  const latestGenerate = Array.isArray(project.history)
    ? [...project.history].reverse().find((item) => item.type === "generate")
    : null

  if (!printCheck(Boolean(latestGenerate), "latest generate history")) failures += 1

  let spec = null
  if (specExists) {
    spec = await readJson(specPath)
    printCheck(Boolean(spec?.title), "spec title", String(spec?.title ?? "missing"))
    printCheck(Boolean(spec?.kind), "spec kind", String(spec?.kind ?? "missing"))
  }

  if (latestGenerate) {
    printCheck(Boolean(latestGenerate.summary), "generate summary", latestGenerate.summary || "missing")
    const buildStatusOk = printCheck(
      typeof latestGenerate.buildStatus === "string",
      "generate build status",
      String(latestGenerate.buildStatus ?? "missing")
    )
    if (!buildStatusOk) failures += 1
    if (strictBuild && latestGenerate.buildStatus !== "ok") {
      printCheck(false, "strict build acceptance", `expected ok but received ${String(latestGenerate.buildStatus ?? "missing")}`)
      failures += 1
    }
  }

  const requiredFiles =
    spec?.kind === "code_platform"
      ? [
          "app/page.tsx",
          "app/dashboard/page.tsx",
          "app/editor/page.tsx",
          "app/runs/page.tsx",
          "app/templates/page.tsx",
          "app/pricing/page.tsx",
          "app/settings/page.tsx",
        ]
      : ["app/page.tsx"]

  for (const relativePath of requiredFiles) {
    const ok = await exists(path.join(workspacePath, relativePath))
    if (!printCheck(ok, "required file", relativePath)) failures += 1
  }

  if (spec?.kind === "code_platform") {
    const modules = Array.isArray(spec.modules) ? spec.modules : []
    const features = Array.isArray(spec.features) ? spec.features : []
    if (!printCheck(modules.length >= 6, "code platform modules", String(modules.length))) failures += 1
    if (!printCheck(features.length >= 3, "code platform features", String(features.length))) failures += 1
  }

  if (project?.runtime) {
    printCheck(true, "runtime status", `${project.runtime.status} @ ${project.runtime.url ?? "n/a"}`)
  }
  if (project?.previewMode) {
    printCheck(true, "preview mode", String(project.previewMode))
  }

  if (failures > 0) {
    process.exit(1)
  }
}

await run()
