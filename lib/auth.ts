import { cookies } from "next/headers"
import { deleteSession, getSessionWithUser } from "@/lib/auth-store"

export const AUTH_COOKIE = "morn_auth_session"

export async function getCurrentSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(AUTH_COOKIE)?.value
  if (!token) return null
  return getSessionWithUser(token)
}

export async function clearCurrentSession() {
  const cookieStore = await cookies()
  const token = cookieStore.get(AUTH_COOKIE)?.value
  if (token) {
    await deleteSession(token)
  }
  cookieStore.delete(AUTH_COOKIE)
}
