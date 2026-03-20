"use client"

import { FileQuestion } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { useLocale } from "@/lib/i18n"
import type { TranslationKey } from "@/lib/i18n"

const sectionLabelKeys: Record<string, TranslationKey> = {
  analytics: "analytics",
  domains: "domains",
  integrations: "integrations",
  security: "security",
  code: "code",
  agents: "agents",
  automations: "automations",
  logs: "logs",
  api: "api",
  settings: "settings",
}

export function AppSectionPlaceholder({ section }: { section: string }) {
  const { t } = useLocale()
  const labelKey = sectionLabelKeys[section]
  const title = labelKey ? t(labelKey) : section
  const subtitle = t("configureSectionForApp").replace("{section}", title)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold capitalize">{title}</h1>
        <p className="text-sm text-muted-foreground">{subtitle}</p>
      </div>
      <Card>
        <CardContent className="pt-6 min-h-[320px] flex flex-col">
          <div className="flex flex-col items-center justify-center flex-1 py-12 text-center text-muted-foreground">
            <FileQuestion className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-sm">{t("comingSoon")}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
