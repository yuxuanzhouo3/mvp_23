"use client"

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react"
import { zh } from "./locales/zh"
import { en } from "./locales/en"

export type Locale = "zh" | "en"

export const translations = { zh, en }
export type TranslationKey = keyof typeof zh

const STORAGE_KEY = "mornfullstack-locale"

function getStoredLocale(): Locale {
  if (typeof window === "undefined") return "zh"
  const stored = localStorage.getItem(STORAGE_KEY) as Locale | null
  return stored === "zh" || stored === "en" ? stored : "zh"
}

const LocaleContext = createContext<{
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: TranslationKey) => string
} | null>(null)

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("zh")

  useEffect(() => {
    setLocaleState(getStoredLocale())
  }, [])

  const setLocale = useCallback((locale: Locale) => {
    setLocaleState(locale)
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, locale)
    }
  }, [])

  const t = useCallback(
    (key: TranslationKey) => {
      return translations[locale][key] ?? translations.en[key] ?? key
    },
    [locale]
  )

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LocaleContext.Provider>
  )
}

export function useLocale() {
  const ctx = useContext(LocaleContext)
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider")
  return ctx
}
