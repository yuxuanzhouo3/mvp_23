#!/usr/bin/env node

const [, , baseUrlArg, projectKeyArg, projectIdArg] = process.argv

if (!baseUrlArg || !projectKeyArg) {
  console.error("Usage: node scripts/check-preview-regression.mjs <baseUrl> <projectKey> [projectId]")
  process.exit(1)
}

const baseUrl = baseUrlArg.replace(/\/+$/, "")
const projectKey = projectKeyArg
const projectId = (projectIdArg || projectKeyArg).replace(/[^a-zA-Z0-9_-]/g, "")

const checks = [
  { label: "canonical dashboard", path: `/preview/${encodeURIComponent(projectKey)}` },
  { label: "canonical editor", path: `/preview/${encodeURIComponent(projectKey)}/editor` },
  { label: "canonical runs", path: `/preview/${encodeURIComponent(projectKey)}/runs` },
  { label: "canonical templates", path: `/preview/${encodeURIComponent(projectKey)}/templates` },
  { label: "canonical pricing", path: `/preview/${encodeURIComponent(projectKey)}/pricing` },
]

async function run() {
  let failures = 0

  for (const check of checks) {
    const url = `${baseUrl}${check.path}`
    try {
      const response = await fetch(url, {
        method: "GET",
        redirect: "follow",
        headers: {
          accept: "text/html",
        },
      })
      const text = await response.text()
      const hasProjectNotFound = /Project not found/i.test(text)
      const hasPreviewSurface = /MornCursor|Dashboard|Editor|Runs|Templates|Pricing|AI coding platform/i.test(text)
      const ok = response.ok && !hasProjectNotFound && hasPreviewSurface
      if (!ok) {
        failures += 1
      }
      console.log(
        `[${ok ? "OK" : "FAIL"}] ${check.label} status=${response.status} url=${url} projectNotFound=${hasProjectNotFound} previewSurface=${hasPreviewSurface}`
      )
    } catch (error) {
      failures += 1
      console.log(`[FAIL] ${check.label} url=${url} error=${error instanceof Error ? error.message : String(error)}`)
    }
  }

  try {
    const response = await fetch(`${baseUrl}/api/projects?projectId=${encodeURIComponent(projectId)}`, {
      method: "GET",
      headers: {
        accept: "application/json",
      },
    })
    const json = await response.json().catch(() => ({}))
    const buildStatus = json?.project?.generation?.buildStatus ?? "missing"
    const previewStatus = json?.project?.preview?.status ?? "missing"
    const fallbackReason = String(json?.project?.preview?.fallbackReason ?? "")
    const ok = response.ok && buildStatus !== "missing" && previewStatus !== "missing"
    if (!ok) failures += 1
    console.log(
      `[${ok ? "OK" : "FAIL"}] project detail status=${response.status} buildStatus=${buildStatus} previewStatus=${previewStatus} fallbackReason=${fallbackReason || "none"}`
    )
  } catch (error) {
    failures += 1
    console.log(`[FAIL] project detail error=${error instanceof Error ? error.message : String(error)}`)
  }

  if (failures > 0) {
    process.exit(1)
  }
}

await run()
