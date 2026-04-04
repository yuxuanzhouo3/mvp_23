"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { ChevronDown, ChevronRight, PanelLeftClose, PanelLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { mainNav, devTools, community } from "@/lib/nav-config"
import { useLocale } from "@/lib/i18n"

type SidebarNavProps = {
  collapsed: boolean
  onToggleCollapsed: () => void
}

type RecentProject = {
  projectId: string
  updatedAt: string
  generation?: {
    buildStatus: "ok" | "failed" | "skipped" | null
  }
  preview?: {
    status?: "idle" | "building" | "ready" | "failed"
  }
  presentation: {
    displayName: string
    subtitle: string
    summary: string
    icon: {
      glyph: string
      from: string
      to: string
      ring: string
    }
  }
}

export function SidebarNav({ collapsed, onToggleCollapsed }: SidebarNavProps) {
  const pathname = usePathname()
  const { t } = useLocale()
  const workspaceOpen = true
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([])

  useEffect(() => {
    fetch("/api/projects")
      .then((res) => res.json())
      .then((json) => setRecentProjects((json.projects ?? []).slice(0, 5)))
      .catch(() => setRecentProjects([]))
  }, [])

  const NavLink = ({ item }: { item: (typeof mainNav)[0] }) => {
    const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
    return (
      <Link
        href={item.href}
        title={collapsed ? t(item.labelKey) : undefined}
        className={cn(
          "flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm transition-all duration-200",
          collapsed && "justify-center px-2",
          isActive
            ? "bg-primary/10 text-foreground font-medium shadow-none"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
        )}
      >
        <item.icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
      </Link>
    )
  }

  const linkClass = (isActive: boolean) =>
    cn(
      "flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm transition-all duration-200",
      collapsed && "justify-center px-2",
      isActive
        ? "bg-primary/10 text-foreground font-medium shadow-none"
        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
    )

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen flex-col overflow-y-auto border-r border-sidebar-border bg-sidebar-background/92 transition-[width] duration-200 ease-in-out lg:flex",
        collapsed ? "w-12" : "w-56"
      )}
    >
      <div className={cn("flex shrink-0 items-center gap-3 py-4", collapsed ? "justify-center px-0" : "px-4")}>
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[linear-gradient(135deg,#4f7cff,#7c3aed)] text-sm font-semibold text-white shadow-[0_12px_30px_rgba(79,124,255,0.25)]">
          M
        </div>
        {!collapsed && (
          <span className="font-semibold text-sm text-foreground tracking-tight truncate">
            mornstack
          </span>
        )}
      </div>

      <div className={cn("shrink-0 px-3 pb-2", collapsed && "flex justify-center px-0")}>
        <Button
          variant="ghost"
          size="icon"
          className={cn("text-muted-foreground hover:text-foreground", collapsed ? "h-7 w-7 rounded-lg" : "w-full justify-start gap-2 rounded-xl border border-border/70")}
          onClick={onToggleCollapsed}
          aria-label={collapsed ? t("expandSidebar") : t("collapseSidebar")}
          title={collapsed ? t("expandSidebar") : t("collapseSidebar")}
        >
          {collapsed ? (
            <PanelLeft className="h-4 w-4" />
          ) : (
            <>
              <PanelLeftClose className="h-4 w-4 shrink-0" />
              <span className="text-xs">{t("collapseSidebar")}</span>
            </>
          )}
        </Button>
      </div>

      <Separator className="bg-sidebar-border" />

      {!collapsed && (
        <div className="px-3 py-3">
          <button
            type="button"
            className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground"
          >
            <span>{t("personalWorkspace")}</span>
            {workspaceOpen ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      )}

      {(workspaceOpen || collapsed) && (
        <nav className="flex-1 px-3 min-w-0">
          <ul className="flex flex-col gap-0.5" role="list">
            {mainNav.map((item) => (
              <li key={item.labelKey}>
                <NavLink item={item} />
              </li>
            ))}
          </ul>

          <Separator className="my-4 bg-sidebar-border" />

          {!collapsed && (
            <p className="px-2.5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("developerTools")}
            </p>
          )}
          <ul className="flex flex-col gap-0.5" role="list">
            {devTools.map((item) => (
              <li key={item.labelKey}>
                <Link
                  href={item.href}
                  title={collapsed ? t(item.labelKey) : undefined}
                  className={linkClass(pathname === item.href)}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
                </Link>
              </li>
            ))}
          </ul>

          <Separator className="my-4 bg-sidebar-border" />

          {!collapsed && (
            <p className="px-2.5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("community")}
            </p>
          )}
          <ul className="flex flex-col gap-0.5" role="list">
            {community.map((item) => (
              <li key={item.labelKey}>
                <Link
                  href={item.href}
                  title={collapsed ? t(item.labelKey) : undefined}
                  className={linkClass(pathname === item.href)}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="truncate">{t(item.labelKey)}</span>}
                </Link>
              </li>
            ))}
          </ul>

          {recentProjects.length ? (
            <>
              <Separator className="my-4 bg-sidebar-border" />
              {!collapsed && (
                <p className="px-2.5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Recents
                </p>
              )}
              <ul className="flex flex-col gap-1" role="list">
                {recentProjects.map((project) => {
                  const active = pathname?.startsWith(`/apps/${project.projectId}`) ?? false
                  const icon = project.presentation.icon
                  return (
                    <li key={project.projectId}>
                      <Link
                        href={`/apps/${project.projectId}`}
                        title={collapsed ? project.presentation.displayName : undefined}
                        className={linkClass(active)}
                      >
                        <span
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-[11px] font-semibold text-white"
                          style={{ background: `linear-gradient(135deg, ${icon.from}, ${icon.to})`, boxShadow: `0 0 0 1px ${icon.ring}` }}
                        >
                          {icon.glyph}
                        </span>
                        {!collapsed && (
                          <span className="flex min-w-0 items-center gap-2">
                            <span className="min-w-0 truncate">{project.presentation.displayName}</span>
                            <span
                              className={cn(
                                "inline-block h-1.5 w-1.5 shrink-0 rounded-full",
                                project.preview?.status === "ready"
                                  ? "bg-emerald-500"
                                  : project.preview?.status === "failed"
                                    ? "bg-red-500"
                                    : "bg-amber-400"
                              )}
                            />
                          </span>
                        )}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </>
          ) : null}
        </nav>
      )}

      <Separator className="bg-sidebar-border" />

      <div className={cn("shrink-0 py-4", collapsed ? "flex flex-col items-center gap-1 px-0" : "px-5")}>
        {!collapsed && (
          <>
            <p className="text-[10px] text-muted-foreground">{t("copyright")}</p>
            <p className="text-[10px] text-muted-foreground">www.mornscience.app</p>
          </>
        )}
      </div>
    </aside>
  )
}
