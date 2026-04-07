"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { Eye, Rocket, Share2, MoreHorizontal } from "lucide-react"
import { useLocale } from "@/lib/i18n"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

type RecentGeneration = {
  projectId: string
  updatedAt: string
  historyCount: number
  presentation: {
    displayName: string
    summary: string
  }
  generation?: {
    buildStatus: "ok" | "failed" | "skipped" | null
  }
  preview?: {
    status?: "idle" | "building" | "ready" | "failed"
    resolvedUrl?: string
  }
  delivery?: {
    planId: "free" | "starter" | "builder" | "pro" | "elite"
    assignedDomain: string
    generationProfile: "starter" | "builder" | "premium" | "showcase"
    codeExportLevel: "none" | "manifest" | "full"
    databaseAccessMode: "online_only" | "managed_config" | "production_access" | "handoff_ready"
  }
}

function getGenerationStatus(item: RecentGeneration) {
  if (item.preview?.status === "failed" || item.generation?.buildStatus === "failed") return "error" as const
  if (item.preview?.status === "building") return "building" as const
  if (item.preview?.status === "ready" || item.generation?.buildStatus === "ok") return "ready" as const
  return "building" as const
}

const statusConfig = {
  ready: {
    labelKey: "ready" as const,
    className: "bg-[hsl(var(--success))]/15 text-[hsl(var(--success))] border-[hsl(var(--success))]/30",
  },
  building: {
    labelKey: "building" as const,
    className: "bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))] border-[hsl(var(--warning))]/30",
  },
  error: {
    labelKey: "error" as const,
    className: "bg-destructive/15 text-destructive border-destructive/30",
  },
}

function buildDeliveryTag(item: RecentGeneration) {
  if (!item.delivery) return ""
  return `${item.delivery.planId} · ${item.delivery.generationProfile} · ${item.delivery.codeExportLevel} · ${item.delivery.databaseAccessMode}`
}

function getPlanBadgeVariant(planId?: "free" | "starter" | "builder" | "pro" | "elite") {
  if (planId === "elite") return "default" as const
  if (planId === "pro") return "secondary" as const
  return "outline" as const
}

export function RecentGenerations() {
  const { t, locale } = useLocale()
  const isZh = locale === "zh"
  const [items, setItems] = useState<RecentGeneration[]>([])

  useEffect(() => {
    fetch("/api/projects")
      .then((res) => res.json())
      .then((json) => setItems((json.projects ?? []).slice(0, 5)))
      .catch(() => setItems([]))
  }, [])

  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between p-5 pb-4">
        <h3 className="text-sm font-semibold text-card-foreground">
          {t("recentGenerations")}
        </h3>
        <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground text-xs" asChild>
          <Link href="/projects">{t("viewAll")}</Link>
        </Button>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground text-xs font-medium">{t("appName")}</TableHead>
              <TableHead className="text-muted-foreground text-xs font-medium hidden sm:table-cell">{t("promptUsed")}</TableHead>
              <TableHead className="text-muted-foreground text-xs font-medium">{t("status")}</TableHead>
              <TableHead className="text-muted-foreground text-xs font-medium hidden md:table-cell">{t("generated")}</TableHead>
              <TableHead className="text-muted-foreground text-xs font-medium text-right">{t("actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const derivedStatus = getGenerationStatus(item)
              const status = statusConfig[derivedStatus]
              return (
                <TableRow key={item.projectId} className="border-border hover:bg-accent/50">
                  <TableCell className="font-medium text-sm text-card-foreground">
                    {item.presentation.displayName}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground hidden sm:table-cell max-w-[260px] truncate">
                    <div className="truncate">{item.presentation.summary}</div>
                    {item.delivery ? (
                      <div className="mt-1 truncate text-[11px] text-muted-foreground/80">
                        {buildDeliveryTag(item)}
                      </div>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className={`${status.className} hover:${status.className} text-xs`}>
                        {derivedStatus === "building" && (
                          <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-[hsl(var(--warning))] inline-block animate-pulse-dot" />
                        )}
                        {t(status.labelKey)}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {item.generation?.buildStatus === "ok"
                          ? isZh
                            ? "Build 通过"
                            : "Build ok"
                          : item.generation?.buildStatus === "failed"
                            ? isZh
                              ? "Build 失败"
                              : "Build failed"
                            : item.generation?.buildStatus === "skipped"
                              ? isZh
                                ? "Build 跳过"
                                : "Build skipped"
                              : isZh
                                ? "Build 待验证"
                              : "Build pending"}
                      </Badge>
                      {item.delivery ? (
                        <Badge variant={getPlanBadgeVariant(item.delivery.planId)} className="text-[10px]">
                          {item.delivery.planId.toUpperCase()}
                        </Badge>
                      ) : null}
                      {item.delivery ? (
                        <Badge variant="outline" className="text-[10px] hidden lg:inline-flex">
                          {item.delivery.assignedDomain.replace(/^https?:\/\//, "")}
                        </Badge>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground hidden md:table-cell">
                    {new Date(item.updatedAt).toLocaleString(locale === "zh" ? "zh-CN" : "en-US")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        aria-label={`View ${item.presentation.displayName}`}
                        asChild
                      >
                        <Link href={`/apps/${item.projectId}`}>
                          <Eye className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground hidden sm:inline-flex"
                        aria-label={`Deploy ${item.presentation.displayName}`}
                        asChild
                      >
                        <Link href={`/apps/${item.projectId}/runs`}>
                          <Rocket className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground hidden sm:inline-flex"
                        aria-label={`Share ${item.presentation.displayName}`}
                        asChild
                      >
                        <a href={item.preview?.resolvedUrl || `/apps/${item.projectId}`} target="_blank" rel="noreferrer">
                          <Share2 className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground sm:hidden"
                        aria-label={`More actions for ${item.presentation.displayName}`}
                        asChild
                      >
                        <Link href={`/apps/${item.projectId}`}>
                          <MoreHorizontal className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </section>
  )
}
