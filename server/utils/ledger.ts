
import { exec, one, q } from './db'
import { newId } from './ids'
import { splitMinorUnits } from '../../shared/utils/commission'

export const LEDGER_KINDS = ['sale', 'chargeback', 'adjustment'] as const
export type LedgerKind = typeof LEDGER_KINDS[number]

export const LEDGER_STATES = ['pending', 'transferred'] as const
export type LedgerState = typeof LEDGER_STATES[number]

export interface Payee {
  userId: string
  shareBps: number
}

// Who gets paid for one sold item, and in what proportion. A personal project
// is one payee at the whole amount; an organization's is however its owners
// divided it, snapshotted onto the ledger rows so a later reshuffle cannot
// rewrite what an old sale meant.
export async function payeesFor(item: {
  seller_user_id: string | null
  seller_org_id: string | null
}): Promise<Payee[]> {
  if (!item.seller_org_id) {
    return item.seller_user_id ? [{ userId: item.seller_user_id, shareBps: 10_000 }] : []
  }

  const rows = await q<{ user_id: string, share_bps: number }>(
    'SELECT user_id, share_bps FROM org_split WHERE org_id = $1 AND share_bps > 0 ORDER BY user_id',
    [item.seller_org_id],
  )

  if (!rows.length) return []
  return rows.map(row => ({ userId: row.user_id, shareBps: Number(row.share_bps) }))
}

// Written when a payment succeeds. Nothing moves yet: these sit as pending until
// the grace period is up, which is what the whole separate-transfer model is
// for.
//
// The unique index on (sale_item_id, user_id, kind) is what makes a second
// webhook delivery a no-op instead of paying somebody twice.
export async function recordSale(item: {
  id: string
  price_minor: number
  fee_minor: number
  seller_user_id: string | null
  seller_org_id: string | null
}): Promise<void> {
  const payees = await payeesFor(item)
  if (!payees.length) return

  const net = Number(item.price_minor) - Number(item.fee_minor)
  const amounts = splitMinorUnits(net, payees.map(p => p.shareBps))

  for (const [i, payee] of payees.entries()) {
    await exec(
      `INSERT INTO ledger_entry (id, user_id, sale_item_id, kind, state, share_bps,
                                 amount_minor, created)
       VALUES ($1, $2, $3, 'sale', 'pending', $4, $5, $6)
       ON CONFLICT (sale_item_id, user_id, kind) WHERE sale_item_id IS NOT NULL DO NOTHING`,
      [newId(), payee.userId, item.id, payee.shareBps, amounts[i] ?? 0, Date.now()],
    )
  }
}

// A loss lands on the platform first - Stripe debits our balance - and this is
// what puts it against the seller so later sales pay it back. A new negative row
// rather than an edit, because the sale still happened and the history has to
// keep saying so.
//
// It is written as pending, not transferred, and that is the whole recovery
// mechanism: what we owe somebody is the sum of their pending rows, so a debt
// simply sits there reducing it until later sales cover it. No separate debt
// column, no reconciliation pass.
export async function recordChargeback(item: {
  id: string
  price_minor: number
  fee_minor: number
  seller_user_id: string | null
  seller_org_id: string | null
}, note: string): Promise<void> {
  const entries = await q<{ user_id: string, amount_minor: string }>(
    `SELECT user_id, amount_minor FROM ledger_entry
     WHERE sale_item_id = $1 AND kind = 'sale'`,
    [item.id],
  )

  for (const entry of entries) {
    await exec(
      `INSERT INTO ledger_entry (id, user_id, sale_item_id, kind, state,
                                 amount_minor, note, created)
       VALUES ($1, $2, $3, 'chargeback', 'pending', $4, $5, $6)
       ON CONFLICT (sale_item_id, user_id, kind) WHERE sale_item_id IS NOT NULL DO NOTHING`,
      [newId(), entry.user_id, item.id, -Number(entry.amount_minor), note.slice(0, 500), Date.now()],
    )
  }
}

// A dispute the platform won gives the money back, so the debt raised when it
// opened has to go with it. Another row rather than a deletion: the dispute
// happened, and the ledger keeps saying so.
export async function reverseChargeback(saleItemId: string, disputeId: string): Promise<void> {
  const entries = await q<{ user_id: string, amount_minor: string }>(
    `SELECT user_id, amount_minor FROM ledger_entry
     WHERE sale_item_id = $1 AND kind = 'chargeback'`,
    [saleItemId],
  )

  for (const entry of entries) {
    await exec(
      `INSERT INTO ledger_entry (id, user_id, sale_item_id, kind, state,
                                 amount_minor, reference, note, created)
       VALUES ($1, $2, $3, 'adjustment', 'pending', $4, $5, 'dispute won', $6)
       ON CONFLICT (sale_item_id, user_id, kind) WHERE sale_item_id IS NOT NULL DO NOTHING`,
      [newId(), entry.user_id, saleItemId, -Number(entry.amount_minor), disputeId, Date.now()],
    )
  }
}

export interface Balance {
  pendingMinor: number
  transferredMinor: number
}

// Not a wallet. pending is what we still owe them - sales not yet moved, less
// any chargeback still being worked off - and transferred is what has already
// reached their Stripe account and is no longer ours to talk about.
//
// pendingMinor going negative is the seller owing us, and it is allowed to sit
// there: the next sale nets against it without anything having to remember.
export async function balanceOf(userId: string): Promise<Balance> {
  const rows = await q<{ state: string, total: string }>(
    `SELECT state, SUM(amount_minor)::bigint AS total
     FROM ledger_entry WHERE user_id = $1 GROUP BY state`,
    [userId],
  )

  const by = (state: string) =>
    Number(rows.find(row => row.state === state)?.total ?? 0)

  return { pendingMinor: by('pending'), transferredMinor: by('transferred') }
}

// What a transfer would move right now: every pending row they have, debts
// included. Nothing moves while this is zero or less.
export async function pendingDue(userId: string): Promise<number> {
  const row = await one<{ total: string }>(
    `SELECT COALESCE(SUM(amount_minor), 0)::bigint AS total FROM ledger_entry
     WHERE user_id = $1 AND state = 'pending'`,
    [userId],
  )

  return Number(row?.total ?? 0)
}

export async function pendingEntries(userId: string) {
  return await q<{ id: string, amount_minor: string }>(
    `SELECT id, amount_minor FROM ledger_entry
     WHERE user_id = $1 AND state = 'pending' ORDER BY created, id`,
    [userId],
  )
}

// Which pending rows one transfer can settle, and for how much.
//
// The cap exists because a transfer is tied to the charge that funded it, and
// Stripe will not let transfers against one charge add up to more than it. So
// rows are taken in order while they fit. Debts are always taken - they only
// ever reduce the total, and leaving one behind would mean paying out money the
// seller still owes.
//
// Rows are never split. What does not fit stays pending and goes out with the
// next sale's transfer.
export function settleable(
  entries: Array<{ id: string, amount_minor: string | number }>,
  capMinor: number,
): { amountMinor: number, entryIds: string[] } {
  const entryIds: string[] = []
  let amountMinor = 0

  for (const entry of entries) {
    const value = Number(entry.amount_minor)
    if (value < 0 || amountMinor + value <= capMinor) {
      entryIds.push(entry.id)
      amountMinor += value
    }
  }

  return { amountMinor, entryIds }
}

export async function pendingPayees(saleId: string): Promise<string[]> {
  const rows = await q<{ user_id: string }>(
    `SELECT DISTINCT l.user_id FROM ledger_entry l
     JOIN sale_item i ON i.id = l.sale_item_id
     WHERE i.sale_id = $1 AND l.state = 'pending' AND l.user_id IS NOT NULL`,
    [saleId],
  )

  return rows.map(row => row.user_id)
}

export async function markTransferred(
  entryIds: string[],
  transferId: string,
): Promise<void> {
  if (!entryIds.length) return

  await exec(
    `UPDATE ledger_entry SET state = 'transferred', transfer_id = $2, settled = $3
     WHERE id = ANY($1) AND state = 'pending'`,
    [entryIds, transferId, Date.now()],
  )
}

export async function ledgerFor(userId: string, limit = 200) {
  return await q<{
    id: string
    kind: string
    state: string
    amount_minor: string
    share_bps: number | null
    note: string
    created: string
    settled: string | null
    title: string | null
  }>(
    `SELECT l.id, l.kind, l.state, l.amount_minor, l.share_bps, l.note, l.created,
            l.settled, i.title
     FROM ledger_entry l
     LEFT JOIN sale_item i ON i.id = l.sale_item_id
     WHERE l.user_id = $1
     ORDER BY l.created DESC
     LIMIT $2`,
    [userId, limit],
  )
}
