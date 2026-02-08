"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import { Button } from "@/components/ui/button"
import { mainNav, devTools, community } from "@/lib/nav-config"
import { useLocale } from "@/lib/i18n"

interface MobileSidebarProps {
  open: boolean
  onClose: () => void
}

export function MobileSidebar({ open, onClose }: MobileSidebarProps) {
  const pathname = usePathname()
  const { t } = useLocale()

  const linkClass = (href: string) =>
    cn(
      "flex w-full items-center gap-3 rounded-md px-2.5 py-2 text-sm transition-colors",
      pathname === href || (href !== "/" && pathname.startsWith(href))
        ? "bg-sidebar-accent text-foreground font-medium"
        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground"
    )

  return (
    <>
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

      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-sidebar-background border-r border-border transform transition-transform duration-200 ease-in-out lg:hidden",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <div className="flex items-center gap-3">
            <Image src="/logo.svg" alt="mornFullStack" width={32} height={32} priority className="rounded-lg" />
            <span className="font-semibold text-sm text-foreground tracking-tight">
              {t("brand")}
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
            {t("personalWorkspace")}
          </p>
          <ul className="flex flex-col gap-0.5" role="list">
            {mainNav.map((item) => (
              <li key={item.labelKey}>
                <Link href={item.href} onClick={onClose} className={linkClass(item.href)}>
                  <item.icon className="h-4 w-4 shrink-0" />
                  {t(item.labelKey)}
                </Link>
              </li>
            ))}
          </ul>

          <Separator className="my-4" />

          <p className="px-2.5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("developerTools")}
          </p>
          <ul className="flex flex-col gap-0.5" role="list">
            {devTools.map((item) => (
              <li key={item.labelKey}>
                <Link href={item.href} onClick={onClose} className={linkClass(item.href)}>
                  <item.icon className="h-4 w-4 shrink-0" />
                  {t(item.labelKey)}
                </Link>
              </li>
            ))}
          </ul>

          <Separator className="my-4" />

          <p className="px-2.5 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("community")}
          </p>
          <ul className="flex flex-col gap-0.5" role="list">
            {community.map((item) => (
              <li key={item.labelKey}>
                <Link href={item.href} onClick={onClose} className={linkClass(item.href)}>
                  <item.icon className="h-4 w-4 shrink-0" />
                  {t(item.labelKey)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </>
  )
}
