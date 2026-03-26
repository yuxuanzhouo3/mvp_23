import { CanonicalPreviewPage } from "@/components/preview/canonical-preview-page"
import { buildProjectLookupLogPayload, resolveProjectLookup } from "@/lib/project-lookup"
import { buildProjectPresentation } from "@/lib/project-presentation"
import { readProjectSpec } from "@/lib/project-spec"
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
  if (!project) {
    return (
      <main style={{ minHeight: "100vh", background: "#0f1117", color: "#f8fafc", padding: 24, fontFamily: "ui-sans-serif, system-ui, sans-serif" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gap: 16 }}>
          <div style={{ borderRadius: 18, border: "1px solid rgba(248,113,113,0.22)", background: "rgba(127,29,29,0.16)", padding: 16, color: "#fca5a5", fontWeight: 700 }}>
            Project not found
          </div>
          <div style={{ borderRadius: 18, border: "1px solid rgba(255,255,255,0.08)", background: "#151923", padding: 16, lineHeight: 1.8 }}>
            <div>projectId: {String(lookup.projectId)}</div>
            <div>projectSlug: {String(lookup.projectSlug)}</div>
            <div>projectName: {String(lookup.projectName)}</div>
            <div>lookupKey: {lookup.lookupKey}</div>
            <div>routeParam: {lookup.routeParam}</div>
            <div>routePath: /preview/{projectIdRaw}{path.length ? `/${path.join("/")}` : ""}</div>
            <div>projectFound: {String(lookup.projectFound)}</div>
            <div>storePath: {lookup.storePath}</div>
            <div>manifestKeys: {lookup.manifestKeys.join(", ") || "none"}</div>
            <div>availableKeys: {lookup.availableKeys.join(", ") || "none"}</div>
          </div>
        </div>
      </main>
    )
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
      projectKey={lookup.projectSlug || projectId}
      region={project.region}
      page={normalizedPage}
      spec={spec}
      presentation={presentation}
      history={[...project.history].reverse().slice(0, 5)}
    />
  )
}
