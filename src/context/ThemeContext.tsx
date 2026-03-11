import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

type ColorTheme = 'ocean' | 'forest' | 'sunset' | 'violet'
type Mode = 'light' | 'dark' | 'system'

interface ThemeContextValue {
  colorTheme: ColorTheme
  setColorTheme: (t: ColorTheme) => void
  mode: Mode
  setMode: (m: Mode) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export const COLOR_THEMES: ColorTheme[] = ['ocean', 'forest', 'sunset', 'violet']
export const MODES: Mode[] = ['light', 'dark', 'system']

export const THEME_LABELS: Record<ColorTheme, string> = {
  ocean: '🌊 Ocean',
  forest: '🌿 Forest',
  sunset: '🌅 Sunset',
  violet: '💜 Violet',
}

export const THEME_COLORS: Record<ColorTheme, string> = {
  ocean: '#1e40af',
  forest: '#166534',
  sunset: '#c2410c',
  violet: '#6d28d9',
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [colorTheme, setColorTheme] = useState<ColorTheme>(() =>
    (localStorage.getItem('isaqb-color-theme') as ColorTheme) || 'ocean'
  )
  const [mode, setMode] = useState<Mode>(() =>
    (localStorage.getItem('isaqb-mode') as Mode) || 'system'
  )

  const getEffectiveMode = useCallback(() => {
    if (mode === 'system') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    }
    return mode
  }, [mode])

  useEffect(() => {
    const root = document.documentElement
    const effective = getEffectiveMode()
    root.classList.toggle('dark', effective === 'dark')
    root.setAttribute('data-color-theme', colorTheme)
    localStorage.setItem('isaqb-color-theme', colorTheme)
    localStorage.setItem('isaqb-mode', mode)
  }, [mode, colorTheme, getEffectiveMode])

  useEffect(() => {
    if (mode !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => {
      document.documentElement.classList.toggle('dark', mq.matches)
    }
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [mode])

  return (
    <ThemeContext.Provider value={{ colorTheme, setColorTheme, mode, setMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be inside ThemeProvider')
  return ctx
}
