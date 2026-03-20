import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { AUTH_COOKIE } from "@/lib/auth"
import { createLocalUser, createSession, upsertExternalUser } from "@/lib/auth-store"
import { resolveAuthRuntimeConfig } from "@/lib/auth-runtime"
import { signUpWithSupabasePassword } from "@/lib/supabase-auth"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const email = String(body?.email ?? "").trim()
  const password = String(body?.password ?? "")
  const region = body?.region === "cn" ? "cn" : "intl"
  const authRuntime = resolveAuthRuntimeConfig()

  if (!email || !password) {
    return NextResponse.json({ error: "email and password are required" }, { status: 400 })
  }

  try {
    const user =
      region === "intl"
        ? authRuntime.supabaseConfigured
          ? await (async () => {
              const supabaseUser = await signUpWithSupabasePassword(email, password)
              return upsertExternalUser({
                id: `supabase_${supabaseUser.id}`,
                email: supabaseUser.email,
                name: supabaseUser.name,
                region: "intl",
              })
            })()
          : null
        : await createLocalUser({
            email,
            password,
            region: "cn",
            name: String(body?.name ?? "").trim() || undefined,
          })

    if (!user) {
      return NextResponse.json({ error: "Intl email registration requires Supabase config" }, { status: 400 })
    }

    const session = await createSession(user.id)
    const cookieStore = await cookies()
    cookieStore.set(AUTH_COOKIE, session.token, {
      httpOnly: true,
      sameSite: "lax",
      secure: false,
      path: "/",
      expires: new Date(session.expiresAt),
    })

    return NextResponse.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        region: user.region,
      },
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Registration failed" }, { status: 400 })
  }
}
