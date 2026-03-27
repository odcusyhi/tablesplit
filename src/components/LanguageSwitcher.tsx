import { useI18n, type Locale } from '../lib/i18n'

const flags: Record<Locale, string> = {
  en: '🇬🇧',
  es: '🇪🇸',
}

export default function LanguageSwitcher() {
  const { locale, setLocale } = useI18n()
  const next: Locale = locale === 'en' ? 'es' : 'en'

  return (
    <button
      onClick={() => setLocale(next)}
      className="fixed top-4 right-4 z-40 flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-light border border-white/10 text-sm text-gray-300 hover:text-white active:bg-white/10 transition cursor-pointer safe-top"
      aria-label={`Switch to ${next === 'es' ? 'Spanish' : 'English'}`}
    >
      <span className="text-base">{flags[locale]}</span>
      <span className="uppercase font-medium text-xs tracking-wide">{locale}</span>
    </button>
  )
}
