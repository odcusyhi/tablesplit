import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    'Missing Supabase environment variables. Create a .env file with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY'
  )
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

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

export type TripRow = {
  id: string
  name: string | null
  created_at: string
}

export type TripParticipantRow = {
  id: string
  trip_id: string
  name: string
  created_at: string
}

export type TripExpenseRow = {
  id: string
  trip_id: string
  participant_id: string
  description: string
  amount: number
  created_at: string
}
