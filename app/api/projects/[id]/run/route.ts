import { spawn } from "child_process"
import net from "net"
import { promises as fs } from "fs"
import path from "path"
import { NextResponse } from "next/server"
import {
  getProject,
  isPidAlive,
  listProjects,
  resolveProjectPath,
  safeProjectId,
  updateProject,
} from "@/lib/project-workspace"

export const runtime = "nodejs"

async function pathExists(filePath: string) {
  try {
    await fs.access(filePath)
    return true
  } catch {
    return false
  }
}

async function removePathIfExists(targetPath: string) {
  try {
    await fs.rm(targetPath, { recursive: true, force: true })
  } catch {
    // noop
  }
}

async function runCommand(
  cmd: string,
  args: string[],
  cwd: string,
  timeoutMs = 10 * 60 * 1000,
  envOverrides?: Record<string, string>
) {
  return new Promise<{ ok: boolean; output: string }>((resolve) => {
    const chunks: string[] = []
    let child
    if (process.platform === "win32" && (cmd === "npm" || cmd === "npm.cmd")) {
      const npmExecPath = process.env.npm_execpath
      const npmCli =
        npmExecPath && npmExecPath.endsWith(".js")
          ? npmExecPath
          : path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js")
      child = spawn(process.execPath, [npmCli, ...args], {
        cwd,
        windowsHide: true,
        shell: false,
        creationFlags: 0x08000000,
        env: {
          ...process.env,
          ...envOverrides,
        },
      })
    } else {
      child = spawn(cmd, args, {
        cwd,
        windowsHide: true,
        shell: false,
        creationFlags: process.platform === "win32" ? 0x08000000 : 0,
        env: {
          ...process.env,
          ...envOverrides,
        },
      })
    }
    const timer = setTimeout(() => {
      try {
        child.kill()
      } catch {
        // noop
      }
      resolve({ ok: false, output: `${chunks.join("")}\nCommand timeout.` })
    }, timeoutMs)

    child.stdout.on("data", (d) => chunks.push(String(d)))
    child.stderr.on("data", (d) => chunks.push(String(d)))
    child.on("error", (err) => {
      clearTimeout(timer)
      resolve({ ok: false, output: `${chunks.join("")}\n${err.message}` })
    })
    child.on("close", (code) => {
      clearTimeout(timer)
      resolve({ ok: code === 0, output: chunks.join("") })
    })
  })
}

function trimOutput(output: string, maxLen = 1600) {
  const text = String(output || "").trim()
  if (text.length <= maxLen) {
    return text
  }
  return `...${text.slice(text.length - maxLen)}`
}

async function isPortInUse(port: number) {
  return new Promise<boolean>((resolve) => {
    const socket = new net.Socket()
    socket.setTimeout(500)
    socket.once("connect", () => {
      socket.destroy()
      resolve(true)
    })
    socket.once("timeout", () => {
      socket.destroy()
      resolve(false)
    })
    socket.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "ECONNREFUSED" || err.code === "EHOSTUNREACH") {
        resolve(false)
        return
      }
      resolve(true)
    })
    socket.connect(port, "127.0.0.1")
  })
}

async function waitForPort(port: number, timeoutMs = 20_000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    if (await isPortInUse(port)) {
      return true
    }
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  return false
}

async function hasUsableInstall(workspacePath: string) {
  const nextBin = path.join(workspacePath, "node_modules", "next", "dist", "bin", "next")
  const reactServerDom = path.join(
    workspacePath,
    "node_modules",
    "next",
    "dist",
    "compiled",
    "react-server-dom-webpack",
    "client.js"
  )
  const reactPkg = path.join(workspacePath, "node_modules", "react", "package.json")
  return (await pathExists(nextBin)) && (await pathExists(reactServerDom)) && (await pathExists(reactPkg))
}

async function resolvePackageManager(workspacePath: string) {
  const pnpmCmd = process.platform === "win32" ? "pnpm.cmd" : "pnpm"
  const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm"
  const pnpmCheck = await runCommand(pnpmCmd, ["--version"], workspacePath, 15_000)
  if (pnpmCheck.ok) {
    return { cmd: pnpmCmd, kind: "pnpm" as const }
  }
  return { cmd: npmCmd, kind: "npm" as const }
}

async function installWorkspaceDependencies(packageManager: { cmd: string; kind: "pnpm" | "npm" }, workspacePath: string) {
  const attempts: Array<{ ok: boolean; output: string; label: string }> = []
  const installArgs =
    packageManager.kind === "pnpm"
      ? ["install", "--no-frozen-lockfile", "--prefer-offline"]
      : ["install", "--no-audit", "--no-fund"]

  const first = await runCommand(packageManager.cmd, installArgs, workspacePath)
  attempts.push({ ...first, label: "initial install" })
  if (first.ok && (await hasUsableInstall(workspacePath))) {
    return {
      ok: true,
      output: attempts.map((item) => `[${item.label}]\n${item.output}`.trim()).join("\n\n"),
    }
  }

  await removePathIfExists(path.join(workspacePath, "node_modules"))
  await removePathIfExists(path.join(workspacePath, "package-lock.json"))
  await removePathIfExists(path.join(workspacePath, "pnpm-lock.yaml"))

  if (packageManager.kind === "npm") {
    const cacheVerify = await runCommand(packageManager.cmd, ["cache", "verify"], workspacePath, 120_000)
    attempts.push({ ...cacheVerify, label: "cache verify" })
  }

  const secondArgs =
    packageManager.kind === "pnpm"
      ? ["install", "--no-frozen-lockfile", "--prefer-offline", "--force"]
      : [...installArgs, "--prefer-offline"]
  const second = await runCommand(packageManager.cmd, secondArgs, workspacePath)
  attempts.push({ ...second, label: "clean retry" })
  if (second.ok && (await hasUsableInstall(workspacePath))) {
    return {
      ok: true,
      output: attempts.map((item) => `[${item.label}]\n${item.output}`.trim()).join("\n\n"),
    }
  }

  const retrySignal = `${first.output}\n${second.output}`
  if (/ECONNRESET|TAR_ENTRY_ERROR|ENOENT|network/i.test(retrySignal)) {
    await removePathIfExists(path.join(workspacePath, "node_modules"))
    const thirdArgs =
      packageManager.kind === "pnpm"
        ? ["install", "--no-frozen-lockfile", "--prefer-offline", "--force"]
        : [...installArgs, "--prefer-offline", "--force"]
    const third = await runCommand(packageManager.cmd, thirdArgs, workspacePath)
    attempts.push({ ...third, label: "network recovery retry" })
    const usable = third.ok && (await hasUsableInstall(workspacePath))
    return {
      ok: usable,
      output: attempts.map((item) => `[${item.label}]\n${item.output}`.trim()).join("\n\n"),
    }
  }

  return {
    ok: false,
    output: attempts.map((item) => `[${item.label}]\n${item.output}`.trim()).join("\n\n"),
  }
}

function withinStartupGrace(lastStartedAt?: string, graceMs = 25_000) {
  if (!lastStartedAt) return false
  const started = Date.parse(lastStartedAt)
  if (Number.isNaN(started)) return false
  return Date.now() - started < graceMs
}

async function ensureIframeHeaders(workspacePath: string) {
  const configPath = path.join(workspacePath, "next.config.ts")
  if (!(await pathExists(configPath))) {
    return
  }
  const raw = await fs.readFile(configPath, "utf8")
  if (raw.includes("frame-ancestors") && raw.includes("X-Frame-Options")) {
    return
  }
  const merged = `import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "ALLOWALL" },
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self' http://localhost:3000 http://127.0.0.1:3000",
          },
        ],
      },
    ];
  },
};
export default nextConfig;
`
  await fs.writeFile(configPath, merged, "utf8")
}

async function repairLegacyPrismaImport(workspacePath: string) {
  const apiPath = path.join(workspacePath, "app", "api", "items", "route.ts")
  if (!(await pathExists(apiPath))) return
  const raw = await fs.readFile(apiPath, "utf8")
  const next = raw
    .replace('import { prisma } from "../../../../lib/prisma";', 'import { prisma } from "../../../lib/prisma";')
    .replace('import { prisma } from "../../lib/prisma";', 'import { prisma } from "../../../lib/prisma";')
  if (next !== raw) {
    await fs.writeFile(apiPath, next, "utf8")
  }
}

async function repairGeneratedTypeHotspots(workspacePath: string) {
  const layoutPath = path.join(workspacePath, "app", "layout.tsx")
  if (await pathExists(layoutPath)) {
    const raw = await fs.readFile(layoutPath, "utf8")
    const needsReactNodeImport =
      raw.includes("React.ReactNode") && !raw.includes('import type { ReactNode } from "react";')
    const next = needsReactNodeImport
      ? raw.replace(
          /export default function RootLayout\(\{ children \}: \{ children: React\.ReactNode \}\) \{/,
          'import type { ReactNode } from "react";\n\nexport default function RootLayout({ children }: { children: ReactNode }) {'
        )
      : raw
    if (next !== raw) {
      await fs.writeFile(layoutPath, next, "utf8")
    }
  }

  const analyticsPath = path.join(workspacePath, "app", "analytics", "page.tsx")
  if (await pathExists(analyticsPath)) {
    const raw = await fs.readFile(analyticsPath, "utf8")
    const next = raw
      .replace(
        /const owner = item\.assignee \|\| \(SPEC\.region === "cn" \? "未分配" : "Unassigned"\);/g,
        'const owner = item.assignee || "Unassigned";'
      )
      .replace(
        /<h1>\{SPEC\.region === "cn" \? "跟进分析" : "Workspace analytics"\}<\/h1>/g,
        "<h1>Workspace analytics</h1>"
      )
      .replace(
        /\{SPEC\.region === "cn" \? "基于当前 workspace 数据生成趋势和负责人分布。" : "Trend and owner distribution generated from current workspace data\."\}/g,
        "Trend and owner distribution generated from current workspace data."
      )
    if (next !== raw) {
      await fs.writeFile(analyticsPath, next, "utf8")
    }
  }

  const dashboardPath = path.join(workspacePath, "app", "dashboard", "page.tsx")
  if (await pathExists(dashboardPath)) {
    const raw = await fs.readFile(dashboardPath, "utf8")
    const next = raw.replace(/\{spec\.templateId \|\| spec\.kind\}/g, "{spec.kind}")
    if (next !== raw) {
      await fs.writeFile(dashboardPath, next, "utf8")
    }
  }

  const pagePath = path.join(workspacePath, "app", "page.tsx")
  if (await pathExists(pagePath)) {
    const raw = await fs.readFile(pagePath, "utf8")
    const proEliteDeclaration =
      'const PRO_STYLE = SPEC.planTier === "pro" || SPEC.planTier === "elite";\nconst ELITE_STYLE = SPEC.planTier === "elite";'
    let next = raw
      .replace(
        /const SPEC = (\{[\s\S]*?\}) as const;/,
        (match, payload) => {
          if (payload.includes('"templateStyle"') || payload.includes('"templateId"')) {
            return match
          }
          const withFields = `${payload.slice(0, -1)},\n  "templateId": null,\n  "templateStyle": null\n}`
          return `const SPEC = ${withFields} as const;`
        }
      )
      .replace(
        /meta: item\.assignee \|\| \(SPEC\.region === "cn" \? "未分配" : "Unassigned"\),/g,
        'meta: item.assignee || "Unassigned",'
      )

    if (!next.includes('const PRO_STYLE = SPEC.planTier === "pro" || SPEC.planTier === "elite";')) {
      next = next.replace(
        /const LANDING_STYLE = \["spa-landing", "cosmic-app", "launch-ui"\]\.includes\(String\(SPEC\.templateStyle \?\? ""\)\);\nconst BUILDER_STYLE = SPEC\.templateStyle === "purple-builder";/,
        `const LANDING_STYLE = ["spa-landing", "cosmic-app", "launch-ui"].includes(String(SPEC.templateStyle ?? ""));\nconst BUILDER_STYLE = SPEC.templateStyle === "purple-builder";\n${proEliteDeclaration}`
      )
    }

    next = next.replace(
      /(?:const PRO_STYLE = SPEC\.planTier === "pro" \|\| SPEC\.planTier === "elite";\nconst ELITE_STYLE = SPEC\.planTier === "elite";\n){2,}/g,
      `${proEliteDeclaration}\n`
    )

    if (next !== raw) {
      await fs.writeFile(pagePath, next, "utf8")
    }
  }
}

async function choosePort(projectId: string) {
  const projects = await listProjects()
  const used = new Set<number>()
  for (const item of projects) {
    if (item.runtime?.port && item.runtime.status === "running") {
      used.add(item.runtime.port)
    }
  }
  for (let p = 3001; p <= 3099; p += 1) {
    if (!used.has(p) && !(await isPortInUse(p))) {
      return p
    }
  }
  return 3100
}

async function readTail(filePath: string, maxLen = 2400) {
  try {
    const raw = await fs.readFile(filePath, "utf8")
    const text = raw.trim()
    if (!text) return ""
    return text.length > maxLen ? `...${text.slice(text.length - maxLen)}` : text
  } catch {
    return ""
  }
}

async function collectStartupDiagnostics(workspacePath: string, port: number) {
  const packageJsonPath = path.join(workspacePath, "package.json")
  const nextBin = path.join(workspacePath, "node_modules", "next", "dist", "bin", "next")
  const diagnostics = [
    `workspace: ${workspacePath}`,
    `port: ${port}`,
    `package.json: ${(await pathExists(packageJsonPath)) ? "present" : "missing"}`,
    `next bin: ${(await pathExists(nextBin)) ? "present" : "missing"}`,
    `usable install: ${(await hasUsableInstall(workspacePath)) ? "yes" : "no"}`,
  ]

  try {
    const raw = await fs.readFile(packageJsonPath, "utf8")
    const pkg = JSON.parse(raw) as { scripts?: Record<string, string>; dependencies?: Record<string, string> }
    diagnostics.push(`script.dev: ${pkg.scripts?.dev ?? "missing"}`)
    diagnostics.push(`dependency.next: ${pkg.dependencies?.next ?? "missing"}`)
  } catch {
    diagnostics.push("package.json parse: failed")
  }

  return diagnostics.join("\n")
}

async function startProject(projectId: string) {
  const project = await getProject(projectId)
  if (!project) {
    return NextResponse.json({ error: "Project not found", projectId }, { status: 404 })
  }

  if (
    project.runtime?.status === "running" &&
    ((Boolean(project.runtime.pid) && isPidAlive(project.runtime.pid)) ||
      (project.runtime.port ? await isPortInUse(project.runtime.port) : false) ||
      withinStartupGrace(project.runtime.lastStartedAt))
  ) {
    return NextResponse.json({
      projectId,
      status: "running",
      runtime: project.runtime,
      message: "Project is already running.",
    })
  }

  const workspacePath = await resolveProjectPath(projectId)
  if (!workspacePath) {
    return NextResponse.json({ error: "Workspace path not found", projectId }, { status: 404 })
  }

  const port = await choosePort(projectId)
  const logs: string[] = []
  const startupLogPath = path.join(workspacePath, ".mornstack-preview.log")
  const packageManager = await resolvePackageManager(workspacePath)
  logs.push(`package manager: ${packageManager.kind}`)

  await updateProject(projectId, (p) => ({
    ...p,
    runtime: {
      ...(p.runtime ?? { port, url: `http://localhost:${port}` }),
      status: "starting",
      port,
      url: `http://localhost:${port}`,
      lastStartedAt: new Date().toISOString(),
      lastError: undefined,
    },
  }))

  try {
    await ensureIframeHeaders(workspacePath)
    await repairLegacyPrismaImport(workspacePath)
    await repairGeneratedTypeHotspots(workspacePath)

    if (!(await hasUsableInstall(workspacePath))) {
      const install = await installWorkspaceDependencies(packageManager, workspacePath)
      logs.push(install.output)
      if (!install.ok) {
        const details = trimOutput(install.output)
        await updateProject(projectId, (p) => ({
          ...p,
          runtime: {
            ...(p.runtime ?? { port, url: `http://localhost:${port}` }),
            status: "error",
            port,
            url: `http://localhost:${port}`,
            lastError: `npm install failed${details ? `\n${details}` : ""}`,
          },
        }))
        return NextResponse.json(
          {
            projectId,
            status: "error",
            error: `npm install failed${details ? `\n${details}` : ""}`,
            logs,
          },
          { status: 500 }
        )
      }
    }

    if (await pathExists(path.join(workspacePath, "prisma", "schema.prisma"))) {
      const prismaBin = path.join(workspacePath, "node_modules", "prisma", "build", "index.js")
      if (await pathExists(prismaBin)) {
        const dbPush = await runCommand(process.execPath, [prismaBin, "db", "push"], workspacePath)
        logs.push(dbPush.output)
      }
    }

    await removePathIfExists(startupLogPath)
    const nextBin = path.join(workspacePath, "node_modules", "next", "dist", "bin", "next")
    const mode: "dev" = "dev"
    const startupLogHandle = await fs.open(startupLogPath, "a")
    const child = spawn(process.execPath, [nextBin, "dev", "--webpack", "-p", String(port)], {
      cwd: workspacePath,
      detached: true,
      stdio: ["ignore", startupLogHandle.fd, startupLogHandle.fd],
      windowsHide: true,
      creationFlags: process.platform === "win32" ? 0x08000000 : 0,
      env: {
        ...process.env,
        NODE_ENV: "development",
      },
    })
    child.unref()
    await startupLogHandle.close()

    const ready = await waitForPort(port, 45_000)
    if (!ready) {
      try {
        child.kill()
      } catch {
        // noop
      }
      const startupDetails = trimOutput(await readTail(startupLogPath))
      const diagnostics = await collectStartupDiagnostics(workspacePath, port)
      const failureText = `Preview server did not become ready in time.${startupDetails ? `\n\nStartup log:\n${startupDetails}` : ""}\n\nDiagnostics:\n${diagnostics}`
      await updateProject(projectId, (p) => ({
        ...p,
        runtime: {
          ...(p.runtime ?? { port, url: `http://localhost:${port}` }),
          status: "error",
          port,
          url: `http://localhost:${port}`,
          lastError: failureText,
        },
      }))
      return NextResponse.json(
        {
          projectId,
          status: "error",
          error: failureText,
          logs: [...logs, diagnostics, ...(startupDetails ? [startupDetails] : [])],
        },
        { status: 500 }
      )
    }

    const runtimePid = process.platform === "win32" ? undefined : child.pid
    await updateProject(projectId, (p) => ({
      ...p,
      updatedAt: new Date().toISOString(),
      runtime: {
        status: "running",
        mode,
        pid: runtimePid,
        port,
        url: `http://localhost:${port}`,
        lastStartedAt: new Date().toISOString(),
        lastError: undefined,
      },
    }))

    return NextResponse.json({
      projectId,
      status: "running",
      runtime: {
        status: "running",
        mode,
        pid: runtimePid,
        port,
        url: `http://localhost:${port}`,
        lastError: undefined,
      },
      logs,
    })
  } catch (error: any) {
    await updateProject(projectId, (p) => ({
      ...p,
      runtime: {
        ...(p.runtime ?? { port, url: `http://localhost:${port}` }),
        status: "error",
        port,
        url: `http://localhost:${port}`,
        lastError: error?.message || String(error),
      },
    }))
    return NextResponse.json(
      { projectId, status: "error", error: error?.message || String(error), logs },
      { status: 500 }
    )
  }
}

async function stopProject(projectId: string) {
  const project = await getProject(projectId)
  if (!project) {
    return NextResponse.json({ error: "Project not found", projectId }, { status: 404 })
  }

  const pid = project.runtime?.pid
  if (pid && isPidAlive(pid)) {
    try {
      if (process.platform === "win32") {
        await runCommand("taskkill", ["/PID", String(pid), "/T", "/F"], process.cwd(), 30_000)
      } else {
        process.kill(pid)
      }
    } catch {
      // noop
    }
  }

  const port = project.runtime?.port ?? 3001
  const url = `http://localhost:${port}`
  await updateProject(projectId, (p) => ({
    ...p,
    updatedAt: new Date().toISOString(),
    runtime: {
      status: "stopped",
      port,
      url,
    },
  }))

  return NextResponse.json({
    projectId,
    status: "stopped",
    runtime: {
      status: "stopped",
      port,
      url,
    },
  })
}

export async function GET(
  _req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const projectId = safeProjectId(id)
  const project = await getProject(projectId)
  if (!project) {
    return NextResponse.json({ error: "Project not found", projectId }, { status: 404 })
  }
  let runtime = project.runtime ?? { status: "stopped" as const, port: 3001, url: "http://localhost:3001" }
  if (runtime.status === "running") {
    const pidDead = Boolean(runtime.pid) && !isPidAlive(runtime.pid)
    const portDead = runtime.port ? !(await isPortInUse(runtime.port)) : true
    const inGrace = withinStartupGrace(runtime.lastStartedAt)
    if ((pidDead && portDead && !inGrace) || (!runtime.pid && portDead && !inGrace)) {
      runtime = { ...runtime, status: "stopped", pid: undefined }
      await updateProject(projectId, (p) => ({
        ...p,
        runtime,
      }))
    }
  }

  return NextResponse.json({ projectId, runtime })
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const projectId = safeProjectId(id)
  const body = await req.json().catch(() => ({}))
  const action = String(body?.action ?? "status")

  if (action === "start") {
    return startProject(projectId)
  }
  if (action === "stop") {
    return stopProject(projectId)
  }
  if (action === "restart") {
    await stopProject(projectId)
    return startProject(projectId)
  }

  return NextResponse.json({ error: "Invalid action. Use start|stop|restart." }, { status: 400 })
}
