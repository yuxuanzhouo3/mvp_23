"use client"

import { useState, useEffect, useRef } from "react"
import { Circle } from "lucide-react"
import { useLocale } from "@/lib/i18n"

const terminalLines = [
  { text: '$ curl -X POST https://api.mornhub.app/generate \\', type: "command" as const, delay: 0 },
  { text: '  -H "Content-Type: application/json" \\', type: "command" as const, delay: 200 },
  { text: '  -d \'{"prompt": "kanban board with AI suggestions"}\'', type: "command" as const, delay: 400 },
  { text: "", type: "blank" as const, delay: 600 },
  { textKey: "terminalGenerating" as const, type: "info" as const, delay: 1000 },
  { textKey: "terminalFrontend" as const, type: "success" as const, delay: 2000 },
  { textKey: "terminalBackend" as const, type: "success" as const, delay: 2600 },
  { textKey: "terminalDatabase" as const, type: "success" as const, delay: 3200 },
  { text: "Your app: https://kanban-ai.mornhub.app", type: "link" as const, delay: 3800 },
  { text: "GitHub repo: github.com/mornfullstack/kanban-ai", type: "link" as const, delay: 4200 },
]

export function TerminalDemo() {
  const [visibleLines, setVisibleLines] = useState(0)
  const [hasStarted, setHasStarted] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { t } = useLocale()

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasStarted) {
          setHasStarted(true)
        }
      },
      { threshold: 0.3 }
    )

    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [hasStarted])

  useEffect(() => {
    if (!hasStarted) return

    const timers = terminalLines.map((line, index) =>
      setTimeout(() => setVisibleLines(index + 1), line.delay)
    )

    return () => timers.forEach(clearTimeout)
  }, [hasStarted])

  const renderPrefix = (type: string) => {
    switch (type) {
      case "success":
        return <span className="text-[hsl(var(--success))]">{"[OK]"}</span>
      case "info":
        return <span className="text-[hsl(var(--primary))]">{"[..]"}</span>
      case "link":
        return <span className="text-[hsl(var(--chart-2))]">{"[>>]"}</span>
      default:
        return null
    }
  }

  const getLineText = (line: (typeof terminalLines)[number]) => {
    if ("text" in line && line.text !== undefined) return line.text
    if ("textKey" in line) return t(line.textKey)
    return ""
  }

  return (
    <section ref={ref} className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-secondary/50">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Circle className="h-2.5 w-2.5 fill-destructive text-destructive" />
            <Circle className="h-2.5 w-2.5 fill-[hsl(var(--warning))] text-[hsl(var(--warning))]" />
            <Circle className="h-2.5 w-2.5 fill-[hsl(var(--success))] text-[hsl(var(--success))]" />
          </div>
          <span className="text-xs text-muted-foreground font-medium">{t("liveDemo")}</span>
        </div>
        <span className="text-[10px] text-muted-foreground font-mono">bash</span>
      </div>

      <div className="p-4 font-mono text-xs leading-relaxed min-h-[220px] bg-secondary">
        {terminalLines.slice(0, visibleLines).map((line, index) => (
          <div key={index} className="flex gap-2">
            {line.type === "blank" ? (
              <div className="h-4" />
            ) : (
              <>
                {renderPrefix(line.type) && (
                  <span className="shrink-0">{renderPrefix(line.type)}</span>
                )}
                <span
                  className={
                    line.type === "command"
                      ? "text-[hsl(var(--success))]"
                      : line.type === "link"
                        ? "text-[hsl(var(--primary))]"
                        : "text-foreground"
                  }
                >
                  {getLineText(line)}
                </span>
              </>
            )}
          </div>
        ))}
        {visibleLines >= terminalLines.length && (
          <div className="flex items-center gap-0 mt-2">
            <span className="text-[hsl(var(--success))]">$</span>
            <span className="w-2 h-4 bg-[hsl(var(--success))] ml-1 animate-blink" />
          </div>
        )}
      </div>
    </section>
  )
}
