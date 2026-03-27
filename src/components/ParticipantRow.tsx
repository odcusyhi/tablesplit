import { useState, useRef, useEffect } from 'react'
import type { ParticipantRow } from '../lib/supabase'

type Props = {
  participant: ParticipantRow
  onUpdateAmount: (id: string, amount: number) => void
  onRemove: (id: string) => void
}

export default function ParticipantRowComponent({ participant, onUpdateAmount, onRemove }: Props) {
  const [amountStr, setAmountStr] = useState(participant.amount > 0 ? participant.amount.toString() : '')
  const [editing, setEditing] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  // Sync from external updates (real-time)
  useEffect(() => {
    if (!editing) {
      setAmountStr(participant.amount > 0 ? participant.amount.toString() : '')
    }
  }, [participant.amount, editing])

  const handleAmountChange = (value: string) => {
    // Allow empty, numbers, and one decimal point
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
      setAmountStr(value)

      // Debounce the update
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        const num = parseFloat(value) || 0
        onUpdateAmount(participant.id, num)
      }, 500)
    }
  }

  const handleBlur = () => {
    setEditing(false)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const num = parseFloat(amountStr) || 0
    onUpdateAmount(participant.id, num)
    setAmountStr(num > 0 ? num.toString() : '')
  }

  return (
    <div className="flex items-center gap-3 bg-surface-light rounded-xl px-4 py-3 border border-white/5 group">
      {/* Avatar */}
      <div className="w-9 h-9 rounded-full bg-primary/20 text-primary flex items-center justify-center text-sm font-bold shrink-0">
        {participant.name.charAt(0).toUpperCase()}
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <span className="font-medium truncate block">{participant.name}</span>
      </div>

      {/* Amount Input */}
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          value={amountStr}
          placeholder="0.00"
          onFocus={() => setEditing(true)}
          onChange={(e) => handleAmountChange(e.target.value)}
          onBlur={handleBlur}
          className="w-24 text-right px-3 py-1.5 rounded-lg bg-surface-lighter border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition text-sm font-mono"
        />
      </div>

      {/* Remove */}
      <button
        onClick={() => onRemove(participant.id)}
        className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-negative transition cursor-pointer p-1"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}
