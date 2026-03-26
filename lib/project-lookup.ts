import { buildProjectPresentation } from "@/lib/project-presentation"
import { readProjectSpec } from "@/lib/project-spec"
import {
  getProject,
  getProjectsStorePath,
  listProjects,
  resolveProjectPath,
  safeProjectId,
  type ProjectRecord,
} from "@/lib/project-workspace"

export type ProjectLookupResult = {
  routeParam: string
  projectId: string | null
  projectSlug: string | null
  projectName: string | null
  lookupKey: string
  projectFound: boolean
  availableKeys: string[]
  manifestKeys: string[]
  storePath: string
  project: ProjectRecord | null
}

function slugify(input?: string | null) {
  return String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

async function getPresentation(record: ProjectRecord) {
  const projectDir = await resolveProjectPath(record.projectId)
  const spec = projectDir ? await readProjectSpec(projectDir) : null
  const latestHistory = record.history?.length ? record.history[record.history.length - 1] : null
  return buildProjectPresentation({
    projectId: record.projectId,
    region: record.region,
    spec,
    latestHistory,
  })
}

export async function resolveProjectLookup(routeParamRaw: string): Promise<ProjectLookupResult> {
  const routeParam = String(routeParamRaw ?? "").trim()
  const safeParam = safeProjectId(routeParam)
  const direct = safeParam ? await getProject(safeParam) : null

  if (direct) {
    const presentation = await getPresentation(direct)
    const projectSlug = direct.projectSlug || slugify(presentation.displayName) || direct.projectId
    return {
      routeParam,
      projectId: direct.projectId,
      projectSlug,
      projectName: presentation.displayName,
      lookupKey: direct.projectId,
      projectFound: true,
      availableKeys: [direct.projectId, projectSlug],
      manifestKeys: [direct.projectId, projectSlug],
      storePath: getProjectsStorePath(),
      project: direct,
    }
  }

  const allProjects = await listProjects()
  const candidates: Array<{
    record: ProjectRecord
    slug: string
    displayName: string
  }> = []

  for (const record of allProjects) {
    const presentation = await getPresentation(record)
    const slug = record.projectSlug || slugify(presentation.displayName) || record.projectId
    candidates.push({
      record,
      slug,
      displayName: presentation.displayName,
    })
  }

  const matched =
    candidates.find((item) => item.slug === routeParam || item.slug === safeParam) ||
    candidates.find((item) => safeProjectId(item.slug) === safeParam)

  if (!matched) {
    return {
      routeParam,
      projectId: null,
      projectSlug: slugify(routeParam) || null,
      projectName: null,
      lookupKey: routeParam || safeParam,
      projectFound: false,
      availableKeys: candidates.flatMap((item) => [item.record.projectId, item.slug]),
      manifestKeys: candidates.map((item) => item.slug),
      storePath: getProjectsStorePath(),
      project: null,
    }
  }

  return {
    routeParam,
    projectId: matched.record.projectId,
    projectSlug: matched.slug,
    projectName: matched.displayName,
    lookupKey: matched.slug,
    projectFound: true,
    availableKeys: [matched.record.projectId, matched.slug],
    manifestKeys: candidates.map((item) => item.slug),
    storePath: getProjectsStorePath(),
    project: matched.record,
  }
}

export function buildProjectLookupLogPayload(result: ProjectLookupResult) {
  return {
    routeParam: result.routeParam,
    lookupKey: result.lookupKey,
    projectId: result.projectId,
    projectSlug: result.projectSlug,
    projectName: result.projectName,
    projectFound: result.projectFound,
    manifestKeys: result.manifestKeys,
    availableKeys: result.availableKeys,
    storePath: result.storePath,
  }
}
