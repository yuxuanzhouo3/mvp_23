import { NextResponse } from "next/server"
import { setCurrentSession } from "@/lib/auth"
import { upsertExternalUser } from "@/lib/auth-store"
import { verifyPhoneOtp } from "@/lib/phone-auth-store"

export const runtime = "nodejs"

function normalizePhone(phone: string) {
  const digits = String(phone ?? "").replace(/\D/g, "")
  if (digits.startsWith("86") && digits.length === 13) return digits.slice(2)
  return digits
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const phone = String(body?.phone ?? "").trim()
  const code = String(body?.code ?? "").trim()
  const name = String(body?.name ?? "").trim()
  const region = body?.region === "cn" ? "cn" : "intl"

  if (region !== "cn") {
    return NextResponse.json({ error: "Phone OTP is only available for the China region." }, { status: 400 })
  }
  if (!phone || !code) {
    return NextResponse.json({ error: "phone and code are required" }, { status: 400 })
  }

  const record = await verifyPhoneOtp({ phone, code })
  if (!record) {
    return NextResponse.json({ error: "Invalid or expired verification code" }, { status: 401 })
  }

  const normalizedPhone = normalizePhone(phone)
  const userEmail = record.email || `phone_${normalizedPhone}@cn.mornstack.local`
  const user = await upsertExternalUser({
    id: `phone_${normalizedPhone}`,
    email: userEmail,
    name: name || `用户${normalizedPhone.slice(-4)}`,
    region: "cn",
  })

  await setCurrentSession({
    id: user.id,
    email: user.email,
    name: user.name,
    region: user.region,
  })

  return NextResponse.json({
    ok: true,
    sandbox: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      region: user.region,
    },
  })
}
