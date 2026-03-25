import { NextResponse } from "next/server"
import { buildCanonicalPreviewUrl } from "@/lib/preview-url"
import { readProjectSpec } from "@/lib/project-spec"
import { getProject, resolveProjectPath, safeProjectId } from "@/lib/project-workspace"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function buildTargetUrl(req: Request, projectId: string, port: number) {
  const incoming = new URL(req.url)
  const previewBase = buildPreviewBase(projectId)
  const suffix = incoming.pathname.startsWith(previewBase)
    ? incoming.pathname.slice(previewBase.length) || "/"
    : "/"
  const pathname = suffix.startsWith("/") ? suffix : `/${suffix}`
  const target = new URL(`http://127.0.0.1:${port}${pathname}`)
  target.search = incoming.search
  return target
}

function buildPreviewBase(projectId: string) {
  return `/api/projects/${encodeURIComponent(projectId)}/preview`
}

function isHtmlLikeRequest(req: Request, pathSegments: string[]) {
  if (pathSegments.length === 0) return true
  const accept = req.headers.get("accept") || ""
  if (accept.includes("text/html")) return true
  const last = pathSegments[pathSegments.length - 1] || ""
  return !/\.[a-z0-9]+$/i.test(last)
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

async function renderFallbackPreview(projectId: string) {
  const project = await getProject(projectId)
  const projectDir = await resolveProjectPath(projectId)
  const spec = projectDir ? await readProjectSpec(projectDir) : null
  const isCn = (project?.region ?? spec?.region) === "cn"
  const title = String(spec?.title ?? projectId)
  const subtitle = String(
    (spec as any)?.subtitle ??
      (isCn
        ? "当前运行环境没有成功拉起动态预览，这里先展示静态回退预览。"
        : "The live runtime preview is unavailable, so this static fallback preview is shown instead.")
  )
  const modules = Array.isArray((spec as any)?.modules) ? ((spec as any)?.modules as string[]) : []
  const features = Array.isArray((spec as any)?.features) ? ((spec as any)?.features as string[]) : []
  const latestHistory = project?.history?.slice(-3).reverse() ?? []
  const errorText = project?.runtime?.lastError ? String(project.runtime.lastError).slice(0, 600) : ""

  const html = `<!doctype html>
<html lang="${isCn ? "zh-CN" : "en"}">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)} Preview</title>
    <style>
      :root { color-scheme: light; }
      body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: linear-gradient(180deg,#faf7f2 0%,#f5efe5 100%); color: #261f17; }
      .shell { max-width: 1120px; margin: 0 auto; padding: 28px 18px 48px; }
      .hero { background: rgba(255,255,255,0.86); border: 1px solid rgba(113,91,55,0.14); border-radius: 28px; padding: 28px; box-shadow: 0 24px 60px rgba(101,80,46,0.08); }
      .eyebrow { display:inline-flex; padding:6px 12px; border-radius:999px; background:#f2e7d6; color:#7b5c2f; font-size:12px; font-weight:700; letter-spacing:.04em; text-transform:uppercase; }
      h1 { margin: 16px 0 10px; font-size: clamp(28px, 5vw, 52px); line-height: 1.05; }
      p { margin: 0; line-height: 1.7; color: #6b5a46; }
      .grid { display:grid; gap:18px; margin-top: 22px; grid-template-columns: repeat(12, minmax(0,1fr)); }
      .card { grid-column: span 12; background: rgba(255,255,255,0.9); border: 1px solid rgba(113,91,55,0.12); border-radius: 24px; padding: 22px; box-shadow: 0 18px 40px rgba(101,80,46,0.06); }
      .card h2 { margin: 0 0 12px; font-size: 18px; }
      .list { display:flex; flex-wrap:wrap; gap:10px; margin-top: 12px; }
      .pill { border-radius:999px; padding:8px 12px; background:#fff8ef; border:1px solid rgba(133,101,57,0.14); font-size:13px; color:#6d5630; }
      .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; white-space: pre-wrap; background:#fffaf2; border:1px solid rgba(180,120,42,0.18); color:#a95d12; border-radius:18px; padding:16px; font-size:12px; }
      .timeline { display:grid; gap:12px; }
      .entry { border-radius:18px; background:#fffdf9; border:1px solid rgba(113,91,55,0.10); padding:14px; }
      .meta { font-size:12px; color:#8a7558; text-transform:uppercase; letter-spacing:.04em; }
      @media (min-width: 860px) {
        .wide { grid-column: span 7; }
        .side { grid-column: span 5; }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <section class="hero">
        <div class="eyebrow">${isCn ? "Static fallback preview" : "Static fallback preview"}</div>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(subtitle)}</p>
      </section>
      <section class="grid">
        <article class="card wide">
          <h2>${isCn ? "产品模块" : "Product modules"}</h2>
          <div class="list">
            ${(modules.length ? modules : [isCn ? "工作台总览" : "Workspace overview", isCn ? "预览与交付" : "Preview and delivery", isCn ? "运行链路" : "Runtime flow"])
              .slice(0, 10)
              .map((item) => `<span class="pill">${escapeHtml(String(item))}</span>`)
              .join("")}
          </div>
          <h2 style="margin-top:20px;">${isCn ? "功能特征" : "Feature set"}</h2>
          <div class="list">
            ${(features.length ? features : ["preview", "delivery", "editor", "auth", "templates"])
              .slice(0, 12)
              .map((item) => `<span class="pill">${escapeHtml(String(item))}</span>`)
              .join("")}
          </div>
        </article>
        <aside class="card side">
          <h2>${isCn ? "运行状态" : "Runtime status"}</h2>
          <div class="list">
            <span class="pill">${escapeHtml(project?.runtime?.status ?? "stopped")}</span>
            <span class="pill">${escapeHtml(project?.deploymentTarget ?? "vercel")}</span>
            <span class="pill">${escapeHtml(project?.databaseTarget ?? "default-db")}</span>
          </div>
          ${errorText ? `<div class="mono" style="margin-top:16px;">${escapeHtml(errorText)}</div>` : ""}
        </aside>
        <article class="card">
          <h2>${isCn ? "最近生成记录" : "Recent generation history"}</h2>
          <div class="timeline">
            ${latestHistory.length
              ? latestHistory
                  .map(
                    (item) => `<div class="entry"><div class="meta">${escapeHtml(item.type)} · ${escapeHtml(item.status)}</div><div style="margin-top:8px;font-weight:700;">${escapeHtml(item.prompt)}</div><div style="margin-top:6px;color:#6b5a46;">${escapeHtml(item.summary ?? "")}</div></div>`
                  )
                  .join("")
              : `<div class="entry">${isCn ? "当前还没有可展示的生成历史。" : "No generation history is available yet."}</div>`}
          </div>
        </article>
      </section>
    </main>
  </body>
</html>`

  return new NextResponse(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
  })
}

function rewriteHtmlForPreview(html: string, projectId: string) {
  const previewBase = buildPreviewBase(projectId)
  let next = html

  next = next.replace(/(href|src|action)=("|')\/(?!\/)/g, `$1=$2${previewBase}/`)
  next = next.replace(/(["'])\/_next\//g, `$1${previewBase}/_next/`)
  next = next.replace(/(["'])\/favicon/g, `$1${previewBase}/favicon`)
  next = next.replace(/url\(\/(?!\/)/g, `url(${previewBase}/`)

  if (next.includes("</head>")) {
    next = next.replace(
      "</head>",
      `<script>window.__MORNSTACK_PREVIEW_BASE__=${JSON.stringify(previewBase)};</script></head>`
    )
  }

  return next
}

async function proxy(req: Request, projectIdRaw: string, pathSegments: string[]) {
  const projectId = safeProjectId(projectIdRaw)
  const project = await getProject(projectId)
  const runtimeState = project?.runtime
  const wantsHtml = isHtmlLikeRequest(req, pathSegments)
  const fallbackUrl = buildCanonicalPreviewUrl(projectId, pathSegments.join("/"))

  if (!project || !runtimeState?.port) {
    return wantsHtml
      ? NextResponse.redirect(new URL(fallbackUrl, req.url))
      : NextResponse.json({ error: "Preview runtime not available" }, { status: 404 })
  }

  const target = buildTargetUrl(req, projectId, runtimeState.port)
  let upstream: Response
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers: req.headers,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer(),
      redirect: "manual",
      cache: "no-store",
      duplex: "half",
    } as RequestInit)
  } catch {
    return wantsHtml
      ? NextResponse.redirect(new URL(fallbackUrl, req.url))
      : NextResponse.json({ error: "Preview upstream unavailable" }, { status: 502 })
  }

  if (!upstream.ok && req.method === "GET" && wantsHtml) {
    return NextResponse.redirect(new URL(fallbackUrl, req.url))
  }

  const headers = new Headers(upstream.headers)
  headers.delete("content-encoding")
  headers.delete("content-length")
  headers.delete("connection")
  headers.delete("host")
  headers.set("cache-control", "no-store")

  const contentType = headers.get("content-type") || ""
  if (contentType.includes("text/html")) {
    const html = await upstream.text()
    return new NextResponse(rewriteHtmlForPreview(html, projectId), {
      status: upstream.status,
      statusText: upstream.statusText,
      headers,
    })
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  })
}

export async function GET(req: Request, context: { params: Promise<{ id: string; path?: string[] }> }) {
  const { id, path } = await context.params
  return proxy(req, id, path ?? [])
}

export async function POST(req: Request, context: { params: Promise<{ id: string; path?: string[] }> }) {
  const { id, path } = await context.params
  return proxy(req, id, path ?? [])
}

export async function PUT(req: Request, context: { params: Promise<{ id: string; path?: string[] }> }) {
  const { id, path } = await context.params
  return proxy(req, id, path ?? [])
}

export async function PATCH(req: Request, context: { params: Promise<{ id: string; path?: string[] }> }) {
  const { id, path } = await context.params
  return proxy(req, id, path ?? [])
}

export async function DELETE(req: Request, context: { params: Promise<{ id: string; path?: string[] }> }) {
  const { id, path } = await context.params
  return proxy(req, id, path ?? [])
}
