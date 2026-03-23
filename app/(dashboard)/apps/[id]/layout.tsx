"use client"

import Link from "next/link"
import { usePathname, useParams } from "next/navigation"
import { ArrowLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { getAppNavItems } from "@/lib/app-detail-nav"
import { Badge } from "@/components/ui/badge"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { useLocale } from "@/lib/i18n"

export default function AppDetailLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const params = useParams()
  const pathname = usePathname()
  const appId = params.id as string
  const { t } = useLocale()
  const navItems = getAppNavItems(appId)

  const linkClass = (active: boolean) =>
    cn(
      "flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors",
      active
        ? "bg-primary/10 text-foreground font-medium"
        : "text-muted-foreground hover:text-foreground hover:bg-accent"
    )

  return (
    <div className="min-h-0 overflow-x-hidden -m-4 flex flex-col gap-4 bg-transparent p-4 lg:-m-6 lg:flex-row lg:gap-4 lg:p-6">
      <aside className="shrink-0 lg:w-[13rem]">
        <Link
          href="/"
          className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("backToDashboard")}
        </Link>
        <nav className="rounded-[24px] border border-border/70 bg-card/80 p-3 shadow-[0_12px_40px_rgba(15,23,42,0.05)] dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none">
          <div className="flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-1 lg:overflow-visible">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== `/apps/${appId}` && pathname.startsWith(item.href))

            if (item.hasDropdown) {
              return (
                <Collapsible key={item.labelKey} defaultOpen={isActive}>
                  <CollapsibleTrigger
                    className={cn(
                      "flex min-w-[9rem] items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors lg:w-full lg:min-w-0",
                      isActive
                        ? "bg-primary/10 text-foreground font-medium"
                        : "text-muted-foreground hover:text-foreground hover:bg-accent"
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 truncate">{t(item.labelKey)}</span>
                    {item.badgeKey && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                        {t(item.badgeKey)}
                      </Badge>
                    )}
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground data-[state=open]:rotate-90" />
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex min-w-[9rem] items-center gap-2 rounded-xl px-3 py-2 pl-8 text-sm transition-colors lg:min-w-0",
                        isActive
                          ? "bg-primary/10 text-foreground font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-accent"
                      )}
                    >
                      {t(item.labelKey)}
                    </Link>
                  </CollapsibleContent>
                </Collapsible>
              )
            }

            return (
              <Link
                key={item.labelKey}
                href={item.href}
                className={cn(linkClass(isActive), "min-w-[9rem] lg:min-w-0")}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{t(item.labelKey)}</span>
                {item.badgeKey && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                    {t(item.badgeKey)}
                  </Badge>
                )}
              </Link>
            )
          })}
          </div>
        </nav>
      </aside>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}
