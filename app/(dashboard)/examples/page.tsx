"use client"

import { BookOpen, ExternalLink } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/lib/i18n"

const examples = [
  { nameKey: "kanbanBoard" as const, promptKey: "exKanbanPrompt" as const, link: "#" },
  { nameKey: "socialFeed" as const, promptKey: "exSocialPrompt" as const, link: "#" },
  { nameKey: "apiDashboard" as const, promptKey: "exApiPrompt" as const, link: "#" },
  { nameKey: "feedbackWidget" as const, promptKey: "exFeedbackPrompt" as const, link: "#" },
]

export default function ExamplesPage() {
  const { t } = useLocale()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t("examples")}</h1>
        <p className="text-muted-foreground mt-1">{t("examplesDesc")}</p>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {examples.map((ex) => (
          <Card key={ex.nameKey} className="hover:border-primary/50 transition-colors">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-medium">{t(ex.nameKey)}</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    &ldquo;{t(ex.promptKey)}&rdquo;
                  </p>
                </div>
                <Button variant="ghost" size="icon">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
              <Button variant="outline" size="sm" className="mt-4 w-full">
                <BookOpen className="h-4 w-4 mr-2" />
                {t("tryExample")}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
