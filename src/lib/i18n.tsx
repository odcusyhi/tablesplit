import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

export type Locale = 'en' | 'es'

const translations = {
  en: {
    // Home
    'home.title.1': 'Table',
    'home.title.2': 'Split',
    'home.subtitle': 'Split expenses with your group.',
    'home.subtitle.break': 'No signup needed.',
    'home.placeholder': "Table name (e.g. Dinner at Luigi's)",
    'home.button': 'Open Table',
    'home.button.loading': 'Creating...',
    'home.footer': 'Share the link with your group — everyone can add their expenses in real-time.',

    // Table
    'table.people': 'People',
    'table.total': 'Total',
    'table.perPerson': 'Per person',
    'table.addPerson': 'Add a person...',
    'table.empty': 'Add people to get started',
    'table.split': 'Split the bill 💸',
    'table.share': 'Share',
    'table.copied': 'Copied!',
    'table.closeConfirm': 'Close this table? This will delete all data permanently.',

    // Settlement
    'settlement.title': 'Settlement',
    'settlement.totalSpent': 'Total spent',
    'settlement.perPerson': 'Per person',
    'settlement.transactions': 'Transactions needed',
    'settlement.balances': 'Balances',
    'settlement.whoPays': 'Who pays whom',
    'settlement.allEqual': 'Everyone paid equally!',
    'settlement.copy': 'Copy settlement',
    'settlement.copyDone': 'Copied to clipboard!',
    'settlement.closeTable': 'Close table',
    'settlement.copyText.title': '🍽️ TableSplit Settlement',
    'settlement.copyText.total': 'Total',
    'settlement.copyText.perPerson': 'Per person',
    'settlement.copyText.whoPays': '💸 Who pays whom:',
    'settlement.copyText.equal': '✨ Everyone paid equally!',
  },
  es: {
    // Home
    'home.title.1': 'Table',
    'home.title.2': 'Split',
    'home.subtitle': 'Divide los gastos con tu grupo.',
    'home.subtitle.break': 'Sin registro.',
    'home.placeholder': 'Nombre de la mesa (ej. Cena en Luigi\'s)',
    'home.button': 'Abrir mesa',
    'home.button.loading': 'Creando...',
    'home.footer': 'Comparte el enlace con tu grupo — todos pueden añadir sus gastos en tiempo real.',

    // Table
    'table.people': 'Personas',
    'table.total': 'Total',
    'table.perPerson': 'Por persona',
    'table.addPerson': 'Añadir persona...',
    'table.empty': 'Añade personas para empezar',
    'table.split': 'Dividir la cuenta 💸',
    'table.share': 'Compartir',
    'table.copied': '¡Copiado!',
    'table.closeConfirm': '¿Cerrar esta mesa? Se eliminarán todos los datos permanentemente.',

    // Settlement
    'settlement.title': 'Liquidación',
    'settlement.totalSpent': 'Total gastado',
    'settlement.perPerson': 'Por persona',
    'settlement.transactions': 'Transacciones necesarias',
    'settlement.balances': 'Balances',
    'settlement.whoPays': 'Quién paga a quién',
    'settlement.allEqual': '¡Todos pagaron lo mismo!',
    'settlement.copy': 'Copiar liquidación',
    'settlement.copyDone': '¡Copiado al portapapeles!',
    'settlement.closeTable': 'Cerrar mesa',
    'settlement.copyText.title': '🍽️ TableSplit Liquidación',
    'settlement.copyText.total': 'Total',
    'settlement.copyText.perPerson': 'Por persona',
    'settlement.copyText.whoPays': '💸 Quién paga a quién:',
    'settlement.copyText.equal': '✨ ¡Todos pagaron lo mismo!',
  },
} as const

type TranslationKey = keyof typeof translations.en

type I18nContextType = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: TranslationKey) => string
}

const I18nContext = createContext<I18nContextType | null>(null)

const STORAGE_KEY = 'tablesplit-locale'

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved === 'en' || saved === 'es') return saved
    // Auto-detect from browser
    const browserLang = navigator.language.slice(0, 2)
    return browserLang === 'es' ? 'es' : 'en'
  })

  const setLocale = (l: Locale) => {
    setLocaleState(l)
    localStorage.setItem(STORAGE_KEY, l)
  }

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  const t = (key: TranslationKey): string => {
    return translations[locale][key] ?? translations.en[key] ?? key
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider')
  return ctx
}
