import { Routes, Route } from 'react-router-dom'
import { I18nProvider } from './lib/i18n'
import { isSupabaseConfigured } from './lib/supabase'
import LanguageSwitcher from './components/LanguageSwitcher'
import Home from './pages/Home'
import Table from './pages/Table'
import Trip from './pages/Trip'

export default function App() {
  if (!isSupabaseConfigured) {
    return (
      <div className="min-h-dvh flex items-center justify-center px-5 safe-top safe-bottom">
        <div className="max-w-md w-full bg-surface-light border border-negative/30 rounded-2xl p-6 space-y-3 text-center">
          <div className="text-4xl">⚠️</div>
          <h1 className="text-xl font-bold">Supabase not configured</h1>
          <p className="text-gray-400 text-sm leading-relaxed">
            This deploy is missing <code className="text-warn">VITE_SUPABASE_URL</code> and/or{' '}
            <code className="text-warn">VITE_SUPABASE_ANON_KEY</code>.
          </p>
          <p className="text-gray-400 text-sm leading-relaxed">
            In Netlify: <strong>Site settings → Environment variables</strong>, add both keys, then{' '}
            <strong>redeploy</strong> (Deploys → Trigger deploy → Clear cache and deploy site).
          </p>
        </div>
      </div>
    )
  }

  return (
    <I18nProvider>
      <LanguageSwitcher />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/t/:id" element={<Table />} />
        <Route path="/trip/:id" element={<Trip />} />
      </Routes>
    </I18nProvider>
  )
}
