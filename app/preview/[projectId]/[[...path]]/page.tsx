import { notFound } from "next/navigation"
import { CanonicalPreviewPage } from "@/components/preview/canonical-preview-page"
import { buildProjectPresentation } from "@/lib/project-presentation"
import { readProjectSpec } from "@/lib/project-spec"
import { getProject, resolveProjectPath, safeProjectId } from "@/lib/project-workspace"

export const runtime = "nodejs"

export default async function PreviewProjectPage({
  params,
}: {
  params: Promise<{ projectId: string; path?: string[] }>
}) {
  const { projectId: projectIdRaw, path = [] } = await params
  const projectId = safeProjectId(projectIdRaw)
  const project = await getProject(projectId)
  if (!project) {
    notFound()
  }

  const projectDir = await resolveProjectPath(projectId)
  const spec = projectDir ? await readProjectSpec(projectDir) : null
  const latestHistory = project.history?.length ? project.history[project.history.length - 1] : null
  const presentation = buildProjectPresentation({
    projectId,
    region: project.region,
    spec,
    latestHistory,
  })

  const page = String(path?.[0] ?? "").trim().replace(/^\/+/, "")
  const allowedPages = new Set(
    (presentation.routes.length ? presentation.routes : ["/dashboard", "/editor", "/runs", "/templates", "/pricing"])
      .map((route) => route.replace(/^\//, ""))
  )
  const normalizedPage = page || (allowedPages.has("dashboard") ? "dashboard" : Array.from(allowedPages)[0] || "dashboard")

  if (!allowedPages.has(normalizedPage)) {
    notFound()
  }

  return (
    <CanonicalPreviewPage
      projectId={projectId}
      region={project.region}
      page={normalizedPage}
      spec={spec}
      presentation={presentation}
      history={[...project.history].reverse().slice(0, 5)}
    />
  )
}
