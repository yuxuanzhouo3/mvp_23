import { cookies } from "next/headers"
import { deleteSession, getSessionWithUser } from "@/lib/auth-store"

export const AUTH_COOKIE = "morn_auth_session"

export async function getCurrentSession() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get(AUTH_COOKIE)?.value
    if (!token) return null
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
    if (token) {
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
