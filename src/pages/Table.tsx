import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase, type TableRow, type ParticipantRow } from '../lib/supabase'
import ParticipantRowComponent from '../components/ParticipantRow'
import SettlementModal from '../components/SettlementModal'

export default function Table() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [table, setTable] = useState<TableRow | null>(null)
  const [participants, setParticipants] = useState<ParticipantRow[]>([])
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(true)
  const [showSettlement, setShowSettlement] = useState(false)
  const [copied, setCopied] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!id) return

    const fetchData = async () => {
      const { data: tableData, error: tableError } = await supabase
        .from('tables')
        .select()
        .eq('id', id)
        .single()

      if (tableError || !tableData) {
        navigate('/')
        return
      }

      setTable(tableData)

      const { data: participantData } = await supabase
        .from('participants')
        .select()
        .eq('table_id', id)
        .order('created_at', { ascending: true })

      setParticipants(participantData || [])
      setLoading(false)
    }

    fetchData()

    const channel = supabase
      .channel(`table-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'participants', filter: `table_id=eq.${id}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setParticipants((prev) => {
              if (prev.find((p) => p.id === (payload.new as ParticipantRow).id)) return prev
              return [...prev, payload.new as ParticipantRow]
            })
          } else if (payload.eventType === 'UPDATE') {
            setParticipants((prev) =>
              prev.map((p) => (p.id === (payload.new as ParticipantRow).id ? (payload.new as ParticipantRow) : p))
            )
          } else if (payload.eventType === 'DELETE') {
            setParticipants((prev) => prev.filter((p) => p.id !== (payload.old as ParticipantRow).id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [id, navigate])

  const addParticipant = async () => {
    const name = newName.trim()
    if (!name || !id) return

    const { error } = await supabase
      .from('participants')
      .insert({ table_id: id, name, amount: 0 })

    if (!error) {
      setNewName('')
      nameInputRef.current?.focus()
    }
  }

  const updateAmount = async (participantId: string, amount: number) => {
    await supabase
      .from('participants')
      .update({ amount })
      .eq('id', participantId)
  }

  const removeParticipant = async (participantId: string) => {
    await supabase.from('participants').delete().eq('id', participantId)
  }

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const total = participants.reduce((sum, p) => sum + p.amount, 0)
  const perPerson = participants.length > 0 ? total / participants.length : 0

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    )
  }

  return (
    <div className="min-h-dvh flex flex-col px-4 safe-top">
      {/* Header */}
      <div className="flex items-center justify-between py-4">
        <button
          onClick={() => navigate('/')}
          className="text-gray-400 hover:text-white active:text-white transition cursor-pointer p-2 -ml-2 rounded-lg active:bg-white/5"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-bold truncate mx-3 flex-1 text-center">
          {table?.name || 'Table'}
        </h1>
        <button
          onClick={copyLink}
          className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-surface-lighter border border-white/10 text-gray-300 active:bg-white/10 transition cursor-pointer shrink-0"
        >
          {copied ? (
            <>
              <svg className="w-4 h-4 text-positive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Copied!
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
              </svg>
              Share
            </>
          )}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-surface-light rounded-xl p-3 border border-white/5 text-center">
          <div className="text-[11px] text-gray-400 mb-0.5">People</div>
          <div className="text-lg font-bold">{participants.length}</div>
        </div>
        <div className="bg-surface-light rounded-xl p-3 border border-white/5 text-center">
          <div className="text-[11px] text-gray-400 mb-0.5">Total</div>
          <div className="text-lg font-bold">{total.toFixed(2)}</div>
        </div>
        <div className="bg-surface-light rounded-xl p-3 border border-white/5 text-center">
          <div className="text-[11px] text-gray-400 mb-0.5">Per person</div>
          <div className="text-lg font-bold">{perPerson.toFixed(2)}</div>
        </div>
      </div>

      {/* Add Participant */}
      <div className="flex gap-2 mb-3">
        <input
          ref={nameInputRef}
          type="text"
          placeholder="Add a person..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addParticipant()}
          className="flex-1 px-4 py-3 rounded-xl bg-surface-lighter border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
        />
        <button
          onClick={addParticipant}
          disabled={!newName.trim()}
          className="px-4 py-3 rounded-xl bg-primary hover:bg-primary-dark active:bg-primary-dark text-white font-medium transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Participants List */}
      <div className="space-y-2 flex-1 overflow-y-auto">
        {participants.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <div className="text-4xl mb-3">👥</div>
            <p>Add people to get started</p>
          </div>
        ) : (
          participants.map((p) => (
            <ParticipantRowComponent
              key={p.id}
              participant={p}
              onUpdateAmount={updateAmount}
              onRemove={removeParticipant}
            />
          ))
        )}
      </div>

      {/* Split Button — sticky bottom */}
      {participants.length >= 2 && (
        <div className="sticky bottom-0 pt-3 pb-4 safe-bottom bg-gradient-to-t from-surface via-surface to-transparent -mx-4 px-4">
          <button
            onClick={() => setShowSettlement(true)}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-primary to-accent text-white font-bold text-lg transition-all duration-200 hover:shadow-lg hover:shadow-primary/25 active:scale-[0.97] cursor-pointer"
          >
            Split the bill 💸
          </button>
        </div>
      )}

      {/* Settlement Modal */}
      {showSettlement && (
        <SettlementModal
          participants={participants.map((p) => ({ name: p.name, amount: p.amount }))}
          onClose={() => setShowSettlement(false)}
          onCloseTable={async () => {
            if (!id) return
            if (!confirm('Close this table? This will delete all data permanently.')) return
            await supabase.from('participants').delete().eq('table_id', id)
            await supabase.from('tables').delete().eq('id', id)
            navigate('/')
          }}
        />
      )}
    </div>
  )
}
