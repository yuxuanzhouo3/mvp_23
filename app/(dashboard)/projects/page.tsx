"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

type ProjectItem = {
  projectId: string
  region: "cn" | "intl"
  createdAt: string
  updatedAt: string
  historyCount: number
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
    canonicalUrl: string
    runtimeUrl: string
    supportsDynamicRuntime: boolean
    supportsSandboxRuntime: boolean
  }
}

export default function ProjectsPage() {
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
    const text = prompt.trim()
    if (!text) {
      setStatus("Please enter a prompt.")
      return
    }
    try {
      setCreating(true)
      setStatus("Generating project...")
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text }),
      })
      const json = await res.json()
      if (!res.ok) {
        setStatus(json?.error || "Generate failed")
        return
      }
      const projectId = json.projectId || json.jobId
      const jobId = json.jobId || json.projectId
      setPrompt("")
      await loadProjects()
      router.push(`/apps/${projectId}?jobId=${encodeURIComponent(jobId)}`)
    } catch (e: any) {
      setStatus(e?.message || "Generate failed")
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
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span>Region: {project.region.toUpperCase()}</span>
                <span>Events: {project.historyCount}</span>
                <span>Updated: {new Date(project.updatedAt).toLocaleString()}</span>
              </div>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/apps/${project.projectId}`}>Open Workspace</Link>
                </Button>
                {project.preview?.canonicalUrl ? (
                  <Button variant="ghost" size="sm" asChild>
                    <a href={project.preview.canonicalUrl} target="_blank" rel="noreferrer">
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
    </div>
  )
}
