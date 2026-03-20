import { NextResponse } from "next/server"
import { updatePaymentStatus } from "@/lib/payment-store"

export const runtime = "nodejs"

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}))
  const paymentId = String(body?.data?.object?.client_reference_id ?? body?.paymentId ?? "").trim()
  const status = String(body?.type ?? "").trim()

  if (paymentId && status === "checkout.session.completed") {
    await updatePaymentStatus(paymentId, "completed")
  }

  return NextResponse.json({
    received: true,
    paymentId: paymentId || null,
    mode: "placeholder",
  })
}
