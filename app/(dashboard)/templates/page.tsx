"use client"

import { LayoutTemplate, Plus, BookOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { useLocale } from "@/lib/i18n"

const templates = [
  { id: "1", nameKey: "kanbanBoard" as const, descKey: "kanbanDesc" as const, apps: 12 },
  { id: "2", nameKey: "socialFeed" as const, descKey: "socialFeedDesc" as const, apps: 8 },
  { id: "3", nameKey: "crudDashboard" as const, descKey: "crudDesc" as const, apps: 24 },
]

export default function TemplatesPage() {
  const { t } = useLocale()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t("templates")}</h1>
        <p className="text-muted-foreground mt-1">{t("templatesDesc")}</p>
      </div>

      <div className="flex justify-end">
        <Button className="bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90">
          <Plus className="h-4 w-4 mr-2" />
          {t("createFromApp")}
        </Button>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.map((template) => (
          <Card key={template.id} className="hover:border-primary/50 transition-colors">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <LayoutTemplate className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-medium">{t(template.nameKey)}</h3>
                  <p className="text-sm text-muted-foreground">{t(template.descKey)}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-4">
                {t("usedInApps").replace("{n}", String(template.apps))}
              </p>
              <Button variant="outline" size="sm" className="w-full">
                <BookOpen className="h-4 w-4 mr-2" />
                {t("useTemplate")}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
