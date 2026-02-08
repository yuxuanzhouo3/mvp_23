"use client"

import Link from "next/link"
import { FolderKanban, Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useLocale } from "@/lib/i18n"

const projects = [
  { id: "1", name: "mornFullStack MVP v23", status: "Live", apps: 5, updated: "2h ago" },
  { id: "2", name: "Book Club Social", status: "Draft", apps: 2, updated: "1d ago" },
  { id: "3", name: "Invoice Tracker", status: "Building", apps: 1, updated: "30m ago" },
]

const timeKeys: Record<string, string> = {
  "2h ago": "time2h",
  "1d ago": "time1d",
  "30m ago": "time30m",
}

export default function ProjectsPage() {
  const { t, locale } = useLocale()

  const statusLabel = (s: string) => {
    if (s === "Live") return t("live")
    if (s === "Draft") return t("draft")
    if (s === "Building") return t("building")
    return s
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t("projects")}</h1>
        <p className="text-muted-foreground mt-1">{t("projectsDesc")}</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder={t("searchProjects")} className="pl-9" />
        </div>
        <Button className="bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90">
          <Plus className="h-4 w-4 mr-2" />
          {t("newProject")}
        </Button>
      </div>

      <div className="grid gap-4">
        {projects.map((project) => (
          <Card key={project.id} className="hover:border-primary/50 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-3">
                <FolderKanban className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">{project.name}</span>
              </div>
              <Badge
                variant={
                  project.status === "Live"
                    ? "default"
                    : project.status === "Building"
                    ? "secondary"
                    : "outline"
                }
              >
                {statusLabel(project.status)}
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                <span>{project.apps} {t("appsCount")}</span>
                <span>{t("updatedAt")} {locale === "zh" ? t(timeKeys[project.updated] || "time2h") : project.updated}</span>
              </div>
              <div className="flex gap-2 mt-4">
                <Button variant="outline" size="sm" asChild>
                  <Link href="/">{t("open")}</Link>
                </Button>
                <Button variant="ghost" size="sm">
                  {t("settings")}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
