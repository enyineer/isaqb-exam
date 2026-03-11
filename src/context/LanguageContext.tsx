import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { BilingualText } from '../data/schema'

type Lang = 'de' | 'en'

interface LanguageContextValue {
  lang: Lang
  setLang: (l: Lang) => void
  toggleLang: () => void
  t: (textObj: BilingualText | string | undefined) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(() =>
    (localStorage.getItem('isaqb-lang') as Lang) || 'en'
  )

  const setLang = useCallback((l: Lang) => {
    setLangState(l)
    localStorage.setItem('isaqb-lang', l)
  }, [])

  const toggleLang = useCallback(() => {
    setLangState(prev => {
      const next = prev === 'en' ? 'de' : 'en'
      localStorage.setItem('isaqb-lang', next)
      return next
    })
  }, [])

  const t = useCallback((textObj: BilingualText | string | undefined): string => {
    if (!textObj) return ''
    if (typeof textObj === 'string') return textObj
    return textObj[lang] || textObj.en || textObj.de || ''
  }, [lang])

  return (
    <LanguageContext.Provider value={{ lang, setLang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be inside LanguageProvider')
  return ctx
}
