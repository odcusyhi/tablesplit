import { Routes, Route } from 'react-router-dom'
import { I18nProvider } from './lib/i18n'
import LanguageSwitcher from './components/LanguageSwitcher'
import Home from './pages/Home'
import Table from './pages/Table'

export default function App() {
  return (
    <I18nProvider>
      <LanguageSwitcher />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/t/:id" element={<Table />} />
      </Routes>
    </I18nProvider>
  )
}
