"use client"

import { Package, Code2 } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useLocale } from "@/lib/i18n"

export default function SdkPage() {
  const { t } = useLocale()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">{t("sdk")}</h1>
        <p className="text-muted-foreground mt-1">{t("sdkDesc")}</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            <h2 className="font-medium">JavaScript / TypeScript</h2>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <pre className="rounded-lg bg-muted p-4 text-sm font-mono overflow-x-auto">
            npm install @mornfullstack/sdk
          </pre>
          <pre className="rounded-lg bg-muted p-4 text-sm font-mono overflow-x-auto">
{`import { MornFullStack } from '@mornfullstack/sdk';

const client = new MornFullStack({ apiKey: process.env.MORN_API_KEY });
const app = await client.generate({ prompt: "Task manager" });`}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Code2 className="h-5 w-5" />
            <h2 className="font-medium">Python</h2>
          </div>
        </CardHeader>
        <CardContent>
          <pre className="rounded-lg bg-muted p-4 text-sm font-mono overflow-x-auto">
            pip install mornfullstack
          </pre>
        </CardContent>
      </Card>

      <Button variant="outline">{t("viewOnNpm")}</Button>
    </div>
  )
}
