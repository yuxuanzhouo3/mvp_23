import { NextResponse } from "next/server"
import { buildCanonicalPreviewUrl } from "@/lib/preview-url"
import { getProject, safeProjectId } from "@/lib/project-workspace"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function proxy(req: Request, projectIdRaw: string, pathSegments: string[]) {
  const projectId = safeProjectId(projectIdRaw)
  const project = await getProject(projectId)
  const fallback = buildCanonicalPreviewUrl(projectId, pathSegments.join("/"))
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

    const headers = new Headers(upstream.headers)
    headers.delete("content-encoding")
    headers.delete("content-length")
    headers.set("cache-control", "no-store")
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
