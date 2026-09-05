
import { exec, one, q } from './db'
import { newId } from './ids'

// A ledger, not a balance column. Money that only exists as a number nobody can
// explain is money nobody can argue about, and every payout dispute is an
// argument about how a number was reached.
//
// Every row is an immutable fact. A balance is the sum of the rows, always
// recomputed, never stored.
export const LEDGER_KINDS = ['sale', 'commission', 'refund', 'payout', 'adjustment'] as const
export type LedgerKind = typeof LEDGER_KINDS[number]

export const PAYOUT_STATUSES = ['requested', 'processing', 'paid', 'failed', 'cancelled'] as const
export type PayoutStatus = typeof PAYOUT_STATUSES[number]

// Below this a transfer costs more in fees than it moves.
export const MIN_PAYOUT_MINOR = 1000

export interface LedgerRow {
  id: string
  seller_id: string
  kind: string
  amount: string | number
  currency: string
  reference: string | null
  note: string
  created: string | number
}

export function isLedgerKind(value: unknown): value is LedgerKind {
  return LEDGER_KINDS.includes(value as LedgerKind)
}

export function isPayoutStatus(value: unknown): value is PayoutStatus {
  return PAYOUT_STATUSES.includes(value as PayoutStatus)
}

// Signed amounts: what the seller earned is positive, what left is negative.
// Summing the column is then the whole of the arithmetic.
export function recordEntry(input: {
  sellerId: string
  kind: LedgerKind
  amount: number
  currency: string
  reference?: string | null
  note?: string
}) {
  return exec(
    `INSERT INTO payout_ledger (id, seller_id, kind, amount, currency, reference, note, created)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (seller_id, kind, reference) WHERE reference IS NOT NULL DO NOTHING`,
    [
      newId(),
      input.sellerId,
      input.kind,
      Math.round(input.amount),
      input.currency.toLowerCase(),
      input.reference ?? null,
      (input.note ?? '').slice(0, 500),
      Date.now(),
    ],
  )
}

// A sale writes two rows, not one: what the buyer paid and what the platform
// took. A single net row would make the commission unauditable.
export async function recordSale(input: {
  sellerId: string
  purchaseId: string
  gross: number
  fee: number
  currency: string
}) {
  await recordEntry({
    sellerId: input.sellerId,
    kind: 'sale',
    amount: input.gross,
    currency: input.currency,
    reference: input.purchaseId,
  })

  if (input.fee > 0) {
    await recordEntry({
      sellerId: input.sellerId,
      kind: 'commission',
      amount: -input.fee,
      currency: input.currency,
      reference: input.purchaseId,
    })
  }
}

export interface Balance {
  currency: string
  earned: number
  commission: number
  paidOut: number
  available: number
}

export async function balances(sellerIds: string[]): Promise<Balance[]> {
  if (!sellerIds.length) return []

  const rows = await q<{ currency: string, kind: string, total: string }>(
    `SELECT currency, kind, SUM(amount)::bigint AS total
     FROM payout_ledger WHERE seller_id = ANY($1)
     GROUP BY currency, kind`,
    [sellerIds],
  )

  const byCurrency = new Map<string, Balance>()

  for (const row of rows) {
    const balance = byCurrency.get(row.currency)
      ?? { currency: row.currency, earned: 0, commission: 0, paidOut: 0, available: 0 }

    const amount = Number(row.total)
    if (row.kind === 'sale') balance.earned += amount
    if (row.kind === 'commission') balance.commission += amount
    if (row.kind === 'payout') balance.paidOut += amount
    if (row.kind === 'refund' || row.kind === 'adjustment') balance.earned += amount

    balance.available += amount
    byCurrency.set(row.currency, balance)
  }

  return [...byCurrency.values()]
}

export async function ledgerFor(sellerIds: string[], limit = 200): Promise<LedgerRow[]> {
  if (!sellerIds.length) return []

  return await q<LedgerRow>(
    `SELECT id, seller_id, kind, amount, currency, reference, note, created
     FROM payout_ledger WHERE seller_id = ANY($1)
     ORDER BY created DESC LIMIT $2`,
    [sellerIds, limit],
  )
}

export interface PayoutRow {
  id: string
  seller_id: string
  amount: string | number
  currency: string
  status: string
  note: string
  requested: string | number
  settled: string | number | null
}

export async function requestPayout(input: {
  sellerId: string
  currency: string
  amount: number
}): Promise<PayoutRow> {
  const currency = input.currency.toLowerCase()
  const amount = Math.round(input.amount)

  if (amount < MIN_PAYOUT_MINOR) {
    throw createError({ statusCode: 400, statusMessage: 'below the minimum payout' })
  }

  // The balance is read at the moment of the request and the payout is written
  // as a negative entry in the same breath, so two requests cannot both be
  // approved against the same money.
  const balance = (await balances([input.sellerId])).find(b => b.currency === currency)
  if (!balance || balance.available < amount) {
    throw createError({ statusCode: 409, statusMessage: 'not enough available' })
  }

  const id = newId()
  await exec(
    `INSERT INTO payout (id, seller_id, amount, currency, status, requested)
     VALUES ($1, $2, $3, $4, 'requested', $5)`,
    [id, input.sellerId, amount, currency, Date.now()],
  )

  await recordEntry({
    sellerId: input.sellerId,
    kind: 'payout',
    amount: -amount,
    currency,
    reference: id,
    note: 'payout requested',
  })

  return (await payoutById(id))!
}

export async function payoutById(id: string): Promise<PayoutRow | undefined> {
  return await one<PayoutRow>(
    `SELECT id, seller_id, amount, currency, status, note, requested, settled
     FROM payout WHERE id = $1`,
    [id],
  )
}

export async function payoutsFor(sellerIds: string[]): Promise<PayoutRow[]> {
  if (!sellerIds.length) return []

  return await q<PayoutRow>(
    `SELECT id, seller_id, amount, currency, status, note, requested, settled
     FROM payout WHERE seller_id = ANY($1) ORDER BY requested DESC`,
    [sellerIds],
  )
}

// A failed or cancelled payout puts the money back. The reversal is its own
// row rather than a deletion, so the ledger still shows what was attempted.
export async function settlePayout(id: string, status: PayoutStatus, note = ''): Promise<PayoutRow> {
  const payout = await payoutById(id)
  if (!payout) throw createError({ statusCode: 404, statusMessage: 'no such payout' })

  await exec(
    'UPDATE payout SET status = $2, note = $3, settled = $4 WHERE id = $1',
    [id, status, note.slice(0, 500), Date.now()],
  )

  if (status === 'failed' || status === 'cancelled') {
    await recordEntry({
      sellerId: payout.seller_id,
      kind: 'adjustment',
      amount: Number(payout.amount),
      currency: payout.currency,
      reference: `reverse:${id}`,
      note: `payout ${status}`,
    })
  }

  return (await payoutById(id))!
}

export function publicPayout(row: PayoutRow) {
  return {
    id: row.id,
    amount: Number(row.amount),
    currency: row.currency,
    status: row.status,
    note: row.note,
    requested: Number(row.requested),
    settled: row.settled === null ? null : Number(row.settled),
  }
}

export function publicLedgerEntry(row: LedgerRow) {
  return {
    id: row.id,
    kind: row.kind,
    amount: Number(row.amount),
    currency: row.currency,
    reference: row.reference,
    note: row.note,
    created: Number(row.created),
  }
}
