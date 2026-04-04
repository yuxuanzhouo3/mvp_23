import { NextResponse } from "next/server"
import { findUserByCredentials, upsertExternalUser } from "@/lib/auth-store"
import { setCurrentSession } from "@/lib/auth"
import { resolveAuthRuntimeConfig } from "@/lib/auth-runtime"
import { signInWithSupabasePassword } from "@/lib/supabase-auth"

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

  let user
  if (region === "intl" && authRuntime.intlMode === "supabase") {
    const supabaseUser = await signInWithSupabasePassword(email, password)
    user = await upsertExternalUser({
      id: `supabase_${supabaseUser.id}`,
      email: supabaseUser.email,
      name: supabaseUser.name,
      region: "intl",
    })
  } else {
    user = await findUserByCredentials(email, password)
  }

  if (!user) {
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 })
  }

  await setCurrentSession({
    id: user.id,
    email: user.email,
    name: user.name,
    region: user.region,
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
}
