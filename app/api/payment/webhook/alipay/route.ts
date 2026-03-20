import { NextResponse } from "next/server"
import { updatePaymentStatus } from "@/lib/payment-store"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const form = await req.formData().catch(() => null)
  const outTradeNo = String(form?.get("out_trade_no") ?? "").trim()
  const tradeStatus = String(form?.get("trade_status") ?? "").trim().toUpperCase()

  if (!outTradeNo) {
    return NextResponse.json({ error: "out_trade_no is required" }, { status: 400 })
  }

  if (tradeStatus === "TRADE_SUCCESS" || tradeStatus === "TRADE_FINISHED") {
    await updatePaymentStatus(outTradeNo, "completed")
  }

  return new Response("success", { status: 200 })
}
