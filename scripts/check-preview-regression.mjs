#!/usr/bin/env node

import http from "http"
import https from "https"

const [, , baseUrlArg, projectKeyArg, projectIdArg] = process.argv

if (!baseUrlArg || !projectKeyArg) {
  console.error("Usage: node scripts/check-preview-regression.mjs <baseUrl> <projectKey> [projectId]")
  process.exit(1)
}

const baseUrl = baseUrlArg.replace(/\/+$/, "")
const projectKey = String(projectKeyArg).trim()
const projectIdCandidate = String(projectIdArg || projectKeyArg)
  .trim()
  .replace(/[^a-zA-Z0-9_-]/g, "")

function normalizeRoute(route) {
  const normalized = String(route || "").trim()
  if (!normalized || normalized === "/") return ""
  return normalized.startsWith("/") ? normalized : `/${normalized}`
}

function unique(items) {
  return Array.from(new Set(items.filter((item) => item !== null && item !== undefined)))
}

function buildFallbackRoutes(project) {
  const kind = String(project?.spec?.kind || "").trim()
  if (kind === "code_platform") {
    return ["/dashboard", "/editor", "/runs", "/templates", "/pricing"]
  }
  if (kind === "crm") {
    return ["/dashboard", "/analytics", "/team", "/settings"]
  }
  if (kind === "community") {
    return ["/dashboard", "/about", "/team", "/settings"]
  }
  if (kind === "blog") {
    return ["/dashboard", "/docs", "/downloads", "/pricing"]
  }
  return ["/dashboard", "/tasks", "/analytics", "/reports", "/automations", "/settings"]
}

function pickPriorityRoutes(project, routes) {
  const kind = String(project?.spec?.kind || "").trim()
  const normalized = unique(routes.map((route) => normalizeRoute(route)))
  const priority = [""]

  if (kind === "code_platform") {
    priority.push("/dashboard", "/editor", "/runs", "/templates", "/pricing")
  } else {
    priority.push("/dashboard", "/tasks", "/analytics", "/reports", "/automations", "/approvals", "/handoff", "/playbooks")
  }

  const merged = unique([...priority, ...normalized]).filter((route) => route === "" || normalized.includes(route) || priority.includes(route))
  return merged.slice(0, 8)
}

function pickAssignedHostRoutes(routes) {
  const normalized = unique(routes.map((route) => normalizeRoute(route)))
  const preferred = ["", "/dashboard", "/tasks", "/reports", "/handoff"]
  return unique([...preferred, ...normalized]).filter((route) => route === "" || normalized.includes(route)).slice(0, 5)
}

function buildExpectedMarkers(project) {
  const markers = [
    String(project?.presentation?.displayName || "").trim(),
    String(project?.presentation?.subtitle || "").trim(),
    String(project?.presentation?.summary || "").trim(),
    String(project?.delivery?.assignedDomain || "").replace(/^https?:\/\//, "").trim(),
    "Assigned domain",
    "Preview / Dashboard / Code",
    "Open App",
  ]
  return unique(markers.filter((item) => item.length >= 3))
}

async function fetchProjectDetailById(projectId) {
  if (!projectId) return null
  const response = await fetch(`${baseUrl}/api/projects?projectId=${encodeURIComponent(projectId)}`, {
    method: "GET",
    headers: {
      accept: "application/json",
    },
  })
  const json = await response.json().catch(() => ({}))
  if (!response.ok || !json?.project) {
    return null
  }
  return {
    response,
    project: json.project,
  }
}

async function fetchProjectDetailFromList() {
  const response = await fetch(`${baseUrl}/api/projects`, {
    method: "GET",
    headers: {
      accept: "application/json",
    },
  })
  const json = await response.json().catch(() => ({}))
  const projects = Array.isArray(json?.projects) ? json.projects : []
  const matched = projects.find((item) => {
    const canonicalUrl = String(item?.preview?.canonicalUrl || "")
    const assignedDomain = String(item?.delivery?.assignedDomain || "").replace(/^https?:\/\//, "")
    return (
      item?.projectId === projectKey ||
      item?.projectId === projectIdCandidate ||
      canonicalUrl.endsWith(`/preview/${projectKey}`) ||
      canonicalUrl.includes(`/preview/${projectKey}/`) ||
      assignedDomain.startsWith(`${projectKey}.`) ||
      assignedDomain === projectKey
    )
  })
  if (!matched) return null

  const detail = await fetchProjectDetailById(String(matched.projectId))
  return detail || { response, project: matched }
}

async function resolveProjectDetail() {
  return (await fetchProjectDetailById(projectIdCandidate)) || (await fetchProjectDetailFromList())
}

async function fetchHtml(pathname, hostOverride) {
  if (hostOverride) {
    return fetchHtmlWithHostOverride(pathname, hostOverride)
  }
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "GET",
    redirect: "follow",
    headers: {
      accept: "text/html",
    },
  })
  const text = await response.text()
  return { response, text }
}

function fetchHtmlWithHostOverride(pathname, hostOverride, redirectCount = 0) {
  const target = new URL(baseUrl)
  const transport = target.protocol === "https:" ? https : http
  const requestPath = pathname.startsWith("/") ? pathname : `/${pathname}`

  return new Promise((resolve, reject) => {
    const req = transport.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || (target.protocol === "https:" ? 443 : 80),
        path: requestPath,
        method: "GET",
        headers: {
          accept: "text/html",
          host: hostOverride,
        },
      },
      (res) => {
        let body = ""
        res.setEncoding("utf8")
        res.on("data", (chunk) => {
          body += chunk
        })
        res.on("end", async () => {
          const status = Number(res.statusCode || 0)
          const location = String(res.headers.location || "")
          if (location && status >= 300 && status < 400 && redirectCount < 5) {
            try {
              const nextUrl = new URL(location, `${target.protocol}//${hostOverride}`)
              const redirected = await fetchHtmlWithHostOverride(`${nextUrl.pathname}${nextUrl.search}`, hostOverride, redirectCount + 1)
              resolve(redirected)
              return
            } catch (error) {
              reject(error)
              return
            }
          }
          resolve({
            response: {
              ok: status >= 200 && status < 300,
              status,
            },
            text: body,
          })
        })
      }
    )

    req.on("error", reject)
    req.end()
  })
}

function evaluateHtml(text, markers) {
  const hasProjectNotFound = /Project not found/i.test(text)
  const matchedMarker = markers.find((marker) => text.includes(marker)) || ""
  const hasPreviewSurface = Boolean(matchedMarker)
  return {
    hasProjectNotFound,
    hasPreviewSurface,
    matchedMarker,
  }
}

async function run() {
  let failures = 0

  const detail = await resolveProjectDetail()
  if (!detail?.project) {
    console.error(`[FAIL] could not resolve project detail for projectKey=${projectKey} projectId=${projectIdCandidate}`)
    process.exit(1)
  }

  const project = detail.project
  const projectId = String(project?.projectId || projectIdCandidate)
  const buildStatus = String(project?.generation?.buildStatus ?? "missing")
  const previewStatus = String(project?.preview?.status ?? "missing")
  const fallbackReason = String(project?.preview?.fallbackReason ?? "")
  const detailOk = buildStatus !== "missing" && previewStatus !== "missing"
  if (!detailOk) failures += 1
  console.log(
    `[${detailOk ? "OK" : "FAIL"}] project detail projectId=${projectId} buildStatus=${buildStatus} previewStatus=${previewStatus} fallbackReason=${fallbackReason || "none"}`
  )

  const projectRoutes = Array.isArray(project?.presentation?.routes) ? project.presentation.routes : []
  const routes = pickPriorityRoutes(
    project,
    unique(["", ...projectRoutes.map((route) => normalizeRoute(route)), ...buildFallbackRoutes(project).map((route) => normalizeRoute(route))])
  )
  const markers = buildExpectedMarkers(project)

  for (const route of routes) {
    const label = route ? `canonical ${route}` : "canonical root"
    const pathname = route ? `/preview/${encodeURIComponent(projectKey)}${route}` : `/preview/${encodeURIComponent(projectKey)}`
    try {
      const { response, text } = await fetchHtml(pathname)
      const { hasProjectNotFound, hasPreviewSurface, matchedMarker } = evaluateHtml(text, markers)
      const ok = response.ok && !hasProjectNotFound && hasPreviewSurface
      if (!ok) failures += 1
      console.log(
        `[${ok ? "OK" : "FAIL"}] ${label} status=${response.status} marker=${matchedMarker || "none"} url=${baseUrl}${pathname}`
      )
    } catch (error) {
      failures += 1
      console.log(`[FAIL] ${label} url=${baseUrl}${pathname} error=${error instanceof Error ? error.message : String(error)}`)
    }
  }

  const assignedDomain = String(project?.delivery?.assignedDomain || "").replace(/^https?:\/\//, "").trim()
  if (assignedDomain) {
    const hostChecks = pickAssignedHostRoutes(routes)
    for (const route of hostChecks) {
      const label = route ? `assigned host ${route}` : "assigned host root"
      const pathname = route || "/"
      try {
        const { response, text } = await fetchHtml(pathname, assignedDomain)
        const { hasProjectNotFound, hasPreviewSurface, matchedMarker } = evaluateHtml(text, markers)
        const ok = response.ok && !hasProjectNotFound && hasPreviewSurface
        if (!ok) failures += 1
        console.log(
          `[${ok ? "OK" : "FAIL"}] ${label} status=${response.status} marker=${matchedMarker || "none"} host=${assignedDomain} url=${baseUrl}${pathname}`
        )
      } catch (error) {
        failures += 1
        console.log(`[FAIL] ${label} host=${assignedDomain} url=${baseUrl}${pathname} error=${error instanceof Error ? error.message : String(error)}`)
      }
    }
  } else {
    console.log("[INFO] assigned host checks skipped because the project does not expose an assigned domain")
  }

  if (failures > 0) {
    process.exit(1)
  }
}

await run()
