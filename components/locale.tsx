"use client"

import { createContext, useContext, useEffect, useState } from "react"

import { localeFromLanguage, messages, type Locale, type Messages } from "@/content/messages"

const LocaleContext = createContext<{
  locale: Locale
  setLocale: (locale: Locale) => void
  t: Messages
}>({
  locale: "en",
  setLocale: () => undefined,
  t: messages.en,
})

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en")

  useEffect(() => {
    // Saved language is only available in the browser. Applying it after mount keeps the server HTML stable.
    /* eslint-disable react-hooks/set-state-in-effect */
    const saved = window.localStorage.getItem("vehra-lang")
    if (saved === "en" || saved === "hi" || saved === "pa") {
      setLocaleState(saved)
      return
    }
    setLocaleState(localeFromLanguage(navigator.language || "en"))
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const setLocale = (next: Locale) => {
    setLocaleState(next)
    window.localStorage.setItem("vehra-lang", next)
  }

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t: messages[locale] }}>{children}</LocaleContext.Provider>
  )
}

export function useLocale() {
  return useContext(LocaleContext)
}

export function openChat(flow?: "book") {
  window.dispatchEvent(new CustomEvent("vehra:open", { detail: { flow } }))
}

const LANGS: { id: Locale; label: string; name: string }[] = [
  { id: "en", label: "EN", name: "English" },
  { id: "hi", label: "हिं", name: "हिंदी" },
  { id: "pa", label: "ਪੰ", name: "ਪੰਜਾਬੀ" },
]

export function LanguageSwitch({ label, compact = false }: { label: string; compact?: boolean }) {
  const { locale, setLocale } = useLocale()
  return (
    <div className={compact ? "lang lang--sm" : "lang"} role="group" aria-label={label}>
      {LANGS.map((item) => (
        <button
          key={item.id}
          type="button"
          lang={item.id}
          aria-label={item.name}
          aria-pressed={locale === item.id}
          onClick={() => setLocale(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
