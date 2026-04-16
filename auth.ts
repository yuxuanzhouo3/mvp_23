import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

const googleClientId =
  process.env.GOOGLE_CLIENT_ID ?? process.env.GOOGLE_OAUTH_CLIENT_ID ?? ""
const googleClientSecret =
  process.env.GOOGLE_CLIENT_SECRET ?? process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? ""
const googleConfigured = Boolean(googleClientId && googleClientSecret)

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  trustHost: true,
  session: {
    strategy: "jwt",
  },
  providers: googleConfigured
    ? [
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
      ]
    : [],
  callbacks: {
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
