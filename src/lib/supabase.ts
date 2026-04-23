import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

if (!isSupabaseConfigured) {
  console.error(
    'Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Netlify (Site settings → Environment variables) and redeploy.'
  )
}

// Use placeholder values when missing so module load doesn't throw — the app
// will render a visible error instead of a blank screen.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
)

export type TableRow = {
  id: string
  name: string | null
  created_at: string
}

export type ParticipantRow = {
  id: string
  table_id: string
  name: string
  amount: number
  created_at: string
}
