import { setCurrentSession } from "@/lib/auth"
import { upsertExternalUser } from "@/lib/auth-store"

type DemoOAuthProvider = "google" | "facebook"

const PROVIDER_COPY: Record<
  DemoOAuthProvider,
  {
    userId: string
    email: string
    name: string
  }
> = {
  google: {
    userId: "google_demo_user",
    email: "google-demo@mornscience.ai",
    name: "Google Demo User",
  },
  facebook: {
    userId: "facebook_demo_user",
    email: "facebook-demo@mornscience.ai",
    name: "Facebook Demo User",
  },
}

export async function createDemoOAuthSession(provider: DemoOAuthProvider) {
  const preset = PROVIDER_COPY[provider]
  const user = await upsertExternalUser({
    id: preset.userId,
    email: preset.email,
    name: preset.name,
    region: "intl",
  })
  await setCurrentSession({
    id: user.id,
    email: user.email,
    name: user.name,
    region: user.region,
  })

  return user
}
