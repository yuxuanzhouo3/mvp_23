import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { resolveAppSubdomainHost } from "@/lib/app-subdomain"

const AUTH_COOKIE = "morn_auth_session"
const ADMIN_COOKIE = "admin_session"

function isReservedAssetPath(pathname: string) {
  return (
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/generated/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml"
  )
}

function isProtectedPath(pathname: string) {
  return (
    pathname === "/projects" ||
    pathname === "/activity" ||
    pathname === "/settings" ||
    pathname.startsWith("/apps/") ||
    pathname.startsWith("/payment/")
  )
}

function isAdminPath(pathname: string) {
  return pathname === "/admin" || pathname.startsWith("/admin/")
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl
  const matchedSubdomain = resolveAppSubdomainHost(request.headers.get("host"))

  if (isAdminPath(pathname)) {
    const sessionToken = request.cookies.get(ADMIN_COOKIE)?.value

    if (pathname === "/admin/login") {
      if (sessionToken) {
        return NextResponse.redirect(new URL("/admin/dashboard", request.url))
      }
      return NextResponse.next()
    }

    if (!sessionToken) {
      const redirectUrl = new URL("/admin/login", request.url)
      redirectUrl.searchParams.set("redirect", `${pathname}${search}`)
      return NextResponse.redirect(redirectUrl)
    }
  }

  if (matchedSubdomain?.slug && !pathname.startsWith("/preview/") && !isReservedAssetPath(pathname)) {
    const rewriteUrl = request.nextUrl.clone()
    rewriteUrl.pathname = pathname === "/" ? `/preview/${matchedSubdomain.slug}` : `/preview/${matchedSubdomain.slug}${pathname}`
    return NextResponse.rewrite(rewriteUrl)
  }

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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)"],
}
