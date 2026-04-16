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
  const candidates = await Promise.all(
    allProjects.map(async (record) => {
      const presentation = await getPresentation(record)
      const derivedSlug = slugify(presentation.displayName) || record.projectId
      return {
        record,
        slug: record.projectSlug || derivedSlug || record.projectId,
        derivedSlug,
      }
    })
  )

  const matched =
    candidates.find((item) => item.record.projectId === routeParam || item.record.projectId === safeParam) ||
    candidates.find((item) => safeProjectId(item.record.projectId) === safeParam) ||
    candidates.find(
      (item) =>
        item.slug === routeParam ||
        item.slug === safeParam ||
        item.derivedSlug === routeParam ||
        item.derivedSlug === safeParam
    ) ||
    candidates.find(
      (item) =>
        safeProjectId(item.slug) === safeParam ||
        safeProjectId(item.derivedSlug) === safeParam
    )

  if (!matched) {
    return {
      routeParam,
      projectId: null,
      projectSlug: slugify(routeParam) || null,
      projectName: null,
      lookupKey: routeParam || safeParam,
      projectFound: false,
      availableKeys: candidates.flatMap((item) => [item.record.projectId, item.slug]),
      manifestKeys: candidates.flatMap((item) => [item.record.projectId, item.slug]),
      storePath: getProjectsStorePath(),
      project: null,
    }
  }

  const presentation = await getPresentation(matched.record)
  const projectSlug = matched.record.projectSlug || slugify(presentation.displayName) || matched.record.projectId

  return {
    routeParam,
    projectId: matched.record.projectId,
    projectSlug,
    projectName: presentation.displayName,
    lookupKey: projectSlug,
    projectFound: true,
    availableKeys: [matched.record.projectId, projectSlug],
    manifestKeys: candidates.flatMap((item) => [item.record.projectId, item.slug]),
    storePath: getProjectsStorePath(),
    project: matched.record,
  }
}

export function buildProjectLookupLogPayload(result: ProjectLookupResult) {
  const previewKeys = (values: string[]) =>
    values.length > 16 ? [...values.slice(0, 16), `...${values.length - 16} more`] : values

  return {
    routeParam: result.routeParam,
    lookupKey: result.lookupKey,
    projectId: result.projectId,
    projectSlug: result.projectSlug,
    projectName: result.projectName,
    projectFound: result.projectFound,
    manifestKeys: previewKeys(result.manifestKeys),
    availableKeys: previewKeys(result.availableKeys),
    storePath: result.storePath,
  }
}
