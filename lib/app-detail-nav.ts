import {
  LayoutGrid,
  Users,
  Database,
  BarChart3,
  Globe,
  Puzzle,
  Shield,
  Code2,
  Bot,
  Zap,
  FileText,
  Code,
  Settings,
  type LucideIcon,
} from "lucide-react"

const APP_NAV_LABEL_KEYS = [
  "overview",
  "users",
  "data",
  "analytics",
  "domains",
  "integrations",
  "security",
  "code",
  "agents",
  "automations",
  "logs",
  "api",
  "settings",
] as const

export type AppNavLabelKey = (typeof APP_NAV_LABEL_KEYS)[number]

export type AppNavItem = {
  labelKey: AppNavLabelKey
  icon: LucideIcon
  href: string
  badgeKey?: "beta"
  /** Show dropdown chevron (e.g. for items with sub-pages) */
  hasDropdown?: boolean
}

export function getAppNavItems(appId: string): AppNavItem[] {
  const base = `/apps/${appId}`
  return [
    { labelKey: "overview", icon: LayoutGrid, href: base },
    { labelKey: "users", icon: Users, href: `${base}/users` },
    { labelKey: "data", icon: Database, href: `${base}/data`, hasDropdown: true },
    { labelKey: "analytics", icon: BarChart3, href: `${base}/analytics`, badgeKey: "beta" },
    { labelKey: "domains", icon: Globe, href: `${base}/domains` },
    { labelKey: "integrations", icon: Puzzle, href: `${base}/integrations` },
    { labelKey: "security", icon: Shield, href: `${base}/security` },
    { labelKey: "code", icon: Code2, href: `${base}/code` },
    { labelKey: "agents", icon: Bot, href: `${base}/agents` },
    { labelKey: "automations", icon: Zap, href: `${base}/automations` },
    { labelKey: "logs", icon: FileText, href: `${base}/logs` },
    { labelKey: "api", icon: Code, href: `${base}/api` },
    { labelKey: "settings", icon: Settings, href: `${base}/settings`, hasDropdown: true },
  ]
}
