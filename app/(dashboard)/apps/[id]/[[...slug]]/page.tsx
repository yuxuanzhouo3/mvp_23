import { AppWorkspacePage } from "@/components/dashboard/app-workspace-page"

export default async function AppSectionPage({
  params,
}: {
  params: Promise<{ id: string; slug?: string[] }>
}) {
  const { id, slug } = await params

  if (!slug || slug.length === 0) {
    return <AppWorkspacePage projectId={id} />
  }

  const section = slug[0]
  return <AppWorkspacePage projectId={id} initialSection={section} />
}
