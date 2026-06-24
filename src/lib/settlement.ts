export type Payment = {
  from: string
  to: string
  amount: number
}

export type Participant = {
  name: string
  amount: number
}

export type SettlementOptions = {
  /**
   * Transfers strictly below this amount (in the same units as `amount`) are
   * dropped instead of shown. Splits stay exact — we just don't bother with
   * trivial payments. A person left out of one such transfer ends up under
   * `minTransfer` from settled (up to ~2x that in the rare case both of their
   * transactions were tiny). Set to 0 for an exact, fully-reconciling result.
   */
  minTransfer?: number
}

// Don't bother with sub-unit payments by default ("keep the change"). Tunable
// per call; pass { minTransfer: 0 } for an exact settlement.
const DEFAULT_MIN_TRANSFER = 1

type Balance = { name: string; balance: number } // balance in integer cents

// People with a non-zero balance whose net debts can be partitioned into more
// zero-sum subgroups need fewer transfers. Finding the maximum number of such
// subgroups is exponential (subset DP over 2^m), so above this many non-zero
// balances we fall back to a single greedy pass. Real tables/trips are far
// smaller than this, so the optimal path is what runs in practice.
const OPTIMAL_MAX = 15

/**
 * Compute who pays whom to settle the table, minimizing how many transactions
 * each person has to make.
 *
 * Everyone pays an equal share of the total. A person's balance is what they
 * paid minus their fair share: positive => they're owed money, negative =>
 * they owe. Balances always sum to zero.
 *
 * Strategy:
 *  1. Partition the non-zero balances into the maximum number of zero-sum
 *     subgroups (subset DP). This keeps the total number of transfers minimal
 *     and isolates people who happen to cancel out into their own small group.
 *  2. Settle each subgroup as a *chain* (money relays along a path) rather than
 *     routing everyone through one person. In a chain every participant is in
 *     at most TWO transactions — the provable minimum for a group that can't be
 *     split further — instead of one person becoming a hub with many.
 *  3. Drop transfers below `minTransfer` so trivial payments don't show up.
 *
 * Note: chain settling means money can pass *through* a person (they receive
 * from one neighbour and forward it to the next), so a transfer amount can
 * exceed that person's own debt. That's the cost of keeping everyone's
 * transaction count down.
 */
export function calculateSettlement(
  participants: Participant[],
  options: SettlementOptions = {}
): Payment[] {
  if (participants.length < 2) return []

  const minTransferCents = Math.round((options.minTransfer ?? DEFAULT_MIN_TRANSFER) * 100)

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
  for (const group of groups) settleGroupAsChain(group, payments)

  // Drop trivial transfers (splits stay exact; we just don't list tiny ones).
  return minTransferCents > 0
    ? payments.filter((p) => Math.round(p.amount * 100) >= minTransferCents)
    : payments
}

/**
 * Partition balances (which sum to zero) into the maximum number of subgroups
 * that each also sum to zero, via subset DP over bitmasks.
 *
 * dp[mask] = max number of zero-sum subgroups the people in `mask` split into.
 * Only zero-sum masks are reachable; for each we try every sub-subset that
 * contains the lowest set bit and itself sums to zero. Because the partition is
 * maximal, no resulting group has a zero-sum proper subset (it's "atomic"), so
 * a chain settles it in exactly size-1 transfers with max degree 2.
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
 * Settle one zero-sum group as a chain so nobody becomes a hub.
 *
 * People are interleaved (creditor, debtor, creditor, …) to keep the running
 * carry small, then each person passes their accumulated imbalance to the next.
 * Each person transacts only with their two neighbours => at most 2 payments
 * each; the endpoints get just 1. Balances are integer cents so it ends exactly
 * at zero.
 */
function settleGroupAsChain(group: Balance[], out: Payment[]): void {
  const creditors = group.filter((b) => b.balance > 0).sort((a, b) => b.balance - a.balance)
  const debtors = group.filter((b) => b.balance < 0).sort((a, b) => a.balance - b.balance)

  // Interleave to keep the relayed amounts as small as possible.
  const order: Balance[] = []
  let ci = 0
  let di = 0
  let takeCreditor = true
  while (ci < creditors.length || di < debtors.length) {
    if (takeCreditor && ci < creditors.length) order.push(creditors[ci++])
    else if (di < debtors.length) order.push(debtors[di++])
    else order.push(creditors[ci++])
    takeCreditor = !takeCreditor
  }

  let carry = 0
  for (let i = 0; i < order.length - 1; i++) {
    const amount = order[i].balance + carry
    if (amount > 0) {
      // order[i] is net owed `amount` => the next person pays them.
      out.push({ from: order[i + 1].name, to: order[i].name, amount: amount / 100 })
    } else if (amount < 0) {
      // order[i] net owes `-amount` => they pay the next person.
      out.push({ from: order[i].name, to: order[i + 1].name, amount: -amount / 100 })
    }
    carry = amount
  }
}
