import NextAuth from "next-auth"
import Google from "next-auth/providers/google"
import { setCurrentSession } from "@/lib/auth"
import { upsertExternalUser } from "@/lib/auth-store"

const googleClientId =
  process.env.GOOGLE_CLIENT_ID ?? process.env.GOOGLE_OAUTH_CLIENT_ID ?? ""
const googleClientSecret =
  process.env.GOOGLE_CLIENT_SECRET ?? process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? ""

if (!googleClientId || !googleClientSecret) {
  throw new Error("Missing Google OAuth environment variables")
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
  session: {
    strategy: "jwt",
  },
  providers: [
    Google({
      clientId: googleClientId,
      clientSecret: googleClientSecret,
      authorization: {
        params: {
          prompt: "select_account",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account, profile }) {
      if (account?.provider !== "google" || !user.email) {
        return true
      }

      const externalUser = await upsertExternalUser({
        id: String(profile?.sub ?? user.email),
        email: user.email,
        name: user.name || user.email,
        region: "intl",
      })

      await setCurrentSession({
        id: externalUser.id,
        email: externalUser.email,
        name: externalUser.name,
        region: externalUser.region,
      })

      return true
    },
    async jwt({ token, profile, user }) {
      if (profile?.sub) {
        token.id = profile.sub
      } else if (user?.email && !token.id) {
        token.id = user.email
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = typeof token.id === "string" ? token.id : token.sub ?? ""
      }
      return session
    },
  },
  pages: {
    signIn: "/login",
  },
})
