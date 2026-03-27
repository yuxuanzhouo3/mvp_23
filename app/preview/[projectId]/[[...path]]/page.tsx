import { PreviewRouteClient } from "@/components/preview/preview-route-client"
import { buildProjectLookupLogPayload, resolveProjectLookup } from "@/lib/project-lookup"
import { buildProjectPresentation } from "@/lib/project-presentation"
import { readProjectSpec } from "@/lib/project-spec"
import type { PreviewSnapshot } from "@/lib/preview-snapshot"
import { resolveProjectPath } from "@/lib/project-workspace"

export const runtime = "nodejs"

export default async function PreviewProjectPage({
  params,
}: {
  params: Promise<{ projectId: string; path?: string[] }>
}) {
  const { projectId: projectIdRaw, path = [] } = await params
  const lookup = await resolveProjectLookup(projectIdRaw)
  const project = lookup.project
  const projectId = lookup.projectId ?? projectIdRaw
  if (process.env.NODE_ENV !== "production") {
    console.info("[preview:lookup]", buildProjectLookupLogPayload(lookup))
  }
  const page = String(path?.[0] ?? "").trim().replace(/^\/+/, "")
  let initialSnapshot: PreviewSnapshot | null = null

  if (project) {
    const projectDir = await resolveProjectPath(projectId)
    const spec = projectDir ? await readProjectSpec(projectDir) : null
    const latestHistory = project.history?.length ? project.history[project.history.length - 1] : null
    const presentation = buildProjectPresentation({
      projectId,
      region: project.region,
      spec,
      latestHistory,
    })
    const allowedPages = new Set(
      (presentation.routes.length ? presentation.routes : ["/dashboard", "/editor", "/runs", "/templates", "/pricing"])
        .map((route) => route.replace(/^\//, ""))
    )
    const normalizedPage = page || (allowedPages.has("dashboard") ? "dashboard" : Array.from(allowedPages)[0] || "dashboard")

    if (!allowedPages.has(normalizedPage)) {
      notFound()
    }

    initialSnapshot = {
      projectId,
      projectSlug: lookup.projectSlug || projectId,
      region: project.region,
      spec,
      presentation,
      history: [...project.history].reverse().slice(0, 5),
      updatedAt: project.updatedAt,
      source: "server",
    }
  }

  return (
    <PreviewRouteClient
      routeParam={projectIdRaw}
      page={page}
      initialSnapshot={initialSnapshot}
      initialLookup={{
        routeParam: lookup.routeParam,
        lookupKey: lookup.lookupKey,
        projectId: lookup.projectId,
        projectSlug: lookup.projectSlug,
        projectName: lookup.projectName,
        projectFound: lookup.projectFound,
        manifestKeys: lookup.manifestKeys,
        availableKeys: lookup.availableKeys,
        storePath: lookup.storePath,
      }}
    />
  )
}
