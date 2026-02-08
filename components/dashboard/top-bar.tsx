"use client"

import Link from "next/link"
import { useTheme } from "next-themes"
import { Search, Bell, HelpCircle, Menu, Settings, LogOut, FileText, Terminal, MessageSquare, Sun, Moon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useLocale } from "@/lib/i18n"

const helpLinks = [
  { labelKey: "apiDocs" as const, href: "/api-docs", icon: FileText },
  { labelKey: "cliReference" as const, href: "/cli", icon: Terminal },
  { labelKey: "discordCommunity" as const, href: "/discord", icon: MessageSquare },
]

const notifications = [
  { id: "1", msgKey: "notifBuildSuccess" as const, timeKey: "2h ago" },
  { id: "2", msgKey: "notifBuilding" as const, timeKey: "30m ago" },
  { id: "3", msgKey: "notifNewFeature" as const, timeKey: "1d ago" },
]

const timeZh: Record<string, string> = {
  "2h ago": "2 小时前",
  "30m ago": "30 分钟前",
  "1d ago": "1 天前",
}

interface TopBarProps {
  onMenuToggle?: () => void
}

export function TopBar({ onMenuToggle }: TopBarProps) {
  const { t, locale, setLocale } = useLocale()
  const { theme, setTheme } = useTheme()

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center border-b border-border bg-background/80 backdrop-blur-sm px-4 lg:px-6">
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden mr-2 text-muted-foreground hover:text-foreground"
        onClick={onMenuToggle}
        aria-label="Toggle navigation menu"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <nav aria-label="Breadcrumb" className="hidden md:flex items-center gap-1.5 text-sm">
        <span className="text-muted-foreground">{t("personalWorkspace")}</span>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium text-foreground">{t("brand")}</span>
      </nav>

      <div className="flex-1 flex justify-center px-4 max-w-xl mx-auto">
        <div className="relative w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t("searchPlaceholder")}
            className="pl-10 h-9 bg-secondary border-border text-sm text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground hover:text-foreground h-8 px-2"
          onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
        >
          {locale === "zh" ? "EN" : "中"}
        </Button>

        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground h-8 w-8"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label={locale === "zh" ? "切换主题" : "Toggle theme"}
          title={locale === "zh" ? "亮/黑 切换主题" : "Light/Dark"}
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground"
              aria-label={t("help")}
            >
              <HelpCircle className="h-4.5 w-4.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 bg-card text-card-foreground border-border">
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">{t("helpResources")}</div>
            {helpLinks.map((item) => (
              <DropdownMenuItem key={item.labelKey} asChild>
                <Link href={item.href} className="flex items-center gap-2 cursor-pointer">
                  <item.icon className="h-4 w-4" />
                  {t(item.labelKey)}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="relative text-muted-foreground hover:text-foreground"
              aria-label={t("notifications")}
            >
              <Bell className="h-4.5 w-4.5" />
              <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-[hsl(var(--primary))]" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 bg-card text-card-foreground border-border">
            <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground flex justify-between items-center">
              {t("notifications")}
              <Button variant="ghost" size="sm" className="h-6 text-xs text-muted-foreground">{t("markAllRead")}</Button>
            </div>
            <DropdownMenuSeparator className="bg-border" />
            {notifications.map((n) => (
              <DropdownMenuItem key={n.id} className="flex flex-col items-start gap-0.5 p-3 cursor-pointer focus:bg-accent">
                <span className="text-sm">{t(n.msgKey)}</span>
                <span className="text-xs text-muted-foreground">{locale === "zh" ? timeZh[n.timeKey] ?? n.timeKey : n.timeKey}</span>
              </DropdownMenuItem>
            ))}
            {notifications.length === 0 && (
              <div className="py-8 text-center text-sm text-muted-foreground">{t("noNotifications")}</div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="ml-1" aria-label="User menu">
              <Avatar className="h-7 w-7">
                <AvatarFallback className="bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-xs font-semibold">
                  MQ
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48 bg-card text-card-foreground border-border">
            <DropdownMenuItem asChild>
              <Link href="/settings" className="flex items-center gap-2 text-sm cursor-pointer">
                <Settings className="h-4 w-4" />
                {t("settings")}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-border" />
            <DropdownMenuItem className="text-sm flex items-center gap-2 cursor-pointer">
              <LogOut className="h-4 w-4" />
              {t("signOut")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
