import { NextResponse } from "next/server"
import { createPhoneOtp } from "@/lib/phone-auth-store"
import { getTencentSmsConfig, sendTencentSmsOtp } from "@/lib/tencent-sms"

export const runtime = "nodejs"

function normalizePhone(phone: string) {
  const digits = String(phone ?? "").replace(/\D/g, "")
  if (digits.startsWith("86") && digits.length === 13) return digits.slice(2)
  return digits
}

function isValidMainlandPhone(phone: string) {
  const normalized = normalizePhone(phone)
  return /^1\d{10}$/.test(normalized)
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const phone = String(body?.phone ?? "").trim()
  const region = body?.region === "cn" ? "cn" : "intl"

  if (region !== "cn") {
    return NextResponse.json({ error: "Phone OTP is only available for the China region." }, { status: 400 })
  }
  if (!phone) {
    return NextResponse.json({ error: "phone is required" }, { status: 400 })
  }
  if (!isValidMainlandPhone(phone)) {
    return NextResponse.json({ error: "invalid phone number" }, { status: 400 })
  }

  const normalizedPhone = normalizePhone(phone)
  const record = await createPhoneOtp({ phone: normalizedPhone })
  const tencentSms = getTencentSmsConfig()

  if (tencentSms.configured) {
    const result = await sendTencentSmsOtp({ phone: normalizedPhone, code: record.code })
    if (!result.ok) {
      return NextResponse.json(
        {
          error: "Tencent SMS send failed",
          providerCode: result.providerCode,
          providerMessage: result.providerMessage,
          requestId: result.requestId,
        },
        { status: 502 }
      )
    }
    return NextResponse.json({
      ok: true,
      sandbox: false,
      provider: "tencent-sms",
      requestId: result.requestId,
      expiresInSeconds: 300,
      resendAfterSeconds: 60,
      message: "Verification code sent.",
    })
  }

  return NextResponse.json({
    ok: true,
    sandbox: true,
    expiresInSeconds: 300,
    resendAfterSeconds: 60,
    sandboxCode: record.code,
    message: "Sandbox verification code generated.",
  })
}
