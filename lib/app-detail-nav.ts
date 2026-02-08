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

export type AppNavItem = {
  label: string
  icon: LucideIcon
  href: string
  badge?: string
  /** Show dropdown chevron (e.g. for items with sub-pages) */
  hasDropdown?: boolean
}

export function getAppNavItems(appId: string): AppNavItem[] {
  const base = `/apps/${appId}`
  return [
    { label: "Overview", icon: LayoutGrid, href: base },
    { label: "Users", icon: Users, href: `${base}/users` },
    { label: "Data", icon: Database, href: `${base}/data`, hasDropdown: true },
    { label: "Analytics", icon: BarChart3, href: `${base}/analytics`, badge: "Beta" },
    { label: "Domains", icon: Globe, href: `${base}/domains` },
    { label: "Integrations", icon: Puzzle, href: `${base}/integrations` },
    { label: "Security", icon: Shield, href: `${base}/security` },
    { label: "Code", icon: Code2, href: `${base}/code` },
    { label: "Agents", icon: Bot, href: `${base}/agents` },
    { label: "Automations", icon: Zap, href: `${base}/automations` },
    { label: "Logs", icon: FileText, href: `${base}/logs` },
    { label: "API", icon: Code, href: `${base}/api` },
    { label: "Settings", icon: Settings, href: `${base}/settings`, hasDropdown: true },
  ]
}
