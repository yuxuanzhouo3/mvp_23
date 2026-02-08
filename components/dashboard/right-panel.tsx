"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BookOpen, MessageSquare, CalendarClock, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { useLocale } from "@/lib/i18n"

const steps = [
  { step: 1, labelKey: "step1" as const, id: "tour-generate" },
  { step: 2, labelKey: "step2" as const, id: "tour-terminal" },
  { step: 3, labelKey: "step3" as const, id: "tour-actions" },
  { step: 4, labelKey: "step4" as const, id: "tour-generations" },
]

const helpLinks = [
  { labelKey: "documentation" as const, icon: BookOpen, href: "/api-docs" },
  { labelKey: "discordCommunity" as const, icon: MessageSquare, href: "/discord" },
  { labelKey: "scheduleDemo" as const, icon: CalendarClock, href: "/discord" },
]

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" })
}

export function RightPanel() {
  const pathname = usePathname()
  const isDashboard = pathname === "/"
  const { t } = useLocale()

  return (
    <aside className="hidden xl:flex flex-col w-72 border-l border-border bg-card/50 h-screen sticky top-0 overflow-y-auto">
      <div className="p-5">
        <h3 className="text-sm font-semibold text-foreground mb-4">
          {t("gettingStarted")}
        </h3>

        <ol className="flex flex-col gap-3">
          {steps.map((item) => (
            <li key={item.step} className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => isDashboard && scrollToSection(item.id)}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--primary))]/10 text-[hsl(var(--primary))] text-xs font-semibold hover:bg-[hsl(var(--primary))]/20 transition-colors cursor-pointer"
              >
                {item.step}
              </button>
              <button
                type="button"
                onClick={() => isDashboard && scrollToSection(item.id)}
                className="text-sm text-muted-foreground leading-6 hover:text-foreground transition-colors text-left cursor-pointer"
              >
                {t(item.labelKey)}
              </button>
            </li>
          ))}
        </ol>

        <Button
          size="sm"
          className="w-full mt-5 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90"
          onClick={() => {
            if (isDashboard) {
              scrollToSection("tour-project")
            }
          }}
        >
          {t("takeTour")}
          <ArrowRight className="h-3.5 w-3.5 ml-1" />
        </Button>
      </div>

      <Separator />

      <div className="p-5">
        <h3 className="text-sm font-semibold text-foreground mb-3">
          {t("needHelp")}
        </h3>

        <ul className="flex flex-col gap-1" role="list">
          {helpLinks.map((item) => (
            <li key={item.labelKey}>
              <Link
                href={item.href}
                className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {t(item.labelKey)}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <Separator />

      <div className="p-5">
        <div className="rounded-lg border border-border bg-secondary/50 p-4">
          <p className="text-sm font-medium text-foreground mb-1.5">
            {t("readyTemplate")}
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t("readyTemplateDesc")}
          </p>
        </div>
      </div>
    </aside>
  )
}
