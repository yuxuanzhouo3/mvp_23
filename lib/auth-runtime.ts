export type AuthMode = "demo" | "password" | "supabase" | "wechat"

export type AuthRuntimeConfig = {
  intlMode: AuthMode
  cnMode: AuthMode
  supabaseConfigured: boolean
  wechatConfigured: boolean
  intlEmailPasswordEnabled: boolean
  cnEmailPasswordEnabled: boolean
  googleEnabled: boolean
  facebookEnabled: boolean
  googleConfigured: boolean
  facebookConfigured: boolean
}

function hasEnv(name: string) {
  return Boolean(String(process.env[name] ?? "").trim())
}

function normalizeMode(raw: string, allowed: AuthMode[], fallback: AuthMode) {
  const value = String(raw ?? "").trim().toLowerCase() as AuthMode
  return allowed.includes(value) ? value : fallback
}

export function resolveAuthRuntimeConfig(): AuthRuntimeConfig {
  const supabaseConfigured =
    hasEnv("NEXT_PUBLIC_SUPABASE_URL") &&
    hasEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY") &&
    hasEnv("SUPABASE_SERVICE_ROLE_KEY")

  const wechatConfigured =
    hasEnv("NEXT_PUBLIC_WECHAT_APP_ID") &&
    hasEnv("WECHAT_APP_SECRET")

  const intlFallback: AuthMode = supabaseConfigured ? "supabase" : "password"
  const cnFallback: AuthMode = "password"
  const intlMode = normalizeMode(process.env.AUTH_MODE_INTL ?? "", ["demo", "password", "supabase"], intlFallback)
  const cnMode = normalizeMode(process.env.AUTH_MODE_CN ?? "", ["demo", "password", "wechat"], cnFallback)
  const googleEnabled = String(process.env.AUTH_ENABLE_GOOGLE ?? "false").trim() === "true"
  const facebookEnabled = String(process.env.AUTH_ENABLE_FACEBOOK ?? "false").trim() === "true"
  const googleConfigured =
    hasEnv("GOOGLE_OAUTH_CLIENT_ID") &&
    hasEnv("GOOGLE_OAUTH_CLIENT_SECRET")
  const facebookConfigured =
    hasEnv("FACEBOOK_APP_ID") &&
    hasEnv("FACEBOOK_APP_SECRET")

  return {
    intlMode,
    cnMode,
    supabaseConfigured,
    wechatConfigured,
    intlEmailPasswordEnabled: intlMode === "password" || supabaseConfigured,
    cnEmailPasswordEnabled: true,
    googleEnabled,
    facebookEnabled,
    googleConfigured,
    facebookConfigured,
  }
}
