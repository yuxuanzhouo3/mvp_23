function requireEnv(name: string) {
  const value = String(process.env[name] ?? "").trim()
  if (!value) {
    throw new Error(`Missing ${name}`)
  }
  return value
}

export async function signInWithSupabasePassword(email: string, password: string) {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL")
  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

  const res = await fetch(`${supabaseUrl.replace(/\/+$/, "")}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({ email, password }),
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(String(json?.msg ?? json?.error_description ?? json?.error ?? "Supabase login failed"))
  }

  const user = json?.user
  if (!user?.id || !user?.email) {
    throw new Error("Supabase login did not return a valid user")
  }

  return {
    id: String(user.id),
    email: String(user.email),
    name:
      String(user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? user.email.split("@")[0]),
  }
}

export async function signUpWithSupabasePassword(email: string, password: string) {
  const supabaseUrl = requireEnv("NEXT_PUBLIC_SUPABASE_URL")
  const anonKey = requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY")

  const res = await fetch(`${supabaseUrl.replace(/\/+$/, "")}/auth/v1/signup`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
    body: JSON.stringify({ email, password }),
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(String(json?.msg ?? json?.error_description ?? json?.error ?? "Supabase sign up failed"))
  }

  const user = json?.user
  if (!user?.id || !user?.email) {
    throw new Error("Supabase sign up did not return a valid user")
  }

  return {
    id: String(user.id),
    email: String(user.email),
    name:
      String(user?.user_metadata?.full_name ?? user?.user_metadata?.name ?? user.email.split("@")[0]),
  }
}
