import { AppWorkspacePage } from "@/components/dashboard/app-workspace-page"

export default async function AppUsersPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <AppWorkspacePage projectId={id} initialSection="users" />
}
