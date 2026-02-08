import { User, Bell, Shield, CreditCard } from "lucide-react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account and workspace preferences.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5" />
            <h2 className="font-medium">Profile</h2>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="name">Display Name</Label>
            <Input id="name" defaultValue="Developer" className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" defaultValue="dev@mornhub.app" className="mt-1.5" />
          </div>
          <Button size="sm">Save Changes</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <h2 className="font-medium">Notifications</h2>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Build notifications</p>
              <p className="text-sm text-muted-foreground">Email when builds complete or fail</p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Weekly digest</p>
              <p className="text-sm text-muted-foreground">Summary of your app activity</p>
            </div>
            <Switch />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <h2 className="font-medium">Security</h2>
          </div>
        </CardHeader>
        <CardContent>
          <Button variant="outline" size="sm">Change Password</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            <h2 className="font-medium">Billing</h2>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">Hobby plan — 3 projects, unlimited apps</p>
          <Button variant="outline" size="sm">Upgrade Plan</Button>
        </CardContent>
      </Card>
    </div>
  )
}
