"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { submitDirectGenerate } from "@/lib/direct-generate-client"
import {
  getCurrentDomainRegion,
  loadGenerationPreferences,
} from "@/lib/generation-preferences"
import { useLocale } from "@/lib/i18n"
import { RecentGenerations } from "@/components/dashboard/recent-generations"

type ProjectItem = {
  projectId: string
  region: "cn" | "intl"
  createdAt: string
  updatedAt: string
  historyCount: number
  generation?: {
    status: "done" | "error" | "idle"
    summary: string
    buildStatus: "ok" | "failed" | "skipped" | null
    createdAt: string | null
  }
  presentation: {
    displayName: string
    subtitle: string
    summary: string
    icon: {
      glyph: string
      from: string
      to: string
      ring: string
    }
  }
  runtime?: {
    status: "stopped" | "starting" | "running" | "error"
    port?: number
    url?: string
  }
  preview?: {
    defaultMode: "static_ssr"
    activeMode?: "static_ssr" | "dynamic_runtime" | "sandbox_runtime"
    status?: "idle" | "building" | "ready" | "failed"
    canonicalUrl: string
    runtimeUrl: string
    resolvedUrl?: string
    fallbackReason?: string
    supportsDynamicRuntime: boolean
    supportsSandboxRuntime: boolean
  }
}

function buildAcceptanceLabel(status?: "ok" | "failed" | "skipped" | null) {
  if (status === "ok") return "build: passed"
  if (status === "failed") return "build: failed"
  if (status === "skipped") return "build: skipped"
  return "build: pending"
}

function buildPreviewLabel(status?: "idle" | "building" | "ready" | "failed") {
  if (status === "ready") return "preview: ready"
  if (status === "failed") return "preview: failed"
  if (status === "building") return "preview: building"
  return "preview: idle"
}

export default function ProjectsPage() {
  const { locale } = useLocale()
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [prompt, setPrompt] = useState("")
  const [creating, setCreating] = useState(false)
  const [status, setStatus] = useState("")
  const router = useRouter()

  async function loadProjects() {
    const res = await fetch("/api/projects")
    if (!res.ok) return
    const json = await res.json()
    setProjects((json.projects ?? []) as ProjectItem[])
  }

  async function createProject() {
    try {
      setCreating(true)
      const preferences = loadGenerationPreferences(getCurrentDomainRegion())
      const result = await submitDirectGenerate({
        prompt,
        locale,
        preferences,
        onStatus: setStatus,
        messages: {
          emptyPrompt: locale === "zh" ? "请先输入需求。" : "Please enter a prompt.",
          creating: locale === "zh" ? "正在生成项目..." : "Generating project...",
          opening: locale === "zh" ? "项目已创建，正在进入工作区..." : "Project created. Opening workspace...",
        },
      })

      setPrompt("")
      await loadProjects()
      router.push(`/apps/${result.projectId}?jobId=${encodeURIComponent(result.jobId)}`)
    } catch (e: any) {
      setStatus(e?.message || (locale === "zh" ? "生成失败" : "Generate failed"))
    } finally {
      setCreating(false)
    }
  }

  useEffect(() => {
    loadProjects()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Projects</h1>
        <p className="text-muted-foreground mt-1">
          Generate, run, and iterate your apps in one workspace.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="font-medium">Create New Project</div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input
              placeholder="Describe your MVP idea..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-w-0"
            />
            <Button onClick={createProject} disabled={creating} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-1.5" />
              {creating ? "Generating..." : "Generate"}
            </Button>
          </div>
          {status ? <p className="text-xs text-muted-foreground mt-2">{status}</p> : null}
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {projects.map((project) => (
          <Card key={project.projectId} className="hover:border-primary/50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-semibold text-white"
                  style={{ background: `linear-gradient(135deg, ${project.presentation.icon.from}, ${project.presentation.icon.to})`, boxShadow: `0 0 0 1px ${project.presentation.icon.ring}` }}
                >
                  {project.presentation.icon.glyph}
                </div>
                <div>
                  <div className="font-medium">{project.presentation.displayName}</div>
                  <div className="text-xs text-muted-foreground">{project.presentation.subtitle}</div>
                </div>
              </div>
              <Badge
                variant={
                  project.runtime?.status === "running"
                    ? "default"
                    : project.runtime?.status === "starting"
                    ? "secondary"
                    : project.runtime?.status === "error"
                    ? "destructive"
                    : "outline"
                }
              >
                {project.runtime?.status ?? "stopped"}
              </Badge>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{project.presentation.summary}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Badge variant="outline">{buildAcceptanceLabel(project.generation?.buildStatus)}</Badge>
                <Badge variant="outline">{buildPreviewLabel(project.preview?.status)}</Badge>
                {project.preview?.activeMode ? <Badge variant="outline">{project.preview.activeMode}</Badge> : null}
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span>Region: {project.region.toUpperCase()}</span>
                <span>Events: {project.historyCount}</span>
                <span>Updated: {new Date(project.updatedAt).toLocaleString()}</span>
              </div>
              {project.preview?.fallbackReason ? (
                <p className="mt-3 text-xs text-amber-700">{project.preview.fallbackReason}</p>
              ) : null}
              <div className="flex gap-2 mt-4">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/apps/${project.projectId}`}>Open Workspace</Link>
                </Button>
                {(project.preview?.resolvedUrl || project.preview?.canonicalUrl) ? (
                  <Button variant="ghost" size="sm" asChild>
                    <a href={project.preview.resolvedUrl || project.preview.canonicalUrl} target="_blank" rel="noreferrer">
                      Open Preview
                    </a>
                  </Button>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}

        {!projects.length ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">
              No projects yet. Create one with a prompt above.
            </CardContent>
          </Card>
        ) : null}
      </div>

      <RecentGenerations />
    </div>
  )
}
