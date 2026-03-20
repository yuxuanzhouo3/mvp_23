import { cookies } from "next/headers"
import { AUTH_COOKIE } from "@/lib/auth"
import { createSession, upsertExternalUser } from "@/lib/auth-store"

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
  const session = await createSession(user.id)

  const cookieStore = await cookies()
  cookieStore.set(AUTH_COOKIE, session.token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    expires: new Date(session.expiresAt),
  })

  return user
}
