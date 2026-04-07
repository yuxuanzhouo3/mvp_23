import { AppWorkspacePage } from "@/components/dashboard/app-workspace-page"
import { resolveProjectLookup } from "@/lib/project-lookup"

export default async function AppSectionPage({
  params,
}: {
  params: Promise<{ id: string; slug?: string[] }>
}) {
  const { id, slug } = await params
  const lookup = await resolveProjectLookup(id)
  const resolvedProjectId = lookup.projectId || id

  if (!slug || slug.length === 0) {
    return <AppWorkspacePage projectId={resolvedProjectId} />
  }

  const section = slug[0]
  return <AppWorkspacePage projectId={resolvedProjectId} initialSection={section} />
}
