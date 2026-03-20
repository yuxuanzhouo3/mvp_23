"use client"

import { Activity, Zap, CheckCircle, AlertCircle, Loader2 } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { useLocale } from "@/lib/i18n"

const activities = [
  { id: "1", msgKey: "activityGenerated" as const, name: "kanban-ai", timeKey: "time2h", icon: Zap },
  { id: "2", msgKey: "activityDeployed" as const, name: "social-bookclub", timeKey: "time3h", icon: CheckCircle },
  { id: "3", msgKey: "activityBuilding" as const, name: "invoice-tracker", timeKey: "time30m", icon: Loader2 },
  { id: "4", msgKey: "activityBuildFailed" as const, name: "recipe-finder", timeKey: "time1d", icon: AlertCircle },
  { id: "5", msgKey: "activityGenerated" as const, name: "fitness-log", timeKey: "time1d", icon: Zap },
]

export default function ActivityLogPage() {
  const { t } = useLocale()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t("activityLog")}</h1>
        <p className="text-muted-foreground mt-1">{t("activityLogDesc")}</p>
      </div>

      <Card>
        <CardContent className="p-0">
          <ul className="divide-y divide-border">
            {activities.map((item) => (
              <li
                key={item.id}
                className="flex items-center gap-4 px-5 py-4 hover:bg-muted/50 transition-colors"
              >
                <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                  <item.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {t(item.msgKey).replace("{name}", item.name)}
                  </p>
                  <p className="text-xs text-muted-foreground">{t(item.timeKey)}</p>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
