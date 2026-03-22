import { NextResponse } from "next/server"
import { getProject, safeProjectId } from "@/lib/project-workspace"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function buildTargetUrl(req: Request, port: number, pathSegments: string[]) {
  const incoming = new URL(req.url)
  const pathname = pathSegments.length ? `/${pathSegments.join("/")}` : "/"
  const target = new URL(`http://127.0.0.1:${port}${pathname}`)
  target.search = incoming.search
  return target
}

async function proxy(req: Request, projectIdRaw: string, pathSegments: string[]) {
  const projectId = safeProjectId(projectIdRaw)
  const project = await getProject(projectId)
  const runtimeState = project?.runtime

  if (!project || !runtimeState?.port) {
    return NextResponse.json({ error: "Preview runtime is not available." }, { status: 404 })
  }

  const target = buildTargetUrl(req, runtimeState.port, pathSegments)
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
  headers.delete("connection")
  headers.delete("host")
  headers.set("cache-control", "no-store")

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

