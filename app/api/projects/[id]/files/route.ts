import path from "path"
import { promises as fs } from "fs"
import { NextResponse } from "next/server"
import { resolveProjectPath, safeProjectId } from "@/lib/project-workspace"

export const runtime = "nodejs"

const IGNORED_DIRS = new Set(["node_modules", ".next", ".git"])
const MAX_FILE_SIZE = 512 * 1024
const SEARCH_FILE_LIMIT = 200
const SEARCH_SNIPPET_LIMIT = 60

function normalizeRelativePath(filePath: string) {
  return filePath.replace(/\\/g, "/").replace(/^\/+/, "")
}

async function walkFiles(root: string, current = ""): Promise<string[]> {
  const dirPath = path.join(root, current)
  const entries = await fs.readdir(dirPath, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue
    const relative = current ? path.join(current, entry.name) : entry.name
    if (entry.isDirectory()) {
      files.push(...(await walkFiles(root, relative)))
    } else if (entry.isFile()) {
      files.push(normalizeRelativePath(relative))
    }
  }

  return files
}

function extractSymbols(content: string) {
  const lines = content.split(/\r?\n/)
  const symbols: Array<{ kind: string; name: string; line: number }> = []

  lines.forEach((line, index) => {
    const trimmed = line.trim()
    const patterns: Array<{ kind: string; re: RegExp }> = [
      { kind: "function", re: /^(?:export\s+)?function\s+([A-Za-z0-9_]+)/ },
      { kind: "component", re: /^(?:export\s+default\s+)?function\s+([A-Z][A-Za-z0-9_]+)/ },
      { kind: "const", re: /^(?:export\s+)?const\s+([A-Za-z0-9_]+)/ },
      { kind: "type", re: /^(?:export\s+)?type\s+([A-Za-z0-9_]+)/ },
      { kind: "interface", re: /^(?:export\s+)?interface\s+([A-Za-z0-9_]+)/ },
      { kind: "class", re: /^(?:export\s+)?class\s+([A-Za-z0-9_]+)/ },
    ]
    for (const pattern of patterns) {
      const match = trimmed.match(pattern.re)
      if (match?.[1]) {
        symbols.push({ kind: pattern.kind, name: match[1], line: index + 1 })
        break
      }
    }
  })

  return symbols.slice(0, 40)
}

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const projectId = safeProjectId(id)
  const workspacePath = await resolveProjectPath(projectId)

  if (!workspacePath) {
    return NextResponse.json({ error: "Workspace path not found", projectId }, { status: 404 })
  }

  const { searchParams } = new URL(req.url)
  const requestedPath = normalizeRelativePath(searchParams.get("path") || "")
  const searchQuery = String(searchParams.get("q") || "").trim().toLowerCase()

  if (!requestedPath && !searchQuery) {
    const files = await walkFiles(workspacePath)
    return NextResponse.json({ projectId, files })
  }

  if (!requestedPath && searchQuery) {
    const files = (await walkFiles(workspacePath)).slice(0, SEARCH_FILE_LIMIT)
    const results: Array<{
      path: string
      matches: Array<{ line: number; preview: string }>
      symbols: Array<{ kind: string; name: string; line: number }>
    }> = []

    for (const relativePath of files) {
      const absolutePath = path.resolve(workspacePath, relativePath)
      const stat = await fs.stat(absolutePath).catch(() => null)
      if (!stat || !stat.isFile() || stat.size > MAX_FILE_SIZE) continue
      const content = await fs.readFile(absolutePath, "utf8").catch(() => "")
      if (!content) continue

      const lines = content.split(/\r?\n/)
      const matches = lines
        .map((line, index) => ({ line: index + 1, preview: line }))
        .filter((item) => item.preview.toLowerCase().includes(searchQuery))
        .slice(0, 6)
        .map((item) => ({
          line: item.line,
          preview:
            item.preview.length > SEARCH_SNIPPET_LIMIT
              ? `${item.preview.slice(0, SEARCH_SNIPPET_LIMIT)}...`
              : item.preview,
        }))

      const symbols = extractSymbols(content).filter((item) => item.name.toLowerCase().includes(searchQuery)).slice(0, 8)

      if (matches.length || symbols.length || relativePath.toLowerCase().includes(searchQuery)) {
        results.push({ path: relativePath, matches, symbols })
      }
    }

    return NextResponse.json({ projectId, query: searchQuery, results: results.slice(0, 40) })
  }

  const absolutePath = path.resolve(workspacePath, requestedPath)
  if (!absolutePath.startsWith(path.resolve(workspacePath) + path.sep) && absolutePath !== path.resolve(workspacePath)) {
    return NextResponse.json({ error: "Invalid file path", projectId }, { status: 400 })
  }

  const stat = await fs.stat(absolutePath).catch(() => null)
  if (!stat || !stat.isFile()) {
    return NextResponse.json({ error: "File not found", projectId }, { status: 404 })
  }
  if (stat.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "File too large to preview", projectId, path: requestedPath }, { status: 400 })
  }

  const content = await fs.readFile(absolutePath, "utf8")
  return NextResponse.json({ projectId, path: requestedPath, content, symbols: extractSymbols(content) })
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const projectId = safeProjectId(id)
  const workspacePath = await resolveProjectPath(projectId)

  if (!workspacePath) {
    return NextResponse.json({ error: "Workspace path not found", projectId }, { status: 404 })
  }

  const body = await req.json().catch(() => ({}))
  const requestedPath = normalizeRelativePath(String(body?.path ?? ""))
  const content = String(body?.content ?? "")

  if (!requestedPath) {
    return NextResponse.json({ error: "File path is required", projectId }, { status: 400 })
  }

  const absolutePath = path.resolve(workspacePath, requestedPath)
  if (!absolutePath.startsWith(path.resolve(workspacePath) + path.sep) && absolutePath !== path.resolve(workspacePath)) {
    return NextResponse.json({ error: "Invalid file path", projectId }, { status: 400 })
  }

  const stat = await fs.stat(absolutePath).catch(() => null)
  if (!stat || !stat.isFile()) {
    return NextResponse.json({ error: "File not found", projectId }, { status: 404 })
  }

  await fs.writeFile(absolutePath, content, "utf8")
  return NextResponse.json({ projectId, path: requestedPath, saved: true })
}
