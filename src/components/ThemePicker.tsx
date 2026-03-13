import { useTheme, COLOR_THEMES, THEME_LABELS, THEME_COLORS, MODES } from '../context/ThemeContext'
import { useLanguage } from '../context/LanguageContext'
import { Sun, Moon, Monitor, Palette } from 'lucide-react'
import { useState, useRef, useEffect } from 'react'

const MODE_ICONS = {
  light: Sun,
  dark: Moon,
  system: Monitor,
} as const

export function ThemePicker() {
  const { colorTheme, setColorTheme, mode, setMode } = useTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div className="relative" ref={ref}>
      <button
        className="size-9 sm:size-auto sm:h-10 sm:px-3 sm:py-2 flex items-center justify-center gap-1.5 rounded-lg border-2 border-border bg-surface hover:bg-surface-hover transition-all duration-200 cursor-pointer"
        onClick={() => setOpen(!open)}
        aria-label="Theme settings"
        aria-expanded={open}
      >
        <Palette size={16} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-surface border-2 border-border rounded-xl p-4 shadow-xl z-50 page-enter">
          {/* Mode Toggle */}
          <div className="mb-3">
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Mode</p>
            <div className="flex gap-1 bg-surface-alt rounded-lg p-1">
              {MODES.map(m => {
                const Icon = MODE_ICONS[m]
                return (
                  <button
                    key={m}
                    className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-medium transition-all duration-200 cursor-pointer whitespace-nowrap ${
                      mode === m
                        ? 'bg-primary text-white shadow-sm'
                        : 'hover:bg-surface-hover'
                    }`}
                    onClick={() => setMode(m)}
                    aria-pressed={mode === m}
                  >
                    <Icon size={14} />
                    <span className="capitalize">{m}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Color Themes */}
          <div>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">Theme</p>
            <div className="grid grid-cols-2 gap-2">
              {COLOR_THEMES.map(t => (
                <button
                  key={t}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer border-2 ${
                    colorTheme === t
                      ? 'border-primary bg-surface-hover'
                      : 'border-transparent hover:bg-surface-hover'
                  }`}
                  onClick={() => setColorTheme(t)}
                  aria-pressed={colorTheme === t}
                >
                  <span>{THEME_LABELS[t]}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function LanguageToggle() {
  const { lang, toggleLang } = useLanguage()

  return (
    <button
      onClick={toggleLang}
      className="size-9 sm:size-auto sm:px-3 sm:py-2 flex items-center justify-center gap-1 rounded-lg border-2 border-border bg-surface hover:bg-surface-hover transition-all duration-200 text-sm font-semibold cursor-pointer"
      aria-label={`Switch to ${lang === 'en' ? 'German' : 'English'}`}
    >
      {lang === 'en' ? '🇩🇪' : '🇬🇧'}
      <span className="hidden sm:inline">{lang === 'en' ? 'DE' : 'EN'}</span>
    </button>
  )
}
