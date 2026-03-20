"use client"

import { Terminal, Copy, Check } from "lucide-react"
import { useState } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/lib/i18n"

const commandKeys = [
  "cliInit",
  "cliGenerate",
  "cliDeploy",
  "cliLogin",
  "cliLogout",
  "cliWhoami",
  "cliLink",
  "cliAppsList",
  "cliAppsOpen",
] as const

const commands = [
  "npx mornfullstack init",
  'npx mornfullstack generate "<prompt>"',
  "npx mornfullstack deploy",
  "npx mornfullstack login",
  "npx mornfullstack logout",
  "npx mornfullstack whoami",
  "npx mornfullstack link",
  "npx mornfullstack apps list",
  "npx mornfullstack apps open <app-id>",
]

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <Button variant="ghost" size="icon" className="shrink-0" onClick={handleCopy}>
      {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
    </Button>
  )
}

export default function CliReferencePage() {
  const { t } = useLocale()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t("cliReference")}</h1>
        <p className="text-muted-foreground mt-1">{t("cliDesc")}</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            <h2 className="font-medium">{t("installation")}</h2>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <pre className="flex-1 rounded-lg bg-muted p-4 text-sm font-mono overflow-x-auto">
              npm install -g mornfullstack-cli
            </pre>
            <CopyButton text="npm install -g mornfullstack-cli" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="font-medium">{t("commands")}</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          {commands.map((cmd, i) => (
            <div key={i} className="space-y-2">
              <p className="text-sm text-muted-foreground">{t(commandKeys[i])}</p>
              <div className="flex items-center gap-2">
                <pre className="flex-1 rounded-lg bg-muted p-3 text-sm font-mono overflow-x-auto">
                  {cmd}
                </pre>
                <CopyButton text={cmd} />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
