import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useI18n } from '../lib/i18n'

type Mode = 'table' | 'trip'

export default function Home() {
  const navigate = useNavigate()
  const { t } = useI18n()
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState('')
  const [mode, setMode] = useState<Mode>('table')

  const create = async () => {
    setLoading(true)
    try {
      const defaultName = mode === 'trip' ? 'My Trip' : 'My Table'
      const { data, error } = await supabase
        .from('tables')
        .insert({ name: name || defaultName })
        .select()
        .single()
      if (error) throw error
      navigate(mode === 'trip' ? `/trip/${data.id}` : `/t/${data.id}`)
    } catch (err) {
      console.error('Error creating:', err)
      alert('Failed to create. Check your Supabase config.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-5 safe-top safe-bottom">
      <div className="max-w-sm w-full text-center space-y-8">
        {/* Logo / Hero */}
        <div className="space-y-3">
          <div className="text-5xl">{mode === 'trip' ? '✈️' : '🍽️'}</div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            {t('home.title.1')}<span className="text-primary">{t('home.title.2')}</span>
          </h1>
          <p className="text-gray-400 text-base sm:text-lg leading-relaxed">
            {t('home.subtitle')}<br className="sm:hidden" /> {t('home.subtitle.break')}
          </p>
        </div>

        {/* Mode toggle */}
        <div className="grid grid-cols-2 gap-2 bg-surface-light rounded-xl p-1 border border-white/5">
          <button
            onClick={() => setMode('table')}
            className={`py-2.5 rounded-lg text-sm font-medium transition cursor-pointer ${
              mode === 'table' ? 'bg-primary text-white' : 'text-gray-400 active:text-white'
            }`}
          >
            🍽️ {t('home.mode.table')}
          </button>
          <button
            onClick={() => setMode('trip')}
            className={`py-2.5 rounded-lg text-sm font-medium transition cursor-pointer ${
              mode === 'trip' ? 'bg-primary text-white' : 'text-gray-400 active:text-white'
            }`}
          >
            ✈️ {t('home.mode.trip')}
          </button>
        </div>

        {/* Create Form */}
        <div className="bg-surface-light rounded-2xl p-5 space-y-3 border border-white/5">
          <input
            type="text"
            placeholder={mode === 'trip' ? t('home.placeholder.trip') : t('home.placeholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
            className="w-full px-4 py-3.5 rounded-xl bg-surface-lighter border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
          />
          <button
            onClick={create}
            disabled={loading}
            className="w-full py-3.5 px-6 rounded-xl bg-primary hover:bg-primary-dark text-white font-semibold text-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.97]"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {t('home.button.loading')}
              </span>
            ) : (
              mode === 'trip' ? t('home.button.trip') : t('home.button')
            )}
          </button>
        </div>

        <p className="text-gray-500 text-sm px-2">
          {mode === 'trip' ? t('home.footer.trip') : t('home.footer')}
        </p>
      </div>
    </div>
  )
}
