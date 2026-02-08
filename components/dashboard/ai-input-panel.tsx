"use client"

import { useState } from "react"
import { Sparkles, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function AiInputPanel() {
  const [value, setValue] = useState("")

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-[hsl(var(--primary))]" />
        <span className="text-xs font-medium text-muted-foreground">
          Thinking... What would you like to change?
        </span>
      </div>
      <div className="flex gap-2">
        <Input
          placeholder="Describe what you want to modify..."
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-9 bg-secondary border-border text-sm text-foreground placeholder:text-muted-foreground"
        />
        <Button
          size="sm"
          className="h-9 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90 shrink-0"
        >
          <MessageSquare className="h-3.5 w-3.5 mr-1.5" />
          Discuss with AI
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-9 text-foreground border-border shrink-0 hidden sm:flex bg-transparent"
        >
          View Suggestions
        </Button>
      </div>
    </section>
  )
}
