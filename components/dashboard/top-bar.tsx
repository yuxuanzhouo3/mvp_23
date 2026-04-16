"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { Globe, Menu, Moon, Sun, LogOut, UserCog, LayoutDashboard, FolderKanban, LayoutTemplate, Search, HelpCircle, Bell, type LucideIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useLocale } from "@/lib/i18n"

interface TopBarProps {
  onMenuToggle?: () => void
}

type HeaderNavItem = {
  href: string
  label: string
  icon?: LucideIcon
}

export function TopBar({ onMenuToggle }: TopBarProps) {
  const pathname = usePathname()
  const { locale, setLocale } = useLocale()
  const { resolvedTheme, setTheme } = useTheme()
  const isDark = resolvedTheme === "dark"
  const isHome = pathname === "/"
  const isAppDetail = pathname?.startsWith("/apps/") ?? false
  const [user, setUser] = useState<{ name: string; email: string } | null>(null)
  const [authResolved, setAuthResolved] = useState(false)

  useEffect(() => {
    fetch("/api/auth/runtime-session")
      .then((res) => res.json())
      .then((json) => setUser(json?.authenticated ? json.user : null))
      .catch(() => setUser(null))
      .finally(() => setAuthResolved(true))
  }, [])

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null)
    setUser(null)
    window.location.href = "/login?switch=1"
  }

  const navItems = useMemo<HeaderNavItem[]>(
    () =>
      isHome
        ? [
            { href: "/projects", label: locale === "zh" ? "项目" : "Projects" },
            { href: "/templates", label: locale === "zh" ? "模板" : "Templates" },
            { href: "/demo", label: locale === "zh" ? "演示" : "Demo" },
          ]
        : [
            { href: "/", label: locale === "zh" ? "首页" : "Home", icon: LayoutDashboard },
            { href: "/projects", label: locale === "zh" ? "项目" : "Projects", icon: FolderKanban },
            { href: "/templates", label: locale === "zh" ? "模板" : "Templates", icon: LayoutTemplate },
          ],
    [isHome, locale]
  )

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b backdrop-blur-xl",
        isHome
          ? "border-white/10 bg-background/70 supports-[backdrop-filter]:bg-background/60"
          : "border-border/80 bg-background/88 supports-[backdrop-filter]:bg-background/76"
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 md:px-6">
        {!isHome && (
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={onMenuToggle}
            aria-label={locale === "zh" ? "打开导航" : "Open navigation"}
          >
            <Menu className="h-5 w-5" />
          </Button>
        )}

        <Link href="/" className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#4f7cff,#7c3aed)] text-sm font-semibold text-white shadow-[0_12px_30px_rgba(79,124,255,0.28)]">
            M
          </div>
          <div className="min-w-0 truncate text-base font-semibold tracking-tight">mornstack</div>
        </Link>

        <div className="hidden min-w-0 flex-1 items-center gap-6 lg:flex">
          <nav className="flex min-w-[220px] items-center gap-2 text-sm text-muted-foreground">
            {isAppDetail ? (
              <>
                <span>{locale === "zh" ? "生成工作区" : "Generated workspace"}</span>
                <span>/</span>
                <span className="font-medium text-foreground">{locale === "zh" ? "项目详情" : "Project detail"}</span>
              </>
            ) : isHome ? (
              <>
                <span>{locale === "zh" ? "个人工作区" : "Workspace"}</span>
                <span>/</span>
                <span className="font-medium text-foreground">mornstack</span>
              </>
            ) : (
              navItems.map((item) => {
                const active = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href))
                const Icon = item.icon
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "inline-flex items-center gap-2 text-sm font-medium transition-colors",
                      active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {Icon ? <Icon className="h-4 w-4" /> : null}
                    {item.label}
                  </Link>
                )
              })
            )}
          </nav>

          <div className="min-w-0 flex-1">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={locale === "zh" ? "搜索项目、模板、文档..." : "Search projects, templates, docs..."}
                className="h-11 rounded-2xl border-border/80 bg-background/82 pl-11 pr-4 text-sm text-foreground shadow-none placeholder:text-muted-foreground dark:border-white/10 dark:bg-white/[0.03]"
              />
            </div>
          </div>
        </div>

        <nav className="hidden items-center justify-center gap-7 md:flex lg:hidden">
          {navItems.map((item) => {
            const active = pathname === item.href || (item.href !== "/" && pathname?.startsWith(item.href))
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex items-center gap-2 text-sm font-medium transition-colors",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {Icon ? <Icon className="h-4 w-4" /> : null}
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="ml-auto flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl"
            onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
            aria-label={locale === "zh" ? "切换语言" : "Switch language"}
          >
            <Globe className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            aria-label={locale === "zh" ? "切换主题" : "Toggle theme"}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          <Button
            variant="outline"
            size="sm"
            asChild
            className="hidden rounded-xl border-border/80 bg-background/70 px-4 md:inline-flex"
          >
            <Link href="/checkout">Checkout</Link>
          </Button>

          <Button variant="ghost" size="icon" className="hidden rounded-xl md:inline-flex" aria-label="Help">
            <HelpCircle className="h-4 w-4" />
          </Button>

          <Button variant="ghost" size="icon" className="hidden rounded-xl md:inline-flex" aria-label="Notifications">
            <Bell className="h-4 w-4" />
          </Button>

          {!authResolved ? (
            <Button variant="outline" size="sm" className="rounded-xl px-4" disabled>
              {locale === "zh" ? "登录中" : "Loading"}
            </Button>
          ) : user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-10 rounded-xl px-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                      {user.name?.slice(0, 1) || "G"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-2xl border-border/80">
                <div className="px-3 py-2">
                  <div className="text-sm font-medium">{user.name}</div>
                  <div className="text-xs text-muted-foreground">{user.email}</div>
                </div>
                <DropdownMenuItem asChild>
                  <Link href="/login?switch=1" className="flex cursor-pointer items-center gap-2">
                    <UserCog className="h-4 w-4" />
                    {locale === "zh" ? "切换账号" : "Switch account"}
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="flex cursor-pointer items-center gap-2" onClick={handleLogout}>
                  <LogOut className="h-4 w-4" />
                  {locale === "zh" ? "退出登录" : "Sign out"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              variant="outline"
              size="sm"
              asChild
              className="rounded-xl border-border/80 bg-background/78 px-4 shadow-none"
            >
              <Link href="/login">{locale === "zh" ? "登录" : "Log in"}</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
