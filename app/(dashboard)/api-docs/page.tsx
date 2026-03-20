"use client"

import { FileText, Code } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { useLocale } from "@/lib/i18n"

const endpoints = [
  { method: "POST", path: "/api/generate", descKey: "apiGenerate" as const },
  { method: "GET", path: "/api/apps", descKey: "apiListApps" as const },
  { method: "GET", path: "/api/apps/:id", descKey: "apiGetApp" as const },
  { method: "POST", path: "/api/apps/:id/deploy", descKey: "apiDeploy" as const },
]

export default function ApiDocsPage() {
  const { t } = useLocale()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t("apiDocs")}</h1>
        <p className="text-muted-foreground mt-1">{t("apiDocsDesc")}</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            <h2 className="font-medium">{t("baseUrl")}</h2>
          </div>
        </CardHeader>
        <CardContent>
          <code className="text-sm font-mono text-muted-foreground">
            https://api.mornhub.app/v1
          </code>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Code className="h-5 w-5" />
            <h2 className="font-medium">{t("endpoints")}</h2>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {endpoints.map((ep, i) => (
              <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-2 pb-4 border-b border-border last:border-0 last:pb-0">
                <span
                  className={`shrink-0 px-2 py-1 rounded text-xs font-mono ${
                    ep.method === "POST" ? "bg-green-500/20 text-green-600" : "bg-blue-500/20 text-blue-600"
                  }`}
                >
                  {ep.method}
                </span>
                <code className="text-sm font-mono">{ep.path}</code>
                <span className="text-sm text-muted-foreground">{t(ep.descKey)}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
