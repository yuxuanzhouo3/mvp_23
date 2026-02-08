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
  type LucideIcon,
} from "lucide-react"
import type { TranslationKey } from "./i18n"

export type NavItem = {
  labelKey: TranslationKey
  icon: LucideIcon
  href: string
  external?: boolean
}

export const mainNav: NavItem[] = [
  { labelKey: "dashboard", icon: LayoutDashboard, href: "/" },
  { labelKey: "projects", icon: FolderKanban, href: "/projects" },
  { labelKey: "templates", icon: LayoutTemplate, href: "/templates" },
  { labelKey: "activityLog", icon: Activity, href: "/activity" },
  { labelKey: "settings", icon: Settings, href: "/settings" },
]

export const devTools: NavItem[] = [
  { labelKey: "cliReference", icon: Terminal, href: "/cli" },
  { labelKey: "apiDocs", icon: FileText, href: "/api-docs" },
  { labelKey: "sdk", icon: Package, href: "/sdk" },
  { labelKey: "integrations", icon: Puzzle, href: "/integrations" },
]

export const community: NavItem[] = [
  { labelKey: "discord", icon: MessageSquare, href: "/discord" },
  { labelKey: "examples", icon: BookOpen, href: "/examples" },
  { labelKey: "blog", icon: PenLine, href: "/blog" },
]
