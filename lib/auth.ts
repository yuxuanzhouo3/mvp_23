import crypto from "crypto"
import { cookies } from "next/headers"
import { deleteSession, getSessionWithUser } from "@/lib/auth-store"

export const AUTH_COOKIE = "morn_auth_session"
const AUTH_SESSION_VERSION = "ms1"
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7

type SessionRegion = "cn" | "intl"

type SessionUser = {
  id: string
  email: string
  name: string
  region: SessionRegion
}

type SignedSessionPayload = {
  v: 1
  uid: string
  email: string
  name: string
  region: SessionRegion
  iat: number
  exp: number
}

function getSessionSecret() {
  return (
    String(process.env.AUTH_SESSION_SECRET ?? "").trim() ||
    String(process.env.INTERNAL_AI_API_KEY ?? "").trim() ||
    String(process.env.AI_API_KEY ?? "").trim() ||
    String(process.env.DASHSCOPE_API_KEY ?? "").trim() ||
    String(process.env.OPENAI_API_KEY ?? "").trim() ||
    String(process.env.NEXT_PUBLIC_SITE_URL ?? "").trim() ||
    "mornstack-dev-session-secret"
  )
}

function encodeBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url")
}

function decodeBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8")
}

function signPayload(encodedPayload: string) {
  return crypto.createHmac("sha256", getSessionSecret()).update(encodedPayload).digest("base64url")
}

function buildSignedSessionToken(user: SessionUser) {
  const issuedAt = Date.now()
  const payload: SignedSessionPayload = {
    v: 1,
    uid: user.id,
    email: user.email,
    name: user.name,
    region: user.region,
    iat: issuedAt,
    exp: issuedAt + SESSION_DURATION_MS,
  }
  const encodedPayload = encodeBase64Url(JSON.stringify(payload))
  const signature = signPayload(encodedPayload)
  return {
    token: `${AUTH_SESSION_VERSION}.${encodedPayload}.${signature}`,
    expiresAt: new Date(payload.exp),
    payload,
  }
}

function parseSignedSessionToken(token: string): SignedSessionPayload | null {
  const trimmed = String(token ?? "").trim()
  if (!trimmed.startsWith(`${AUTH_SESSION_VERSION}.`)) {
    return null
  }

  const [, encodedPayload, signature] = trimmed.split(".")
  if (!encodedPayload || !signature) {
    return null
  }

  const expected = signPayload(encodedPayload)
  const expectedBuffer = Buffer.from(expected)
  const signatureBuffer = Buffer.from(signature)
  if (
    expectedBuffer.length !== signatureBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, signatureBuffer)
  ) {
    return null
  }

  try {
    const payload = JSON.parse(decodeBase64Url(encodedPayload)) as SignedSessionPayload
    if (payload?.v !== 1 || !payload.uid || !payload.email || !payload.region) {
      return null
    }
    if (payload.exp <= Date.now()) {
      return null
    }
    return payload
  } catch {
    return null
  }
}

function buildCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  }
}

export async function setCurrentSession(user: SessionUser) {
  const cookieStore = await cookies()
  const session = buildSignedSessionToken(user)
  cookieStore.set(AUTH_COOKIE, session.token, buildCookieOptions(session.expiresAt))
  return session
}

export async function getCurrentSession() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(AUTH_COOKIE)?.value
    if (!token) return null
    const signedPayload = parseSignedSessionToken(token)
    if (signedPayload) {
      return {
        session: {
          token,
          userId: signedPayload.uid,
          createdAt: new Date(signedPayload.iat).toISOString(),
          expiresAt: new Date(signedPayload.exp).toISOString(),
        },
        user: {
          id: signedPayload.uid,
          email: signedPayload.email,
          name: signedPayload.name,
          region: signedPayload.region,
        },
      }
    }
    return getSessionWithUser(token)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/outside a request scope/i.test(message)) {
      return null
    }
    throw error
  }
}

export async function clearCurrentSession() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(AUTH_COOKIE)?.value
    if (token && !parseSignedSessionToken(token)) {
      await deleteSession(token)
    }
    cookieStore.delete(AUTH_COOKIE)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!/outside a request scope/i.test(message)) {
      throw error
    }
  }
}
