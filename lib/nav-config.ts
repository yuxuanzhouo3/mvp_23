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

export type NavItem = {
  label: string
  icon: LucideIcon
  href: string
  external?: boolean
}

export const mainNav: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/" },
  { label: "Projects", icon: FolderKanban, href: "/projects" },
  { label: "Templates", icon: LayoutTemplate, href: "/templates" },
  { label: "Activity Log", icon: Activity, href: "/activity" },
  { label: "Settings", icon: Settings, href: "/settings" },
]

export const devTools: NavItem[] = [
  { label: "CLI Reference", icon: Terminal, href: "/cli" },
  { label: "API Docs", icon: FileText, href: "/api-docs" },
  { label: "SDK", icon: Package, href: "/sdk" },
  { label: "Integrations", icon: Puzzle, href: "/integrations" },
]

export const community: NavItem[] = [
  { label: "Discord", icon: MessageSquare, href: "/discord" },
  { label: "Examples", icon: BookOpen, href: "/examples" },
  { label: "Blog", icon: PenLine, href: "/blog" },
]
