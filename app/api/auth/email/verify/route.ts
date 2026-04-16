import { NextResponse } from "next/server"
import { setCurrentSession } from "@/lib/auth"
import { createLocalUser, findUserByEmail, updateLocalUserPassword } from "@/lib/auth-store"
import { verifyEmailVerificationCode } from "@/lib/email-verification-store"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const email = String(body?.email ?? "").trim().toLowerCase()
  const password = String(body?.password ?? "")
  const name = String(body?.name ?? "").trim()
  const region = body?.region === "cn" ? "cn" : "intl"
  const code = String(body?.code ?? "").trim()
  const purpose = body?.purpose === "reset" ? "reset" : "register"

  if (!email || !password || !code) {
    return NextResponse.json({ error: "email, password, and code are required" }, { status: 400 })
  }

  const verified = await verifyEmailVerificationCode({ email, code, purpose })
  if (!verified) {
    return NextResponse.json({ error: region === "cn" ? "验证码无效或已过期。" : "Invalid or expired verification code." }, { status: 401 })
  }

  try {
    const user =
      purpose === "reset"
        ? await updateLocalUserPassword(email, password)
        : await createLocalUser({
            email,
            password,
            region,
            name: name || undefined,
          })

    if (!user) {
      return NextResponse.json({ error: region === "cn" ? "该邮箱尚未注册。" : "No account exists for this email." }, { status: 404 })
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
  } catch (error: any) {
    const existing = await findUserByEmail(email)
    const fallback = purpose === "register" && existing
      ? region === "cn"
        ? "该邮箱已注册，请直接登录。"
        : "This email already exists. Sign in instead."
      : region === "cn"
        ? "操作失败"
        : "Request failed"
    return NextResponse.json({ error: error?.message || fallback }, { status: 400 })
  }
}
