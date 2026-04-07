import { NextResponse } from "next/server"
import { updatePaymentStatus } from "@/lib/payment-store"
import {
  decryptWechatPayNotificationResource,
  mapWechatTradeStateToPaymentStatus,
  verifyWechatPayNotificationSignature,
} from "@/lib/payment/providers/wechatpay"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const rawBody = await req.text()
    const signature = String(req.headers.get("Wechatpay-Signature") ?? "").trim()
    const nonce = String(req.headers.get("Wechatpay-Nonce") ?? "").trim()
    const timestamp = String(req.headers.get("Wechatpay-Timestamp") ?? "").trim()
    const serial = String(req.headers.get("Wechatpay-Serial") ?? "").trim()

    if (signature && nonce && timestamp) {
      const result = verifyWechatPayNotificationSignature({
        body: rawBody,
        signature,
        nonce,
        timestamp,
        serial,
      })
      if (!result.skipped && !result.verified) {
        return NextResponse.json({ error: "Invalid WeChat Pay notification signature" }, { status: 401 })
      }
    }

    const body = JSON.parse(rawBody || "{}") as {
      out_trade_no?: string
      trade_state?: string
      resource?: {
        out_trade_no?: string
        trade_state?: string
        ciphertext?: string
        associated_data?: string
        nonce?: string
      }
    }
    const resource = body?.resource ?? {}
    const decrypted = resource?.ciphertext ? decryptWechatPayNotificationResource(resource) : null
    const outTradeNo = String(decrypted?.out_trade_no ?? resource?.out_trade_no ?? body?.out_trade_no ?? "").trim()
    const paymentStatus = mapWechatTradeStateToPaymentStatus(
      decrypted?.trade_state ?? resource?.trade_state ?? body?.trade_state
    )

    if (!outTradeNo) {
      return NextResponse.json({ error: "out_trade_no is required" }, { status: 400 })
    }

    await updatePaymentStatus(outTradeNo, paymentStatus)
    return NextResponse.json({ code: "SUCCESS", message: "成功" })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "wechat webhook failed",
      },
      { status: 400 }
    )
  }
}
