export type Payment = {
  from: string
  to: string
  amount: number
}

export type Participant = {
  name: string
  amount: number
}

type Balance = { name: string; balance: number } // balance in integer cents

// People with a non-zero balance whose net debts can be partitioned into more
// zero-sum subgroups need fewer transfers. Finding the maximum number of such
// subgroups is exponential (subset DP over 2^m), so above this many non-zero
// balances we fall back to a single greedy pass. Real tables/trips are far
// smaller than this, so the optimal path is what runs in practice.
const OPTIMAL_MAX = 15

/**
 * Compute who pays whom to settle the table, using as FEW transfers as
 * possible.
 *
 * Everyone pays an equal share of the total. A person's balance is what they
 * paid minus their fair share: positive => they're owed money, negative =>
 * they owe. The set of balances always sums to zero.
 *
 * Minimizing the number of transfers is the "optimal account balancing"
 * problem. The minimum transfer count is
 *     (# of non-zero balances) - (max # of subgroups that each sum to zero)
 * because every zero-sum subgroup of k people can be settled internally with
 * exactly k-1 transfers, and a group with no zero-sum subset can't do better.
 * We find that maximum partition with a subset DP, then settle each subgroup
 * greedily.
 */
export function calculateSettlement(participants: Participant[]): Payment[] {
  if (participants.length < 2) return []

  // Work in integer cents so equality / zero-sum checks are exact. Floating
  // point can't reliably detect that a subset of debts cancels out.
  const cents = participants.map((p) => Math.round(p.amount * 100))
  const n = participants.length
  const totalCents = cents.reduce((sum, c) => sum + c, 0)

  // Fair share per person. The total rarely divides evenly, so distribute the
  // leftover cents deterministically (largest payers absorb one extra cent of
  // share each). This guarantees the shares sum to the total, hence balances
  // sum to exactly zero.
  const base = Math.floor(totalCents / n)
  const remainder = totalCents - base * n
  const shares = new Array<number>(n).fill(base)
  const byPaidDesc = participants
    .map((_, i) => i)
    .sort((a, b) => cents[b] - cents[a] || a - b)
  for (let k = 0; k < remainder; k++) shares[byPaidDesc[k]] += 1

  const nonZero: Balance[] = []
  for (let i = 0; i < n; i++) {
    const balance = cents[i] - shares[i]
    if (balance !== 0) nonZero.push({ name: participants[i].name, balance })
  }
  if (nonZero.length === 0) return []

  const groups =
    nonZero.length <= OPTIMAL_MAX ? partitionIntoZeroSumGroups(nonZero) : [nonZero]

  const payments: Payment[] = []
  for (const group of groups) settleGroup(group, payments)
  return payments
}

/**
 * Partition balances (which sum to zero) into the maximum number of subgroups
 * that each also sum to zero, via subset DP over bitmasks.
 *
 * dp[mask] = max number of zero-sum subgroups the people in `mask` split into.
 * Only zero-sum masks are reachable; for each we try every sub-subset that
 * contains the lowest set bit and itself sums to zero.
 */
function partitionIntoZeroSumGroups(balances: Balance[]): Balance[][] {
  const m = balances.length
  const size = 1 << m

  // Sum of each subset, built incrementally off the lowest set bit.
  const subsetSum = new Int32Array(size)
  for (let mask = 1; mask < size; mask++) {
    const low = mask & -mask
    const idx = 31 - Math.clz32(low)
    subsetSum[mask] = subsetSum[mask ^ low] + balances[idx].balance
  }

  const dp = new Int16Array(size).fill(-1) // -1 = not a zero-sum set
  const pick = new Int32Array(size) // chosen sub-subset, for reconstruction
  dp[0] = 0
  for (let mask = 1; mask < size; mask++) {
    if (subsetSum[mask] !== 0) continue // can't split a non-zero-sum set
    const low = mask & -mask
    let best = -1
    let bestSub = 0
    // Enumerate sub-subsets of `mask` that include `low` (fixing the lowest
    // bit avoids visiting each partition's groups in every order).
    for (let sub = mask; sub > 0; sub = (sub - 1) & mask) {
      if ((sub & low) === 0) continue
      if (subsetSum[sub] !== 0) continue
      const rest = dp[mask ^ sub]
      if (rest >= 0 && rest + 1 > best) {
        best = rest + 1
        bestSub = sub
      }
    }
    dp[mask] = best
    pick[mask] = bestSub
  }

  // Reconstruct the chosen groups from the full set.
  const groups: Balance[][] = []
  let mask = size - 1
  while (mask > 0) {
    const sub = pick[mask]
    const group: Balance[] = []
    for (let i = 0; i < m; i++) {
      if (sub & (1 << i)) group.push(balances[i])
    }
    groups.push(group)
    mask ^= sub
  }
  return groups
}

/**
 * Settle one zero-sum group greedily: repeatedly have the biggest debtor pay
 * the biggest creditor. For a group with no zero-sum subset this yields the
 * minimum k-1 transfers; balances are integer cents so it ends exactly at zero.
 */
function settleGroup(group: Balance[], out: Payment[]): void {
  const debtors = group
    .filter((b) => b.balance < 0)
    .map((b) => ({ name: b.name, amount: -b.balance }))
    .sort((a, b) => b.amount - a.amount)
  const creditors = group
    .filter((b) => b.balance > 0)
    .map((b) => ({ name: b.name, amount: b.balance }))
    .sort((a, b) => b.amount - a.amount)

  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].amount, creditors[j].amount)
    out.push({
      from: debtors[i].name,
      to: creditors[j].name,
      amount: amount / 100,
    })
    debtors[i].amount -= amount
    creditors[j].amount -= amount
    if (debtors[i].amount === 0) i++
    if (creditors[j].amount === 0) j++
  }
}
