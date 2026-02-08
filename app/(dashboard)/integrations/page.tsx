"use client"

import { Puzzle, Github, Cloud, Bell, MessageCircle } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useLocale } from "@/lib/i18n"

const baseIntegrations = [
  { name: "GitHub", icon: Github, descKey: "connectRepos" as const, connected: true },
  { name: "Vercel", icon: Cloud, descKey: "deployApps" as const, connected: true },
  { name: "Slack", icon: Bell, descKey: "buildNotifications" as const, connected: false },
]

const cnIntegrations = [
  { nameKey: "wechatLogin" as const, icon: MessageCircle, descKey: "wechatLoginDesc" as const, connected: true },
  { nameKey: "weiboShare" as const, icon: MessageCircle, descKey: "weiboShareDesc" as const, connected: false },
]

export default function IntegrationsPage() {
  const { t, locale } = useLocale()
  const isZh = locale === "zh"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t("integrationsTitle")}</h1>
        <p className="text-muted-foreground mt-1">
          {t("integrationsDesc")}
        </p>
      </div>

      {isZh && (
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">中国本土集成</h2>
          <div className="grid gap-4">
            {cnIntegrations.map((int) => (
              <Card key={int.nameKey} className="hover:border-primary/50 transition-colors">
                <CardHeader className="flex flex-row items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                      <int.icon className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-medium">{t(int.nameKey)}</h3>
                      <p className="text-sm text-muted-foreground">{t(int.descKey)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {int.connected ? (
                      <Badge variant="secondary">{t("connected")}</Badge>
                    ) : (
                      <Badge variant="outline">{t("notConnected")}</Badge>
                    )}
                    <Button variant={int.connected ? "outline" : "default"} size="sm">
                      {int.connected ? t("configure") : t("connect")}
                    </Button>
                  </div>
                </CardHeader>
              </Card>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className="text-sm font-medium text-muted-foreground mb-3">{isZh ? "国际集成" : "Integrations"}</h2>
        <div className="grid gap-4">
          {baseIntegrations.map((int) => (
            <Card key={int.name} className="hover:border-primary/50 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center">
                    <int.icon className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-medium">{int.name}</h3>
                    <p className="text-sm text-muted-foreground">{t(int.descKey)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {int.connected ? (
                    <Badge variant="secondary">{t("connected")}</Badge>
                  ) : (
                    <Badge variant="outline">{t("notConnected")}</Badge>
                  )}
                  <Button variant={int.connected ? "outline" : "default"} size="sm">
                    {int.connected ? t("configure") : t("connect")}
                  </Button>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
