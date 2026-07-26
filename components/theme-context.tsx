"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"

export type Theme = "dark" | "light"

const THEME_STORAGE_KEY = "car-mod-studio-theme"

type ThemeContextValue = {
  theme: Theme
  toggleTheme: () => void
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

/**
 * Resolve the initial theme following the priority:
 * 1. localStorage value (user's previous choice)
 * 2. system preference via prefers-color-scheme
 * 3. fallback to "dark"
 */
function resolveInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark"
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    if (stored === "dark" || stored === "light") return stored
  } catch {
    // localStorage may be unavailable (private mode, etc.)
  }
  if (window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches) {
    return "light"
  }
  return "dark"
}

/**
 * Keep <html data-theme="..."> in sync with the provided theme.
 */
function syncHtmlAttribute(theme: Theme) {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", theme)
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark")

  // Initialize theme on mount (client-only to avoid SSR mismatch).
  useEffect(() => {
    const initial = resolveInitialTheme()
    setThemeState(initial)
    syncHtmlAttribute(initial)
  }, [])

  // Follow system preference changes, but only when the user has not
  // explicitly chosen a theme (no localStorage record).
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return
    const mediaQuery = window.matchMedia("(prefers-color-scheme: light)")
    const handleChange = () => {
      try {
        const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
        if (stored === "dark" || stored === "light") return // user has chosen
      } catch {
        // ignore
      }
      const next: Theme = mediaQuery.matches ? "light" : "dark"
      setThemeState(next)
      syncHtmlAttribute(next)
    }
    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    syncHtmlAttribute(next)
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next)
    } catch {
      // localStorage may be unavailable
    }
  }, [])

  const toggleTheme = useCallback(() => {
    setThemeState((current) => {
      const next: Theme = current === "dark" ? "light" : "dark"
      syncHtmlAttribute(next)
      try {
        window.localStorage.setItem(THEME_STORAGE_KEY, next)
      } catch {
        // localStorage may be unavailable
      }
      return next
    })
  }, [])

  const value = useMemo<ThemeContextValue>(
    () => ({ theme, toggleTheme, setTheme }),
    [theme, toggleTheme, setTheme],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    throw new Error("useTheme must be used within a ThemeProvider")
  }
  return ctx
}
