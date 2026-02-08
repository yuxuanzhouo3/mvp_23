"use client"

import { useParams } from "next/navigation"
import { Globe, Pencil, ExternalLink, Share2, Copy, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useLocale } from "@/lib/i18n"
import type { TranslationKey } from "@/lib/i18n"

const appNameKeys: Record<string, TranslationKey> = {
  "kanban-ai": "appNameKanbanAi",
  "social-bookclub": "appNameSocialBookclub",
  "invoice-tracker": "appNameInvoiceTracker",
  "fitness-log": "appNameFitnessLog",
  "recipe-finder": "appNameRecipeFinder",
}

export function AppOverviewPage() {
  const params = useParams()
  const appId = params.id as string
  const { t } = useLocale()
  const appName = appNameKeys[appId] ? t(appNameKeys[appId]) : appId

  return (
    <div className="space-y-3">
      <Tabs defaultValue="dashboard" className="w-full">
        <TabsList className="mb-2">
          <TabsTrigger value="dashboard">{t("dashboardTab")}</TabsTrigger>
          <TabsTrigger value="preview">{t("previewTab")}</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard" className="mt-0">
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-xl font-semibold">{appName}</h1>
                  <Badge className="bg-[hsl(var(--success))]/15 text-[hsl(var(--success))]">
                    {t("live")}
                  </Badge>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t("appCreatedFromPrompt")}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">{t("createdHoursAgo")}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline">
                  <ExternalLink className="h-4 w-4 mr-1.5" />
                  {t("openApp")}
                </Button>
                <Button size="sm">
                  <Share2 className="h-4 w-4 mr-1.5" />
                  {t("shareApp")}
                </Button>
              </div>
            </div>

            <div className="space-y-3 pt-3 border-t border-border">
              <div>
                <h3 className="text-sm font-medium mb-0.5">{t("appVisibility")}</h3>
                <p className="text-xs text-muted-foreground mb-2">
                  {t("appVisibilityDesc")}
                </p>
                <div className="space-y-2">
                  <Select defaultValue="public">
                    <SelectTrigger className="max-w-[200px]">
                      <Globe className="h-4 w-4 mr-2 text-muted-foreground" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="public">{t("public")}</SelectItem>
                      <SelectItem value="private">{t("private")}</SelectItem>
                      <SelectItem value="unlisted">{t("unlisted")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="flex items-center space-x-2">
                    <Switch id="require-login" defaultChecked />
                    <Label htmlFor="require-login" className="text-sm">{t("requireLogin")}</Label>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium mb-0.5">{t("inviteUsers")}</h3>
                <p className="text-xs text-muted-foreground mb-2">
                  {t("inviteUsersDesc")}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm">
                    <Copy className="h-4 w-4 mr-1.5" />
                    {t("copyLink")}
                  </Button>
                  <Button size="sm">{t("sendInvites")}</Button>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium mb-0.5">{t("platformBadge")}</h3>
                <p className="text-xs text-muted-foreground mb-2">
                  {t("platformBadgeDesc")}
                </p>
                <Button variant="outline" size="sm">
                  <EyeOff className="h-4 w-4 mr-1.5" />
                  {t("hideBadge")}
                </Button>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="preview" className="mt-0">
          <div className="rounded-lg border border-border bg-card p-6 min-h-[70vh] flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <p className="text-sm">{t("appPreviewPlaceholder")}</p>
              <Button variant="outline" size="sm" className="mt-3">
                {t("openInNewTab")}
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
