import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  supabase,
  type TripRow,
  type TripParticipantRow,
  type TripExpenseRow,
} from '../lib/supabase'
import { useI18n } from '../lib/i18n'
import SettlementModal from '../components/SettlementModal'

export default function Trip() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t } = useI18n()
  const [trip, setTrip] = useState<TripRow | null>(null)
  const [people, setPeople] = useState<TripParticipantRow[]>([])
  const [expenses, setExpenses] = useState<TripExpenseRow[]>([])
  const [newName, setNewName] = useState('')
  const [loading, setLoading] = useState(true)
  const [showSettlement, setShowSettlement] = useState(false)
  const [copied, setCopied] = useState(false)
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [expenseDesc, setExpenseDesc] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expensePayer, setExpensePayer] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!id) return

    const fetchData = async () => {
      const { data: tripData, error: tripError } = await supabase
        .from('trips')
        .select()
        .eq('id', id)
        .single()

      if (tripError || !tripData) {
        navigate('/')
        return
      }

      setTrip(tripData)

      const [{ data: participantData }, { data: expenseData }] = await Promise.all([
        supabase
          .from('trip_participants')
          .select()
          .eq('trip_id', id)
          .order('created_at', { ascending: true }),
        supabase
          .from('trip_expenses')
          .select()
          .eq('trip_id', id)
          .order('created_at', { ascending: true }),
      ])

      setPeople(participantData || [])
      setExpenses(expenseData || [])
      setLoading(false)
    }

    fetchData()

    const channel = supabase
      .channel(`trip-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trip_participants', filter: `trip_id=eq.${id}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setPeople((prev) => {
              const row = payload.new as TripParticipantRow
              if (prev.find((p) => p.id === row.id)) return prev
              return [...prev, row]
            })
          } else if (payload.eventType === 'DELETE') {
            setPeople((prev) => prev.filter((p) => p.id !== (payload.old as TripParticipantRow).id))
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trip_expenses', filter: `trip_id=eq.${id}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setExpenses((prev) => {
              const row = payload.new as TripExpenseRow
              if (prev.find((e) => e.id === row.id)) return prev
              return [...prev, row]
            })
          } else if (payload.eventType === 'DELETE') {
            setExpenses((prev) => prev.filter((e) => e.id !== (payload.old as TripExpenseRow).id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [id, navigate])

  const addPerson = async () => {
    const name = newName.trim()
    if (!name || !id) return
    const { error } = await supabase
      .from('trip_participants')
      .insert({ trip_id: id, name })
    if (!error) {
      setNewName('')
      nameInputRef.current?.focus()
    }
  }

  const removePerson = async (participantId: string) => {
    setPeople((prev) => prev.filter((p) => p.id !== participantId))
    setExpenses((prev) => prev.filter((e) => e.participant_id !== participantId))
    await supabase.from('trip_participants').delete().eq('id', participantId)
  }

  const openExpenseForm = () => {
    if (people.length === 0) return
    setExpenseDesc('')
    setExpenseAmount('')
    setExpensePayer(people[0].id)
    setShowExpenseForm(true)
  }

  const saveExpense = async () => {
    if (!id || !expensePayer) return
    const amount = parseFloat(expenseAmount)
    if (!Number.isFinite(amount) || amount <= 0) return
    const { error } = await supabase
      .from('trip_expenses')
      .insert({
        trip_id: id,
        participant_id: expensePayer,
        description: expenseDesc.trim(),
        amount,
      })
    if (!error) {
      setShowExpenseForm(false)
      setExpenseDesc('')
      setExpenseAmount('')
    }
  }

  const removeExpense = async (expenseId: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== expenseId))
    await supabase.from('trip_expenses').delete().eq('id', expenseId)
  }

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const settlementParticipants = useMemo(() => {
    return people.map((p) => ({
      name: p.name,
      amount: expenses
        .filter((e) => e.participant_id === p.id)
        .reduce((sum, e) => sum + Number(e.amount), 0),
    }))
  }, [people, expenses])

  const total = settlementParticipants.reduce((sum, p) => sum + p.amount, 0)
  const perPerson = people.length > 0 ? total / people.length : 0

  const personName = (participantId: string) =>
    people.find((p) => p.id === participantId)?.name ?? '—'

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
          ✈️ {trip?.name || 'Trip'}
        </h1>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-surface-light rounded-xl p-3 border border-white/5 text-center">
          <div className="text-[11px] text-gray-400 mb-0.5">{t('trip.people')}</div>
          <div className="text-lg font-bold">{people.length}</div>
        </div>
        <div className="bg-surface-light rounded-xl p-3 border border-white/5 text-center">
          <div className="text-[11px] text-gray-400 mb-0.5">{t('trip.total')}</div>
          <div className="text-lg font-bold">{total.toFixed(2)}</div>
        </div>
        <div className="bg-surface-light rounded-xl p-3 border border-white/5 text-center">
          <div className="text-[11px] text-gray-400 mb-0.5">{t('trip.perPerson')}</div>
          <div className="text-lg font-bold">{perPerson.toFixed(2)}</div>
        </div>
      </div>

      {/* Add Participant */}
      <div className="flex gap-2 mb-3">
        <input
          ref={nameInputRef}
          type="text"
          placeholder={t('trip.addPerson')}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addPerson()}
          className="flex-1 px-4 py-3 rounded-xl bg-surface-lighter border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
        />
        <button
          onClick={addPerson}
          disabled={!newName.trim()}
          className="px-4 py-3 rounded-xl bg-primary hover:bg-primary-dark active:bg-primary-dark text-white font-medium transition disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {people.length === 0 ? (
        <div className="text-center py-16 text-gray-500 flex-1">
          <div className="text-4xl mb-3">👥</div>
          <p>{t('trip.empty.people')}</p>
        </div>
      ) : (
        <>
          {/* People chips */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {people.map((p) => {
              const paid = expenses
                .filter((e) => e.participant_id === p.id)
                .reduce((s, e) => s + Number(e.amount), 0)
              return (
                <div
                  key={p.id}
                  className="flex items-center gap-1.5 bg-surface-light rounded-full pl-3 pr-2 py-1 border border-white/5 text-sm"
                >
                  <span className="font-medium">{p.name}</span>
                  {paid > 0 && (
                    <span className="text-xs text-primary font-mono">{paid.toFixed(2)}</span>
                  )}
                  <button
                    onClick={() => removePerson(p.id)}
                    className="text-gray-500 active:text-negative hover:text-negative transition cursor-pointer p-0.5 rounded-full"
                    aria-label="Remove"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              )
            })}
          </div>

          {/* Expenses list */}
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-medium text-gray-400">{t('trip.expenses')}</h2>
            <span className="text-xs text-gray-500">{expenses.length}</span>
          </div>
          <div className="space-y-2 flex-1 overflow-y-auto pb-2">
            {expenses.length === 0 ? (
              <div className="text-center py-10 text-gray-500">
                <div className="text-3xl mb-2">🧾</div>
                <p className="text-sm">{t('trip.empty.expenses')}</p>
              </div>
            ) : (
              expenses.map((e) => (
                <div
                  key={e.id}
                  className="flex items-center gap-2.5 bg-surface-light rounded-xl px-3 py-3 border border-white/5"
                >
                  <div className="w-9 h-9 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-bold shrink-0">
                    {personName(e.participant_id).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-[15px] truncate">
                      {e.description || t('trip.expenses')}
                    </div>
                    <div className="text-xs text-gray-400 truncate">
                      {personName(e.participant_id)} {t('trip.paid')}
                    </div>
                  </div>
                  <span className="font-bold font-mono text-sm shrink-0">
                    {Number(e.amount).toFixed(2)}
                  </span>
                  <button
                    onClick={() => removeExpense(e.id)}
                    className="text-gray-500 active:text-negative hover:text-negative transition cursor-pointer p-2 -mr-1 rounded-lg active:bg-white/5"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {/* Sticky bottom actions */}
      {people.length > 0 && (
        <div className="sticky bottom-0 pt-3 pb-4 safe-bottom bg-gradient-to-t from-surface via-surface to-transparent -mx-4 px-4 space-y-2">
          <button
            onClick={openExpenseForm}
            className="w-full py-3.5 rounded-xl bg-surface-lighter border border-white/10 text-white font-medium transition cursor-pointer active:bg-white/10 flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            {t('trip.addExpense')}
          </button>
          {people.length >= 2 && expenses.length > 0 && (
            <button
              onClick={() => setShowSettlement(true)}
              className="w-full py-4 rounded-xl bg-gradient-to-r from-primary to-accent text-white font-bold text-lg transition-all duration-200 hover:shadow-lg hover:shadow-primary/25 active:scale-[0.97] cursor-pointer"
            >
              {t('trip.split')}
            </button>
          )}
          <button
            onClick={copyLink}
            className="w-full py-3 rounded-xl flex items-center justify-center gap-1.5 text-sm bg-surface-lighter border border-white/10 text-gray-300 active:bg-white/10 transition cursor-pointer"
          >
            {copied ? (
              <>
                <svg className="w-4 h-4 text-positive" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                {t('trip.copied')}
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                {t('trip.share')}
              </>
            )}
          </button>
        </div>
      )}

      {/* Add expense modal */}
      {showExpenseForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowExpenseForm(false)}
          />
          <div className="relative bg-surface-light border border-white/10 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md p-5 space-y-4 animate-slide-up safe-bottom">
            <div className="sm:hidden flex justify-center -mt-2 mb-1">
              <div className="w-10 h-1 rounded-full bg-white/20" />
            </div>
            <h2 className="text-xl font-bold">{t('trip.addExpense')}</h2>

            <input
              type="text"
              placeholder={t('trip.expense.description')}
              value={expenseDesc}
              onChange={(e) => setExpenseDesc(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-surface-lighter border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
            />

            <input
              type="text"
              inputMode="decimal"
              placeholder={t('trip.expense.amount')}
              value={expenseAmount}
              onChange={(e) => {
                const v = e.target.value
                if (v === '' || /^\d*\.?\d{0,2}$/.test(v)) setExpenseAmount(v)
              }}
              className="w-full px-4 py-3 rounded-xl bg-surface-lighter border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition font-mono"
            />

            <div>
              <label className="text-sm text-gray-400 block mb-1.5">{t('trip.expense.paidBy')}</label>
              <select
                value={expensePayer}
                onChange={(e) => setExpensePayer(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-surface-lighter border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition"
              >
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                onClick={() => setShowExpenseForm(false)}
                className="flex-1 py-3 rounded-xl bg-surface-lighter border border-white/10 text-gray-300 font-medium active:bg-white/10 transition cursor-pointer"
              >
                {t('trip.expense.cancel')}
              </button>
              <button
                onClick={saveExpense}
                disabled={!expensePayer || !(parseFloat(expenseAmount) > 0)}
                className="flex-1 py-3 rounded-xl bg-primary hover:bg-primary-dark text-white font-medium transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {t('trip.expense.add')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settlement Modal */}
      {showSettlement && (
        <SettlementModal
          participants={settlementParticipants}
          onClose={() => setShowSettlement(false)}
          onCloseTable={async () => {
            if (!id) return
            if (!confirm(t('trip.closeConfirm'))) return
            await supabase.from('trip_expenses').delete().eq('trip_id', id)
            await supabase.from('trip_participants').delete().eq('trip_id', id)
            await supabase.from('trips').delete().eq('id', id)
            navigate('/')
          }}
        />
      )}
    </div>
  )
}
