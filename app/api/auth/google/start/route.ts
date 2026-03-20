import { NextResponse } from "next/server"
import { createDemoOAuthSession } from "@/lib/oauth-demo"

export const runtime = "nodejs"

export async function GET(req: Request) {
  const url = new URL(req.url)
  const redirectTarget = url.searchParams.get("redirect") || "/checkout"
  const redirectUrl = new URL(redirectTarget, url.origin)

  await createDemoOAuthSession("google")
  redirectUrl.searchParams.set("provider", "google")
  redirectUrl.searchParams.set("mode", "demo-social")

  return NextResponse.redirect(redirectUrl)
}
