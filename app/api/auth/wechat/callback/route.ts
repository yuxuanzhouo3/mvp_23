import { NextResponse } from "next/server"
import { setCurrentSession } from "@/lib/auth"
import { upsertExternalUser } from "@/lib/auth-store"

export const runtime = "nodejs"

function decodeState(rawState: string | null) {
  if (!rawState) return { redirect: "/checkout" }
  try {
    const decoded = JSON.parse(Buffer.from(rawState, "base64url").toString("utf8")) as { redirect?: string }
    return { redirect: decoded?.redirect || "/checkout" }
  } catch {
    return { redirect: "/checkout" }
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const code = String(url.searchParams.get("code") ?? "").trim()
  const state = decodeState(url.searchParams.get("state"))
  const redirectUrl = new URL(state.redirect, url.origin)

  const appId = String(process.env.NEXT_PUBLIC_WECHAT_APP_ID ?? "").trim()
  const appSecret = String(process.env.WECHAT_APP_SECRET ?? "").trim()

  if (!appId || !appSecret) {
    redirectUrl.searchParams.set("error", "wechat_not_configured")
    return NextResponse.redirect(redirectUrl)
  }

  if (!code) {
    redirectUrl.searchParams.set("error", "wechat_code_missing")
    return NextResponse.redirect(redirectUrl)
  }

  try {
    const tokenUrl =
      "https://api.weixin.qq.com/sns/oauth2/access_token?" +
      new URLSearchParams({
        appid: appId,
        secret: appSecret,
        code,
        grant_type: "authorization_code",
      }).toString()

    const tokenRes = await fetch(tokenUrl)
    const tokenJson = await tokenRes.json().catch(() => ({}))
    const accessToken = String(tokenJson?.access_token ?? "").trim()
    const openId = String(tokenJson?.openid ?? "").trim()

    if (!accessToken || !openId) {
      throw new Error(String(tokenJson?.errmsg ?? "WeChat token exchange failed"))
    }

    const userInfoUrl =
      "https://api.weixin.qq.com/sns/userinfo?" +
      new URLSearchParams({
        access_token: accessToken,
        openid: openId,
        lang: "zh_CN",
      }).toString()

    const userInfoRes = await fetch(userInfoUrl)
    const userInfoJson = await userInfoRes.json().catch(() => ({}))
    const nickname = String(userInfoJson?.nickname ?? "微信用户")

    const user = await upsertExternalUser({
      id: `wechat_${openId}`,
      email: `wechat_${openId}@mornscience.ai`,
      name: nickname,
      region: "cn",
    })
    await setCurrentSession({
      id: user.id,
      email: user.email,
      name: user.name,
      region: user.region,
    })

    return NextResponse.redirect(redirectUrl)
  } catch (error: any) {
    redirectUrl.searchParams.set("error", error?.message || "wechat_callback_failed")
    return NextResponse.redirect(redirectUrl)
  }
}
