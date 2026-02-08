import { FileQuestion } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { AppOverviewPage } from "@/components/dashboard/app-overview-page"

const sectionNames: Record<string, string> = {
  analytics: "Analytics",
  domains: "Domains",
  integrations: "Integrations",
  security: "Security",
  code: "Code",
  agents: "Agents",
  automations: "Automations",
  logs: "Logs",
  api: "API",
  settings: "Settings",
}

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
  const title = sectionNames[section] || section

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold capitalize">{title}</h1>
        <p className="text-sm text-muted-foreground">Configure {title.toLowerCase()} for your app</p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <FileQuestion className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-sm">Coming soon</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
