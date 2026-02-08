"use client"

import Link from "next/link"
import { Globe, Settings, ExternalLink, Share2, Copy, EyeOff, FileCode } from "lucide-react"
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
import { Separator } from "@/components/ui/separator"
import { useLocale } from "@/lib/i18n"

const recentEdits = [
  "shared/Header",
  "Layout",
  "Today Page",
  "Settings Page",
  "History Page",
  "Generator Page",
  "Page Not Found",
]

export function ProjectOverview({ children }: { children?: React.ReactNode }) {
  const { t } = useLocale()

  return (
    <section className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-card-foreground">
              {t("brand")}
            </h2>
            <Badge className="bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] border-[hsl(var(--success))]/30 hover:bg-[hsl(var(--success))]/15">
              <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-[hsl(var(--success))] inline-block" />
              {t("live")}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {t("projectDesc")}
          </p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" />
              mornhub.app
            </span>
            <span>{t("lastUpdated")} {t("lastUpdated2h")}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/settings" className="text-foreground border-border bg-transparent flex items-center gap-1.5">
              <Settings className="h-4 w-4" />
              {t("settings")}
            </Link>
          </Button>
        </div>
      </div>

      {children ? (
        <>
          <Separator />
          {children}
        </>
      ) : null}
    </section>
  )
}

export function ProjectOverviewDetails() {
  const { t } = useLocale()

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <h3 className="text-sm font-medium text-foreground mb-2 flex items-center gap-2">
            <FileCode className="h-4 w-4" />
            {t("recentEdits")}
          </h3>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {recentEdits.map((file) => (
              <li key={file} className="font-mono text-xs hover:text-foreground transition-colors cursor-pointer">
                {file}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            {t("recentEditsDesc")}
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="outline" size="sm" className="text-foreground border-border justify-start">
              <ExternalLink className="h-4 w-4 mr-1.5" />
              {t("openApp")}
            </Button>
            <Button variant="outline" size="sm" className="text-foreground border-border justify-start">
              <Share2 className="h-4 w-4 mr-1.5" />
              {t("shareApp")}
              <span className="text-[10px] ml-1 opacity-80">({t("shareIncentive")})</span>
            </Button>
          </div>

          <div>
            <h3 className="text-sm font-medium text-foreground mb-0.5">{t("appVisibility")}</h3>
            <p className="text-xs text-muted-foreground mb-2">
              {t("appVisibilityDesc")}
            </p>
            <div className="space-y-2">
              <Select defaultValue="public">
                <SelectTrigger className="w-full max-w-[200px]">
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
            <h3 className="text-sm font-medium text-foreground mb-0.5">{t("inviteUsers")}</h3>
            <p className="text-xs text-muted-foreground mb-2">
              {t("inviteUsersDesc")}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm">
                <Copy className="h-4 w-4 mr-1.5" />
                {t("copyLink")}
              </Button>
              <Button size="sm" className="bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90">
                {t("sendInvites")}
              </Button>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-foreground mb-0.5">{t("platformBadge")}</h3>
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
    </section>
  )
}
