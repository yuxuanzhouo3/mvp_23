"use client"

import { Database } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { useLocale } from "@/lib/i18n"

export default function AppDataPage() {
  const { t } = useLocale()
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">{t("data")}</h1>
        <p className="text-sm text-muted-foreground">{t("dataSubtitle")}</p>
      </div>
      <Card>
        <CardContent className="pt-6 min-h-[320px] flex flex-col">
          <div className="flex flex-col items-center justify-center flex-1 py-12 text-center text-muted-foreground">
            <Database className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-sm">{t("dataBrowserComingSoon")}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
