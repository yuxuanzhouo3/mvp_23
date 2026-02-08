"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { ChevronDown, ChevronRight, PanelLeftClose, PanelLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { mainNav, devTools, community } from "@/lib/nav-config"
import { useLocale } from "@/lib/i18n"

export function SidebarNav() {
  const pathname = usePathname()
  const isAppDetail = pathname?.startsWith("/apps/") ?? false
  const [workspaceOpen, setWorkspaceOpen] = useState(true)
  const [collapsed, setCollapsed] = useState(isAppDetail)

  useEffect(() => {
    setCollapsed(pathname?.startsWith("/apps/") ?? false)
  }, [pathname])

  const { t } = useLocale()

  const NavLink = ({ item }: { item: (typeof mainNav)[0] }) => {
    const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
    return (
      <Link
        href={item.href}
        title={collapsed ? t(item.labelKey) : undefined}
        className={cn(
          "flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors",
          collapsed && "justify-center px-2",
          isActive
            ? "bg-sidebar-accent text-foreground font-medium"
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
      "flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors",
      collapsed && "justify-center px-2",
      isActive
        ? "bg-sidebar-accent text-foreground font-medium"
        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
    )

  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col border-r border-border bg-sidebar-background h-screen sticky top-0 overflow-y-auto transition-[width] duration-200 ease-in-out",
        collapsed ? "w-[4.5rem]" : "w-64"
      )}
    >
      <div className={cn("flex items-center gap-3 py-5 shrink-0", collapsed ? "justify-center px-0" : "px-5")}>
        <Image src="/logo.svg" alt="mornFullStack" width={32} height={32} priority className="rounded-lg shrink-0" />
        {!collapsed && (
          <span className="font-semibold text-sm text-foreground tracking-tight truncate">
            {t("brand")}
          </span>
        )}
      </div>

      <div className={cn("shrink-0 px-3 pb-2", collapsed && "flex justify-center px-0")}>
        <Button
          variant="ghost"
          size="icon"
          className={cn("text-muted-foreground hover:text-foreground", collapsed ? "h-8 w-8" : "w-full justify-start gap-2")}
          onClick={() => setCollapsed(!collapsed)}
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

      <Separator />

      {!collapsed && (
        <div className="px-3 py-3">
          <button
            type="button"
            onClick={() => setWorkspaceOpen(!workspaceOpen)}
            className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
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

          <Separator className="my-4" />

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

          <Separator className="my-4" />

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
        </nav>
      )}

      <Separator />

      <div className={cn("shrink-0 py-4", collapsed ? "flex flex-col items-center gap-1 px-0" : "px-5")}>
        {!collapsed && (
          <>
            <p className="text-[10px] text-muted-foreground">{t("copyright")}</p>
            <p className="text-[10px] text-muted-foreground">mornhub.app</p>
          </>
        )}
      </div>
    </aside>
  )
}
