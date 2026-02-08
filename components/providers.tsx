"use client"

import { LocaleProvider } from "@/lib/i18n"
import { ThemeProvider } from "@/components/theme-provider"

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false} forcedTheme="light">
      <LocaleProvider>{children}</LocaleProvider>
    </ThemeProvider>
  )
}
