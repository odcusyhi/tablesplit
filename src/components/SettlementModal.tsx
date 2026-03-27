import { useState } from 'react'
import { calculateSettlement, type Participant } from '../lib/settlement'

type Props = {
  participants: Participant[]
  onClose: () => void
  onCloseTable: () => void
}

export default function SettlementModal({ participants, onClose, onCloseTable }: Props) {
  const [copied, setCopied] = useState(false)
  const payments = calculateSettlement(participants)
  const total = participants.reduce((sum, p) => sum + p.amount, 0)
  const perPerson = total / participants.length

  const buildCopyText = () => {
    let text = `🍽️ TableSplit Settlement\n`
    text += `━━━━━━━━━━━━━━━━━━━━\n`
    text += `Total: ${total.toFixed(2)} | Per person: ${perPerson.toFixed(2)}\n\n`

    if (payments.length > 0) {
      text += `💸 Who pays whom:\n`
      payments.forEach((p) => {
        text += `  ${p.from} → ${p.to}: ${p.amount.toFixed(2)}\n`
      })
    } else {
      text += `✨ Everyone paid equally!\n`
    }

    return text
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(buildCopyText())
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal — full-width sheet on mobile, centered card on desktop */}
      <div className="relative bg-surface-light border border-white/10 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[85dvh] overflow-y-auto p-5 space-y-4 animate-slide-up safe-bottom">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold">Settlement</h2>
          <button
            onClick={onClose}
            className="text-gray-400 active:text-white hover:text-white transition cursor-pointer p-2 -mr-2 rounded-lg active:bg-white/5"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Drag indicator on mobile */}
        <div className="sm:hidden flex justify-center -mt-2 mb-1">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Summary */}
        <div className="bg-surface rounded-xl p-4 space-y-2.5 border border-white/5">
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Total spent</span>
            <span className="font-semibold">{total.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Per person</span>
            <span className="font-semibold">{perPerson.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-400">Transactions needed</span>
            <span className="font-semibold">{payments.length}</span>
          </div>
        </div>

        {/* Individual Balances */}
        <div>
          <h3 className="text-sm font-medium text-gray-400 mb-2">Balances</h3>
          <div className="space-y-2">
            {participants.map((p) => {
              const diff = p.amount - perPerson
              return (
                <div key={p.name} className="flex items-center justify-between text-sm py-0.5">
                  <span>{p.name}</span>
                  <span
                    className={
                      diff > 0.01
                        ? 'text-positive font-medium'
                        : diff < -0.01
                        ? 'text-negative font-medium'
                        : 'text-gray-400'
                    }
                  >
                    {diff > 0.01 ? '+' : ''}
                    {diff.toFixed(2)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Payments */}
        {payments.length > 0 ? (
          <div>
            <h3 className="text-sm font-medium text-gray-400 mb-2">Who pays whom</h3>
            <div className="space-y-2">
              {payments.map((payment, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2.5 bg-surface rounded-xl px-3.5 py-3 border border-white/5"
                >
                  <div className="w-8 h-8 rounded-full bg-negative/20 text-negative flex items-center justify-center text-xs font-bold shrink-0">
                    {payment.from.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0 text-sm">
                    <span className="font-medium">{payment.from}</span>
                    <span className="text-gray-400 mx-1.5">→</span>
                    <span className="font-medium">{payment.to}</span>
                  </div>
                  <span className="font-bold text-warn shrink-0">
                    {payment.amount.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-gray-400">
            <div className="text-2xl mb-1">✨</div>
            <p>Everyone paid equally!</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="space-y-2 pt-1">
          <button
            onClick={handleCopy}
            className="w-full py-3.5 rounded-xl bg-primary hover:bg-primary-dark active:bg-primary-dark text-white font-medium transition cursor-pointer flex items-center justify-center gap-2"
          >
            {copied ? (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                Copied to clipboard!
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy settlement
              </>
            )}
          </button>

          <button
            onClick={onCloseTable}
            className="w-full py-3.5 rounded-xl bg-negative/10 border border-negative/20 text-negative font-medium hover:bg-negative/20 active:bg-negative/20 transition cursor-pointer flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Close table
          </button>
        </div>
      </div>
    </div>
  )
}
