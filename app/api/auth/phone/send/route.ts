import { NextResponse } from "next/server"
import { createPhoneOtp } from "@/lib/phone-auth-store"

export const runtime = "nodejs"

function isValidMainlandPhone(phone: string) {
  const normalized = String(phone ?? "").replace(/[^\d]/g, "")
  return /^1\d{10}$/.test(normalized)
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const phone = String(body?.phone ?? "").trim()
  const email = String(body?.email ?? "").trim().toLowerCase()
  const region = body?.region === "cn" ? "cn" : "intl"

  if (region !== "cn") {
    return NextResponse.json({ error: "Phone OTP is only available for the China region." }, { status: 400 })
  }
  if (!email || !phone) {
    return NextResponse.json({ error: "email and phone are required" }, { status: 400 })
  }
  if (!isValidMainlandPhone(phone)) {
    return NextResponse.json({ error: "invalid phone number" }, { status: 400 })
  }

  const record = await createPhoneOtp({ phone, email })
  return NextResponse.json({
    ok: true,
    sandbox: true,
    expiresInSeconds: 300,
    sandboxCode: record.code,
    message: "Sandbox verification code generated.",
  })
}
