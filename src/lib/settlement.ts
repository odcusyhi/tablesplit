export type Payment = {
  from: string
  to: string
  amount: number
}

export type Participant = {
  name: string
  amount: number
}

export function calculateSettlement(participants: Participant[]): Payment[] {
  if (participants.length < 2) return []

  const total = participants.reduce((sum, p) => sum + p.amount, 0)
  const average = total / participants.length

  // Calculate each person's balance (positive = owed money, negative = owes money)
  const balances = participants.map((p) => ({
    name: p.name,
    balance: p.amount - average,
  }))

  // Separate into debtors and creditors
  const debtors = balances
    .filter((b) => b.balance < -0.01)
    .map((b) => ({ ...b, balance: Math.abs(b.balance) }))
    .sort((a, b) => b.balance - a.balance)

  const creditors = balances
    .filter((b) => b.balance > 0.01)
    .sort((a, b) => b.balance - a.balance)

  const payments: Payment[] = []

  let i = 0
  let j = 0

  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].balance, creditors[j].balance)

    if (amount > 0.01) {
      payments.push({
        from: debtors[i].name,
        to: creditors[j].name,
        amount: Math.round(amount * 100) / 100,
      })
    }

    debtors[i].balance -= amount
    creditors[j].balance -= amount

    if (debtors[i].balance < 0.01) i++
    if (creditors[j].balance < 0.01) j++
  }

  return payments
}
