import { createContext, useContext, useState, useCallback } from 'react'
import ro from './ro.json'
import en from './en.json'

const MESSAGES = { ro, en }
const I18nContext = createContext({ t: k => k, lang: 'ro', setLang: () => {} })

const STORAGE_KEY = 'sf_lang'

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return (saved === 'en' || saved === 'ro') ? saved : 'ro'
  })

  const setLang = useCallback((newLang) => {
    localStorage.setItem(STORAGE_KEY, newLang)
    setLangState(newLang)
  }, [])

  const t = useCallback((key, params) => {
    const msgs = MESSAGES[lang] || MESSAGES.ro
    let msg = msgs[key] ?? MESSAGES.ro[key] ?? key
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        msg = msg.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
      })
    }
    return msg
  }, [lang])

  return (
    <I18nContext.Provider value={{ t, lang, setLang }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useTranslation() {
  return useContext(I18nContext)
}
