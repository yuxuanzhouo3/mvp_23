import { NextResponse } from "next/server"
import { updatePaymentStatus } from "@/lib/payment-store"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const resource = body?.resource ?? {}
  const outTradeNo = String(resource?.out_trade_no ?? body?.out_trade_no ?? "").trim()

  if (!outTradeNo) {
    return NextResponse.json({ error: "out_trade_no is required" }, { status: 400 })
  }

  await updatePaymentStatus(outTradeNo, "completed")
  return NextResponse.json({ code: "SUCCESS", message: "成功" })
}
