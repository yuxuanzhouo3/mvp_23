import { NextResponse } from "next/server"

export const runtime = "nodejs"

function buildLoginRedirect(origin: string, redirect: string) {
  const redirectUrl = new URL("/login", origin)
  redirectUrl.searchParams.set("redirect", redirect)
  redirectUrl.searchParams.set("provider", "facebook")
  return redirectUrl
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const redirect = url.searchParams.get("redirect") || "/checkout?plan=pro"
  const redirectUrl = buildLoginRedirect(url.origin, redirect)
  const error = String(url.searchParams.get("error") ?? "").trim()
  const code = String(url.searchParams.get("code") ?? "").trim()

  if (error) {
    redirectUrl.searchParams.set("error", error)
    redirectUrl.searchParams.set("oauth", "provider_error")
    return NextResponse.redirect(redirectUrl)
  }

  if (code) {
    redirectUrl.searchParams.set("oauth", "callback_received")
    return NextResponse.redirect(redirectUrl)
  }

  redirectUrl.searchParams.set("oauth", "callback_opened")
  return NextResponse.redirect(redirectUrl)
}
