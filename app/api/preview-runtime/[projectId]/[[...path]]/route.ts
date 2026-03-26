import { NextResponse } from "next/server"
import { buildCanonicalPreviewUrl } from "@/lib/preview-url"
import { getProject, safeProjectId } from "@/lib/project-workspace"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function buildPreviewBase(projectId: string) {
  return `/api/preview-runtime/${encodeURIComponent(projectId)}`
}

function rewriteHtmlForSandboxPreview(html: string, projectId: string) {
  const previewBase = buildPreviewBase(projectId)
  let next = html
  next = next.replace(/(href|src|action)=("|')\/(?!\/)/g, `$1=$2${previewBase}/`)
  next = next.replace(/(["'])\/_next\//g, `$1${previewBase}/_next/`)
  next = next.replace(/(["'])\/favicon/g, `$1${previewBase}/favicon`)
  next = next.replace(/url\(\/(?!\/)/g, `url(${previewBase}/`)
  return next
}

async function proxy(req: Request, projectIdRaw: string, pathSegments: string[]) {
  const projectId = safeProjectId(projectIdRaw)
  const project = await getProject(projectId)
  const fallback = buildCanonicalPreviewUrl(project?.projectSlug || projectId, pathSegments.join("/"))
  const sandboxUrl = String(project?.sandboxRuntime?.url ?? "").trim()

  if (!project || project.sandboxRuntime?.status !== "running" || !sandboxUrl) {
    return NextResponse.redirect(new URL(fallback, req.url))
  }

  const target = new URL(sandboxUrl)
  const suffix = pathSegments.join("/")
  target.pathname = suffix ? `/${suffix.replace(/^\/+/, "")}` : "/"
  target.search = new URL(req.url).search

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers: req.headers,
      body: req.method === "GET" || req.method === "HEAD" ? undefined : await req.arrayBuffer(),
      redirect: "manual",
      cache: "no-store",
      duplex: "half",
    } as RequestInit)

    if (!upstream.ok && req.method === "GET") {
      return NextResponse.redirect(new URL(fallback, req.url))
    }

    const headers = new Headers(upstream.headers)
    headers.delete("content-encoding")
    headers.delete("content-length")
    headers.set("cache-control", "no-store")

    const contentType = headers.get("content-type") || ""
    if (contentType.includes("text/html")) {
      const html = await upstream.text()
      return new NextResponse(rewriteHtmlForSandboxPreview(html, projectId), {
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
  } catch {
    return NextResponse.redirect(new URL(fallback, req.url))
  }
}

export async function GET(req: Request, context: { params: Promise<{ projectId: string; path?: string[] }> }) {
  const { projectId, path } = await context.params
  return proxy(req, projectId, path ?? [])
}

export async function POST(req: Request, context: { params: Promise<{ projectId: string; path?: string[] }> }) {
  const { projectId, path } = await context.params
  return proxy(req, projectId, path ?? [])
}
