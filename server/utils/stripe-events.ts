
import type Stripe from 'stripe'

import { exec, one } from './db'
import { transferSettings } from './commission'
import { connectedAccountByStripeId, refreshAccount } from './connect'
import { itemsOfSale, saleById, saleByIntent } from './checkout'
import { grantEntitlement, revokeEntitlement } from './entitlement'
import { sendReceipt } from './receipt'
import { recordChargeback, recordSale } from './ledger'
import { enqueue } from './queue'

const DAY_MS = 86_400_000

// One place that knows what each Stripe event means here. Anything not listed is
// deliberately ignored rather than treated as an error: Stripe sends far more
// than this integration asked for, and a 500 on an event nobody wants would have
// it redelivered for days.
export async function handleStripeEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case 'payment_intent.succeeded':
      return await paymentSucceeded(event.data.object)

    case 'payment_intent.payment_failed':
    case 'payment_intent.canceled':
      return await paymentFailed(event.data.object)

    case 'charge.dispute.created':
      return await disputeOpened(event.data.object)

    case 'charge.dispute.closed':
      return await disputeClosed(event.data.object)

    case 'account.updated':
      return await accountUpdated(event.data.object as { id?: string })
  }
}

// The sale is found by the id in the intent's metadata first. The intent_id
// column is written a moment after the intent is created, so a webhook that
// overtakes that write would otherwise find nothing.
async function saleFor(intent: Stripe.PaymentIntent) {
  const fromMetadata = String(intent.metadata?.saleId ?? '')
  if (fromMetadata) {
    const found = await saleById(fromMetadata)
    if (found) return found
  }

  return await saleByIntent(intent.id)
}

async function paymentSucceeded(intent: Stripe.PaymentIntent): Promise<void> {
  const sale = await saleFor(intent)
  if (!sale) {
    console.error('[stripe] paid intent with no sale', intent.id)
    return
  }

  const charge = typeof intent.latest_charge === 'string'
    ? intent.latest_charge
    : intent.latest_charge?.id ?? null

  // Only the delivery that actually moves the row does the rest. A second one
  // finds nothing pending and stops, which is the same guard the ledger's unique
  // index provides underneath.
  const moved = await exec(
    `UPDATE sale SET status = 'paid', charge_id = $2, intent_id = COALESCE(intent_id, $3),
                     paid = $4
     WHERE id = $1 AND status = 'pending'`,
    [sale.id, charge, intent.id, Date.now()],
  )

  const items = await itemsOfSale(sale.id)

  // Delivery is not the seller's grace period. The buyer paid, so the download
  // opens now, whatever is still waiting to move between accounts.
  //
  // Only for somebody with an account: a guest has nothing to hang an
  // entitlement on, and their access is the token on the sale instead.
  if (sale.buyer_id) {
    for (const item of items) {
      if (item.project_id) {
        await grantEntitlement({
          userId: sale.buyer_id,
          projectId: item.project_id,
          saleItemId: item.id,
        })
      }
    }
  }

  if (!moved) return

  // Sent once, from the delivery that actually moved the row. For a guest this
  // is the only copy of their purchase they will ever have, so a failure here
  // must not take the rest of the handler down with it.
  await sendReceipt(await saleById(sale.id) ?? sale)
    .catch(e => console.error('[receipt] could not send', sale.id, e))

  for (const item of items) await recordSale(item)

  const { graceDays } = await transferSettings()
  await enqueue('transfer', { saleId: sale.id }, Date.now() + graceDays * DAY_MS)
}

async function paymentFailed(intent: Stripe.PaymentIntent): Promise<void> {
  const sale = await saleFor(intent)
  if (!sale) return

  await exec(
    `UPDATE sale SET status = 'failed' WHERE id = $1 AND status = 'pending'`,
    [sale.id],
  )
}

async function saleForCharge(charge: string | null) {
  if (!charge) return undefined
  return await one<{ id: string, buyer_id: string | null, status: string }>(
    'SELECT id, buyer_id, status FROM sale WHERE charge_id = $1', [charge])
}

// The money is already gone from the platform balance by the time this arrives -
// Stripe debits it and adds its own fee. Taking the download back and putting
// the amount against the seller is all that is left to decide.
async function disputeOpened(dispute: Stripe.Dispute): Promise<void> {
  const charge = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id ?? null
  const sale = await saleForCharge(charge)
  if (!sale) return

  await exec(`UPDATE sale SET status = 'disputed' WHERE id = $1`, [sale.id])

  for (const item of await itemsOfSale(sale.id)) {
    await recordChargeback(item, `dispute ${dispute.id}`)
    // A guest has no entitlement row to revoke; their access dies with the
    // sale's status, which the token check reads.
    if (item.project_id && sale.buyer_id) {
      await revokeEntitlement(sale.buyer_id, item.project_id)
    }
  }
}

// Won disputes give the money back, so the debt raised when it opened has to go
// with it. The reversal is another row rather than a deletion: the dispute
// happened, and the ledger keeps saying so.
async function disputeClosed(dispute: Stripe.Dispute): Promise<void> {
  if (dispute.status !== 'won') return

  const charge = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id ?? null
  const sale = await saleForCharge(charge)
  if (!sale) return

  await exec(`UPDATE sale SET status = 'paid' WHERE id = $1 AND status = 'disputed'`, [sale.id])

  for (const item of await itemsOfSale(sale.id)) {
    // Cancels the debt where it sits. The chargeback row is pending, so its
    // reversal has to be pending too, or the seller would keep owing a sum that
    // has already been given back.
    await reverseChargeback(item.id, dispute.id)

    if (item.project_id && sale.buyer_id) {
      await exec(
        `UPDATE entitlement SET revoked = NULL
         WHERE user_id = $1 AND project_id = $2`,
        [sale.buyer_id, item.project_id],
      )
    }
  }
}

async function accountUpdated(account: { id?: string }): Promise<void> {
  const id = String(account?.id ?? '')
  if (!id) return

  const row = await connectedAccountByStripeId(id)
  if (row) await refreshAccount(row)
}
