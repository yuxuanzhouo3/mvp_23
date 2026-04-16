"use client"

import { LocaleProvider } from "@/lib/i18n"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthSessionProvider } from "@/components/auth/auth-session-provider"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthSessionProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <LocaleProvider>{children}</LocaleProvider>
      </ThemeProvider>
    </AuthSessionProvider>
  )
}
