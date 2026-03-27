import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Home() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [tableName, setTableName] = useState('')

  const createTable = async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from('tables')
        .insert({ name: tableName || 'My Table' })
        .select()
        .single()

      if (error) throw error
      navigate(`/t/${data.id}`)
    } catch (err) {
      console.error('Error creating table:', err)
      alert('Failed to create table. Check your Supabase config.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-8">
        {/* Logo / Hero */}
        <div className="space-y-3">
          <div className="text-6xl">🍽️</div>
          <h1 className="text-4xl font-bold tracking-tight">
            Table<span className="text-primary">Split</span>
          </h1>
          <p className="text-gray-400 text-lg">
            Split expenses with your group. No signup needed.
          </p>
        </div>

        {/* Create Form */}
        <div className="bg-surface-light rounded-2xl p-6 space-y-4 border border-white/5">
          <input
            type="text"
            placeholder="Table name (e.g. Dinner at Luigi's)"
            value={tableName}
            onChange={(e) => setTableName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && createTable()}
            className="w-full px-4 py-3 rounded-xl bg-surface-lighter border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
          />
          <button
            onClick={createTable}
            disabled={loading}
            className="w-full py-3 px-6 rounded-xl bg-primary hover:bg-primary-dark text-white font-semibold text-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer active:scale-[0.98]"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Creating...
              </span>
            ) : (
              'Open Table'
            )}
          </button>
        </div>

        <p className="text-gray-500 text-sm">
          Share the link with your group &mdash; everyone can add their expenses in real-time.
        </p>
      </div>
    </div>
  )
}
