import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"

const AUTH_COOKIE = "morn_auth_session"

function isProtectedPath(pathname: string) {
  return (
    pathname === "/projects" ||
    pathname === "/activity" ||
    pathname === "/settings" ||
    pathname === "/admin" ||
    pathname === "/market" ||
    pathname.startsWith("/apps/") ||
    pathname.startsWith("/payment/")
  )
}

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  if (!isProtectedPath(pathname)) {
    return NextResponse.next()
  }

  const sessionToken = request.cookies.get(AUTH_COOKIE)?.value
  if (sessionToken) {
    return NextResponse.next()
  }

  const redirectUrl = new URL("/login", request.url)
  redirectUrl.searchParams.set("redirect", `${pathname}${search}`)
  return NextResponse.redirect(redirectUrl)
}

export const config = {
  matcher: ["/projects", "/activity", "/settings", "/admin", "/market", "/apps/:path*", "/payment/:path*"],
}
