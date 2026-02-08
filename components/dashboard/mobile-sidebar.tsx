"use client"

import {
  LayoutDashboard,
  FolderKanban,
  LayoutTemplate,
  Activity,
  Settings,
  Terminal,
  FileText,
  Package,
  Puzzle,
  MessageSquare,
  BookOpen,
  PenLine,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"

const mainNav = [
  { label: "Dashboard", icon: LayoutDashboard, active: true },
  { label: "Projects", icon: FolderKanban },
  { label: "Templates", icon: LayoutTemplate },
  { label: "Activity Log", icon: Activity },
  { label: "Settings", icon: Settings },
]

const devTools = [
  { label: "CLI Reference", icon: Terminal },
  { label: "API Docs", icon: FileText },
  { label: "SDK", icon: Package },
  { label: "Integrations", icon: Puzzle },
]

const community = [
  { label: "Discord", icon: MessageSquare },
  { label: "Examples", icon: BookOpen },
  { label: "Blog", icon: PenLine },
]

interface MobileSidebarProps {
  open: boolean
  onClose: () => void
}

export function MobileSidebar({ open, onClose }: MobileSidebarProps) {
  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm lg:hidden"
          onClick={onClose}
          onKeyDown={(e) => e.key === "Escape" && onClose()}
          role="button"
          tabIndex={0}
          aria-label="Close navigation"
        />
      )}

      {/* Drawer */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-sidebar-background border-r border-border transform transition-transform duration-200 ease-in-out lg:hidden",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-bold text-sm">
              MF
            </div>
            <span className="font-semibold text-sm text-foreground tracking-tight">
              mornFullStack
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            aria-label="Close menu"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <Separator />

        <nav className="flex-1 px-3 py-3 overflow-y-auto">
          <p className="px-2.5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Personal Workspace
          </p>
          <ul className="flex flex-col gap-0.5" role="list">
            {mainNav.map((item) => (
              <li key={item.label}>
                <button
                  type="button"
                  onClick={onClose}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors",
                    item.active
                      ? "bg-sidebar-accent text-foreground font-medium"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </button>
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
                <button
                  type="button"
                  onClick={onClose}
                  className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </button>
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
                <button
                  type="button"
                  onClick={onClose}
                  className="flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground transition-colors"
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </>
  )
}
