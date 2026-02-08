"use client"

import Link from "next/link"
import { usePathname, useParams } from "next/navigation"
import { ArrowLeft, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { getAppNavItems } from "@/lib/app-detail-nav"
import { Badge } from "@/components/ui/badge"

export default function AppDetailLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const params = useParams()
  const pathname = usePathname()
  const appId = params.id as string
  const navItems = getAppNavItems(appId)

  return (
    <div className="flex flex-col lg:flex-row gap-6 -m-4 lg:-m-6 p-4 lg:p-6 bg-muted/30 min-h-0">
      <aside className="lg:w-56 shrink-0">
        <Link
          href="/"
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
        <nav className="space-y-0.5">
          {navItems.map((item) => {
            const isActive = pathname === item.href || (item.href !== `/apps/${appId}` && pathname.startsWith(item.href))
            return (
              <Link
                key={item.label}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-background text-foreground font-medium shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/80"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{item.label}</span>
                {item.badge && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                    {item.badge}
                  </Badge>
                )}
                {item.hasDropdown && (
                  <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
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
