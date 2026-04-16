import { NextResponse } from "next/server"
import { findUserByEmail } from "@/lib/auth-store"
import { sendEmailVerificationCode } from "@/lib/email-auth"
import { createEmailVerificationCode } from "@/lib/email-verification-store"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const email = String(body?.email ?? "").trim().toLowerCase()
  const region = body?.region === "cn" ? "cn" : "intl"
  const purpose = body?.purpose === "reset" ? "reset" : "register"

  if (!email) {
    return NextResponse.json({ error: "email is required" }, { status: 400 })
  }

  const existing = await findUserByEmail(email)
  if (purpose === "register" && existing) {
    return NextResponse.json({ error: region === "cn" ? "该邮箱已注册，请直接登录。" : "This email already exists. Sign in instead." }, { status: 400 })
  }
  if (purpose === "reset" && !existing) {
    return NextResponse.json({ error: region === "cn" ? "该邮箱尚未注册。" : "No account exists for this email." }, { status: 404 })
  }

  const record = await createEmailVerificationCode({
    email,
    region,
    purpose,
  })

  try {
    await sendEmailVerificationCode({
      email,
      code: record.code,
      region,
      purpose,
    })
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to send verification email" }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    expiresAt: record.expiresAt,
  })
}
