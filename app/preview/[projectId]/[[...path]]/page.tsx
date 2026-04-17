import { PreviewRouteClient } from "@/components/preview/preview-route-client"
import { buildAssignedAppUrl } from "@/lib/app-subdomain"
import { buildProjectLookupLogPayload, resolveProjectLookup } from "@/lib/project-lookup"
import { getPlanPolicy } from "@/lib/plan-catalog"
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
  let normalizedPage = page || "dashboard"

  if (project) {
    const projectDir = await resolveProjectPath(projectId)
    const spec = projectDir ? await readProjectSpec(projectDir) : null
    const planPolicy = getPlanPolicy(spec?.planTier)
    const latestHistory = project.history?.length ? project.history[project.history.length - 1] : null
    const presentation = buildProjectPresentation({
      projectId,
      region: project.region,
      spec,
      latestHistory,
    })
    const allowedPages = new Set(
      (presentation.routes.length ? presentation.routes : ["/dashboard", "/editor", "/runs", "/templates", "/pricing"])
        .map((route) => {
          const normalizedRoute = route.replace(/^\//, "")
          return normalizedRoute || "dashboard"
        })
    )
    const normalizedPage =
      page && allowedPages.has(page)
        ? page
        : allowedPages.has("dashboard")
          ? "dashboard"
          : Array.from(allowedPages)[0] || "dashboard"

    initialSnapshot = {
      projectId,
      projectSlug: lookup.projectSlug || projectId,
      region: project.region,
      spec,
      delivery: {
        assignedDomain: buildAssignedAppUrl({
          projectSlug: lookup.projectSlug || project.projectSlug || projectId,
          projectId,
          region: project.region,
          planTier: spec?.planTier,
        }),
        subdomainSlots: planPolicy.subdomainSlots,
        generationProfile: planPolicy.generationProfile,
        codeExportLevel: planPolicy.codeExportLevel,
        databaseAccessMode: planPolicy.databaseAccessMode,
        projectLimit: planPolicy.projectLimit,
        collaboratorLimit: planPolicy.collaboratorLimit,
        routeBudget: planPolicy.maxGeneratedRoutes,
        moduleBudget: planPolicy.maxGeneratedModules,
      },
      presentation,
      history: [...project.history].reverse().slice(0, 5),
      updatedAt: project.updatedAt,
      source: "server",
    }
  }

  return (
    <PreviewRouteClient
      routeParam={projectIdRaw}
      page={normalizedPage}
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
