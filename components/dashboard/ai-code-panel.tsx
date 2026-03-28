"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { Sparkles, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useLocale } from "@/lib/i18n"

type IterateResp = {
  projectId: string
  status: "done" | "error"
  summary?: string
  thinking?: string
  changedFiles?: string[]
  build?: { status: "ok" | "failed" | "skipped"; logs?: string[] }
  error?: string
}

export function AiCodePanel() {
  const [mode, setMode] = useState<"explain" | "fix" | "generate" | "refactor">("generate")
  const [value, setValue] = useState("")
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState("")
  const [result, setResult] = useState<IterateResp | null>(null)
  const { t } = useLocale()
  const params = useParams()
  const projectId = String(params?.id ?? "")

  async function handleIterate() {
    const prompt = value.trim()
    if (!prompt || !projectId) {
      return
    }
    try {
      setLoading(true)
      setStatus(mode === "explain" ? "Inspecting current app context..." : "Applying changes...")
      setResult(null)

      const ctrl = new AbortController()
      const timer = setTimeout(() => ctrl.abort(), 180_000)
      const res = await fetch("/api/iterate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, prompt, mode }),
        signal: ctrl.signal,
      })
      clearTimeout(timer)
      const json = (await res.json()) as IterateResp
      setResult(json)
      if (!res.ok || json.status === "error") {
        setStatus(json.error || "Iteration failed")
        return
      }
      setStatus(mode === "explain" ? "Context explanation ready" : "Iteration done")
      if (mode !== "explain") {
        setValue("")
      }
    } catch (e: any) {
      const msg = e?.name === "AbortError" ? "Apply 超时（180秒），请重试" : e?.message || "Iteration failed"
      setStatus(msg)
    } finally {
      setLoading(false)
    }
  }

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
        <div className="mb-3 grid grid-cols-2 gap-2">
          {([
            { key: "explain", label: "Explain" },
            { key: "fix", label: "Fix" },
            { key: "generate", label: "Generate" },
            { key: "refactor", label: "Refactor" },
          ] as const).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setMode(item.key)}
              className={`rounded-lg border px-3 py-2 text-xs ${
                mode === item.key
                  ? "border-primary/40 bg-primary/10 text-foreground"
                  : "border-border bg-background text-muted-foreground"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <Input
          placeholder={mode === "explain" ? "Explain the current app area..." : t("aiPlaceholder")}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-[5.5rem] min-h-[5.5rem] mb-3 bg-secondary border-border text-sm placeholder:text-muted-foreground"
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1 h-10 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary))]/90"
            disabled={loading}
            onClick={handleIterate}
          >
            <MessageSquare className="h-4 w-4 mr-1.5" />
            {loading ? "Applying..." : t("discussWithAI")}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-10 text-foreground border-border bg-transparent"
          >
            {t("viewSuggestions")}
          </Button>
        </div>
        {status ? <p className="mt-2 text-xs text-muted-foreground">{status}</p> : null}
        {result?.changedFiles?.length ? (
          <pre className="mt-2 max-h-32 overflow-auto text-xs whitespace-pre-wrap rounded-md bg-secondary p-2 border border-border">
{result.changedFiles.join("\n")}
          </pre>
        ) : null}
        {result?.thinking ? (
          <pre className="mt-2 max-h-32 overflow-auto text-xs whitespace-pre-wrap rounded-md bg-secondary p-2 border border-border">
{result.thinking}
          </pre>
        ) : null}
      </div>
    </aside>
  )
}
