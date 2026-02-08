import { Database } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

export default function AppDataPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Data</h1>
        <p className="text-sm text-muted-foreground">View and manage app data</p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <Database className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-sm">Data browser coming soon</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
