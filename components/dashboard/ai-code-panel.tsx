"use client"

import { useState } from "react"
import { Sparkles, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useLocale } from "@/lib/i18n"

export function AiCodePanel() {
  const [value, setValue] = useState("")
  const { t } = useLocale()

  return (
    <aside className="hidden xl:flex flex-col w-80 shrink-0 border-l border-border bg-card/80 h-full min-h-0">
      <div className="p-3 border-b border-border shrink-0">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-[hsl(var(--primary))]" />
          {t("aiCodePanelTitle")}
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          {t("aiCodePanelDesc")}
        </p>
      </div>
      <div className="flex-1 min-h-0" />
      <div className="p-4 pt-3 pb-8 shrink-0 border-t border-border">
        <Input
          placeholder={t("aiPlaceholder")}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-[5.5rem] min-h-[5.5rem] mb-3 bg-secondary border-border text-sm placeholder:text-muted-foreground"
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1 h-10 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90"
          >
            <MessageSquare className="h-4 w-4 mr-1.5" />
            {t("discussWithAI")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-10 text-foreground border-border bg-transparent"
          >
            {t("viewSuggestions")}
          </Button>
        </div>
      </div>
    </aside>
  )
}
