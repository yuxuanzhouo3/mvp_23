import { Users as UsersIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

export default function AppUsersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Users</h1>
        <p className="text-sm text-muted-foreground">Manage app users and permissions</p>
      </div>
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
            <UsersIcon className="h-12 w-12 mb-4 opacity-50" />
            <p className="text-sm">User management coming soon</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
