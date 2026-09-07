
import { one } from './db'
import { canReceive, connectedAccountFor } from './connect'
import { markTransferred, pendingEntries, pendingPayees, settleable } from './ledger'
import { requireStripe, stripeCall } from './stripe'
import { CURRENCY } from '../../shared/utils/catalog-types'

// Runs once a sale's grace period is up. It settles everything a payee has
// waiting, not only this sale's share, because their pending rows are one pot
// and a chargeback sitting in it as a negative is how the debt gets worked off
// before anything leaves.
export async function transferForSale(saleId: string): Promise<void> {
  const sale = await one<{ id: string, status: string, charge_id: string | null, total_minor: number }>(
    'SELECT id, status, charge_id, total_minor FROM sale WHERE id = $1', [saleId])

  // Disputed or refunded between the sale and the grace period expiring. The
  // ledger already carries the reversal, so there is nothing to send.
  if (!sale || sale.status !== 'paid') return

  for (const userId of await pendingPayees(saleId)) {
    await transferTo(userId, sale.charge_id, Number(sale.total_minor))
  }
}

export async function transferTo(
  userId: string,
  chargeId: string | null,
  capMinor: number,
): Promise<void> {
  const account = await connectedAccountFor(userId)

  // Deferred onboarding. The money stays pending and visibly owed until they
  // have an account that can take it - which is the promise the seller page
  // makes, so it must not quietly disappear here.
  if (!canReceive(account)) return

  const { amountMinor, entryIds } = settleable(await pendingEntries(userId), capMinor)

  // Zero or less means a debt still outweighs what has been earned. Nothing is
  // settled: the rows stay pending and the next sale nets against them.
  if (amountMinor <= 0 || !entryIds.length) return

  const stripe = requireStripe()

  const transfer = await stripeCall(() => stripe.transfers.create({
    amount: amountMinor,
    currency: CURRENCY,
    destination: account!.stripe_account,
    // Ties the transfer to the charge that funded it, so Stripe waits for those
    // funds to settle rather than refusing against a balance we may not have
    // yet. It cannot be set afterwards, which is why the charge is kept on the
    // sale in the first place.
    ...(chargeId ? { source_transaction: chargeId } : {}),
    metadata: { userId },
  }))

  await markTransferred(entryIds, transfer.id)
}
