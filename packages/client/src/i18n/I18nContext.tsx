import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { dictionaries, type Lang, type Strings } from './strings'

interface I18nValue {
  lang: Lang
  setLang: (l: Lang) => void
  t: Strings
}

const I18nContext = createContext<I18nValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>('ko')
  const value = useMemo<I18nValue>(() => ({ lang, setLang, t: dictionaries[lang] }), [lang])
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}
