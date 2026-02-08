"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronDown, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import { mainNav, devTools, community } from "@/lib/nav-config"

export function SidebarNav() {
  const [workspaceOpen, setWorkspaceOpen] = useState(true)
  const pathname = usePathname()

  const NavLink = ({ item }: { item: (typeof mainNav)[0] }) => {
    const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))
    return (
      <Link
        href={item.href}
        className={cn(
          "flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors",
          isActive
            ? "bg-sidebar-accent text-foreground font-medium"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
        )}
      >
        <item.icon className="h-4 w-4 shrink-0" />
        {item.label}
      </Link>
    )
  }

  return (
    <aside className="hidden lg:flex flex-col w-64 border-r border-border bg-sidebar-background h-screen sticky top-0 overflow-y-auto">
      <div className="flex items-center gap-3 px-5 py-5">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-bold text-sm">
          MF
        </div>
        <span className="font-semibold text-sm text-foreground tracking-tight">
          mornFullStack
        </span>
      </div>

      <Separator />

      <div className="px-3 py-3">
        <button
          type="button"
          onClick={() => setWorkspaceOpen(!workspaceOpen)}
          className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <span>Personal Workspace</span>
          {workspaceOpen ? (
            <ChevronDown className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {workspaceOpen && (
        <nav className="flex-1 px-3">
          <ul className="flex flex-col gap-0.5" role="list">
            {mainNav.map((item) => (
              <li key={item.label}>
                <NavLink item={item} />
              </li>
            ))}
          </ul>

          <Separator className="my-4" />

          <p className="px-2.5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Developer Tools
          </p>
          <ul className="flex flex-col gap-0.5" role="list">
            {devTools.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors",
                    pathname === item.href
                      ? "bg-sidebar-accent text-foreground font-medium"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>

          <Separator className="my-4" />

          <p className="px-2.5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Community
          </p>
          <ul className="flex flex-col gap-0.5" role="list">
            {community.map((item) => (
              <li key={item.label}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors",
                    pathname === item.href
                      ? "bg-sidebar-accent text-foreground font-medium"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <Separator />

      <div className="px-5 py-4">
        <p className="text-[10px] text-muted-foreground">
          {"© 2025 mornFullStack MVP"}
        </p>
        <p className="text-[10px] text-muted-foreground">mornhub.app</p>
      </div>
    </aside>
  )
}
