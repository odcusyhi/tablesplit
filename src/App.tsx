import { Routes, Route } from 'react-router-dom'
import { I18nProvider } from './lib/i18n'
import LanguageSwitcher from './components/LanguageSwitcher'
import Home from './pages/Home'
import Table from './pages/Table'
import Trip from './pages/Trip'

export default function App() {
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
