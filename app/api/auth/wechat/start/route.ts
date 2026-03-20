import { NextResponse } from "next/server"
import crypto from "crypto"

export const runtime = "nodejs"

export async function GET(req: Request) {
  const appId = String(process.env.NEXT_PUBLIC_WECHAT_APP_ID ?? "").trim()
  if (!appId) {
    return NextResponse.json({ error: "WeChat login is not configured" }, { status: 500 })
  }

  const url = new URL(req.url)
  const redirectTarget = url.searchParams.get("redirect") || "/checkout"
  const origin = url.origin
  const callbackUrl = `${origin}/api/auth/wechat/callback`
  const state = Buffer.from(
    JSON.stringify({
      nonce: crypto.randomUUID(),
      redirect: redirectTarget,
    })
  ).toString("base64url")

  const oauthUrl =
    "https://open.weixin.qq.com/connect/oauth2/authorize?" +
    new URLSearchParams({
      appid: appId,
      redirect_uri: callbackUrl,
      response_type: "code",
      scope: "snsapi_userinfo",
      state,
    }).toString() +
    "#wechat_redirect"

  return NextResponse.redirect(oauthUrl)
}
