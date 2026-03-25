import path from "path"
import { promises as fs } from "fs"
import { buildSandboxPreviewUrl, type PreviewMode } from "@/lib/preview-url"

type SandboxInstance = {
  sandboxId?: string
  domain?: (port: number) => string | Promise<string>
  writeFiles?: (files: Array<{ path: string; content: Buffer | string }>) => Promise<void>
  mkDir?: (dirPath: string) => Promise<void>
  runCommand?: (command: string, args?: string[], options?: Record<string, unknown>) => Promise<{ cmdId?: string }>
  stop?: () => Promise<void>
}

type SandboxSdk = {
  Sandbox: {
    create: (options?: Record<string, unknown>) => Promise<SandboxInstance>
    get?: (options: { sandboxId: string }) => Promise<SandboxInstance>
  }
}

export type SandboxStartResult = {
  sandboxId: string
  proxyUrl: string
  externalUrl: string
  cmdId?: string
  snapshotId?: string
}

function sandboxAccessConfigured() {
  return Boolean(
    process.env.VERCEL ||
      process.env.VERCEL_OIDC_TOKEN ||
      process.env.VERCEL_TOKEN ||
      process.env.VERCEL_ACCESS_TOKEN ||
      process.env.VERCEL_SANDBOX_ENABLED
  )
}

export function getDefaultPreviewMode(): PreviewMode {
  return process.env.VERCEL ? "static_ssr" : "dynamic_runtime"
}

export function supportsSandboxRuntime() {
  return sandboxAccessConfigured()
}

export function getSandboxReadiness() {
  const hasOidc = Boolean(process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL)
  const hasTokenFlow = Boolean(process.env.VERCEL_TEAM_ID && process.env.VERCEL_PROJECT_ID && (process.env.VERCEL_TOKEN || process.env.VERCEL_ACCESS_TOKEN))
  let reason = ""

  if (hasOidc) {
    reason = "OIDC token available"
  } else if (hasTokenFlow) {
    reason = "Access token credentials available"
  } else {
    reason = "Missing VERCEL_OIDC_TOKEN or VERCEL_TEAM_ID + VERCEL_PROJECT_ID + VERCEL_TOKEN"
  }

  return {
    supported: hasOidc || hasTokenFlow,
    reason,
    authMode: hasOidc ? "oidc" : hasTokenFlow ? "token" : "missing",
  } as const
}

async function loadSandboxSdk(): Promise<SandboxSdk | null> {
  try {
    const req = (0, eval)("require") as NodeRequire
    return req("@vercel/sandbox") as SandboxSdk
  } catch {
    return null
  }
}

async function collectWorkspaceFiles(rootDir: string) {
  const files: Array<{ path: string; content: Buffer }> = []

  async function walk(currentDir: string) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true })
    for (const entry of entries) {
      const absolute = path.join(currentDir, entry.name)
      const relative = path.relative(rootDir, absolute).replace(/\\/g, "/")
      if (!relative) continue
      if (
        relative.startsWith("node_modules/") ||
        relative.startsWith(".next/") ||
        relative.startsWith(".git/") ||
        relative === ".mornstack-preview.log"
      ) {
        continue
      }
      if (entry.isDirectory()) {
        await walk(absolute)
        continue
      }
      if (!entry.isFile()) continue
      files.push({
        path: relative,
        content: await fs.readFile(absolute),
      })
    }
  }

  await walk(rootDir)
  return files
}

function normalizeSandboxDomain(raw: string) {
  const value = String(raw || "").trim()
  if (!value) {
    throw new Error("Sandbox did not return a preview domain.")
  }
  if (/^https?:\/\//i.test(value)) {
    return value.replace(/\/+$/, "")
  }
  return `https://${value.replace(/^\/+/, "").replace(/\/+$/, "")}`
}

export async function startSandboxPreview(args: {
  projectId: string
  workspacePath: string
}) {
  const { projectId, workspacePath } = args
  if (!supportsSandboxRuntime()) {
    throw new Error("Sandbox runtime is not enabled. Configure Vercel Sandbox credentials first.")
  }

  const sdk = await loadSandboxSdk()
  if (!sdk?.Sandbox?.create) {
    throw new Error("Sandbox SDK is unavailable. Install @vercel/sandbox in the runtime environment.")
  }

  const files = await collectWorkspaceFiles(workspacePath)
  if (!files.length) {
    throw new Error("Workspace files are unavailable for sandbox preview.")
  }

  const sandboxCreateOptions: Record<string, unknown> = {
    runtime: process.env.VERCEL_SANDBOX_RUNTIME || "node22",
    timeout: process.env.VERCEL_SANDBOX_TIMEOUT || "30m",
    ports: [3000],
  }

  if (!process.env.VERCEL_OIDC_TOKEN && !process.env.VERCEL) {
    sandboxCreateOptions.teamId = process.env.VERCEL_TEAM_ID
    sandboxCreateOptions.projectId = process.env.VERCEL_PROJECT_ID
    sandboxCreateOptions.token = process.env.VERCEL_TOKEN || process.env.VERCEL_ACCESS_TOKEN
  }

  const sandbox = await sdk.Sandbox.create(sandboxCreateOptions)

  if (!sandbox.sandboxId) {
    throw new Error("Sandbox did not return an id.")
  }

  if (sandbox.mkDir) {
    await sandbox.mkDir("app")
  }

  if (!sandbox.writeFiles) {
    throw new Error("Sandbox SDK does not support writeFiles.")
  }

  await sandbox.writeFiles(
    files.map((file) => ({
      path: `app/${file.path}`,
      content: file.content,
    }))
  )

  if (!sandbox.runCommand) {
    throw new Error("Sandbox SDK does not support runCommand.")
  }

  await sandbox.runCommand("corepack", ["enable"], { cwd: "/vercel/sandbox/app" })
  await sandbox.runCommand("pnpm", ["install", "--no-frozen-lockfile", "--prefer-offline"], { cwd: "/vercel/sandbox/app" })
  const cmd = await sandbox.runCommand(
    "pnpm",
    ["dev", "--hostname", "0.0.0.0", "--port", "3000"],
    { cwd: "/vercel/sandbox/app", detached: true }
  )

  if (!sandbox.domain) {
    throw new Error("Sandbox SDK does not expose a domain resolver.")
  }

  const externalUrl = normalizeSandboxDomain(await sandbox.domain(3000))
  return {
    sandboxId: sandbox.sandboxId,
    proxyUrl: buildSandboxPreviewUrl(projectId),
    externalUrl,
    cmdId: cmd?.cmdId,
  } satisfies SandboxStartResult
}

export async function stopSandboxPreview(sandboxId?: string) {
  if (!sandboxId) return
  const sdk = await loadSandboxSdk()
  if (!sdk?.Sandbox?.get) return
  try {
    const sandbox = await sdk.Sandbox.get({ sandboxId })
    await sandbox.stop?.()
  } catch {
    // noop
  }
}

export async function getSandboxPreviewUrl(sandboxId?: string) {
  if (!sandboxId) return null
  const sdk = await loadSandboxSdk()
  if (!sdk?.Sandbox?.get) return null
  const sandbox = await sdk.Sandbox.get({ sandboxId })
  if (!sandbox.domain) return null
  return normalizeSandboxDomain(await sandbox.domain(3000))
}
