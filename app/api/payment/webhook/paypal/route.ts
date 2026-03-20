import { NextResponse } from "next/server"
import { updatePaymentStatus } from "@/lib/payment-store"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const paymentId = String(body?.resource?.custom_id ?? body?.resource?.invoice_id ?? body?.paymentId ?? "").trim()
  const eventType = String(body?.event_type ?? "").trim()

  if (paymentId && eventType === "CHECKOUT.ORDER.APPROVED") {
    await updatePaymentStatus(paymentId, "completed")
  }

  return NextResponse.json({
    received: true,
    paymentId: paymentId || null,
    mode: "placeholder",
  })
}
