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
      "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors",
      active
        ? "bg-background text-foreground font-medium shadow-sm"
        : "text-muted-foreground hover:text-foreground hover:bg-background/80"
    )

  return (
    <div className="flex flex-col lg:flex-row gap-1 -m-4 lg:-m-6 p-4 lg:p-6 bg-muted/30 min-h-0">
      <aside className="lg:w-[9.75rem] shrink-0">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("backToDashboard")}
        </Link>
        <nav className="space-y-0.5">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== `/apps/${appId}` && pathname.startsWith(item.href))

            if (item.hasDropdown) {
              return (
                <Collapsible key={item.labelKey} defaultOpen={isActive}>
                  <CollapsibleTrigger
                    className={cn(
                      "w-full flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors text-left",
                      isActive
                        ? "bg-background text-foreground font-medium shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-background/80"
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
                        "flex items-center gap-2 rounded-md px-2.5 py-1.5 pl-8 text-sm transition-colors",
                        isActive
                          ? "bg-background text-foreground font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-background/80"
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
                className={linkClass(isActive)}
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
        </nav>
      </aside>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  )
}
