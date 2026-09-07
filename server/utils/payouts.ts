
import { exec, one, q } from './db'
import type { ConnectedAccountRow } from './connect'
import { newId } from './ids'
import { requireStripe, stripeCall } from './stripe'
import { CURRENCY } from '../../shared/utils/catalog-types'

// Read from Stripe rather than from our own ledger, and deliberately. Once a
// transfer lands, the money is on their account and Stripe is the one counting
// it - reserves, refunds and its own timing all move that number in ways our
// rows never see.
export async function availableOnAccount(account: ConnectedAccountRow): Promise<number> {
  const stripe = requireStripe()

  const balance = await stripeCall(() => stripe.balance.retrieve(
    {}, { stripeAccount: account.stripe_account }))

  const euro = balance.available.find(entry => entry.currency === CURRENCY)
  return Math.max(0, euro?.amount ?? 0)
}

export interface PayoutRow {
  id: string
  user_id: string
  payout_id: string | null
  amount_minor: string | number
  status: string
  note: string
  requested: string | number
  settled: string | number | null
}

// Payouts are manual, so this is the seller pressing the button rather than a
// schedule. Recorded before the call and updated after, so a payout Stripe
// accepted but we failed to note still leaves a trace to reconcile from.
export async function requestPayout(
  userId: string,
  stripeAccount: string,
  amountMinor: number,
): Promise<PayoutRow> {
  const id = newId()

  await exec(
    `INSERT INTO payout_request (id, user_id, amount_minor, status, requested)
     VALUES ($1, $2, $3, 'requested', $4)`,
    [id, userId, amountMinor, Date.now()],
  )

  try {
    const payout = await stripeCall(() => requireStripe().payouts.create(
      { amount: amountMinor, currency: CURRENCY, metadata: { userId } },
      { stripeAccount },
    ))

    await exec(
      `UPDATE payout_request SET payout_id = $2, status = $3 WHERE id = $1`,
      [id, payout.id, payout.status === 'failed' ? 'failed' : 'paid'],
    )
  }
  catch (e) {
    await exec(
      `UPDATE payout_request SET status = 'failed', note = $2, settled = $3 WHERE id = $1`,
      [id, String((e as Error)?.message ?? e).slice(0, 500), Date.now()],
    )
    throw e
  }

  return (await payoutById(id))!
}

export async function payoutById(id: string): Promise<PayoutRow | undefined> {
  return await one<PayoutRow>(
    `SELECT id, user_id, payout_id, amount_minor, status, note, requested, settled
     FROM payout_request WHERE id = $1`,
    [id],
  )
}

export async function payoutsFor(userId: string): Promise<PayoutRow[]> {
  return await q<PayoutRow>(
    `SELECT id, user_id, payout_id, amount_minor, status, note, requested, settled
     FROM payout_request WHERE user_id = $1 ORDER BY requested DESC LIMIT 100`,
    [userId],
  )
}

export function publicPayout(row: PayoutRow) {
  return {
    id: row.id,
    amountMinor: Number(row.amount_minor),
    status: row.status,
    note: row.note,
    requested: Number(row.requested),
    settled: row.settled === null ? null : Number(row.settled),
  }
}
