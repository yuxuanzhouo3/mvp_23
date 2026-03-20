import { AppOverviewPage } from "@/components/dashboard/app-overview-page"
import { AppSectionPlaceholder } from "@/components/dashboard/app-section-placeholder"

export default async function AppSectionPage({
  params,
}: {
  params: Promise<{ id: string; slug?: string[] }>
}) {
  const { slug } = await params
  if (!slug || slug.length === 0) {
    return <AppOverviewPage />
  }
  const section = slug[0]
  return <AppSectionPlaceholder section={section} />
}
