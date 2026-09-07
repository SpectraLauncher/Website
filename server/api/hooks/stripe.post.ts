import type Stripe from 'stripe'

export default defineEventHandler(async (event) => {
  const stripe = useStripe()
  const secret = stripeWebhookSecret()

  // No signature check possible means no webhook. Accepting unverified calls
  // here would let anyone mark any sale as paid.
  if (!stripe || !secret) {
    throw createError({ statusCode: 404, statusMessage: 'not found' })
  }

  const signature = getHeader(event, 'stripe-signature')
  const raw = await readRawBody(event, false)
  if (!signature || !raw?.length) {
    throw createError({ statusCode: 400, statusMessage: 'missing signature' })
  }

  let parsed: Stripe.Event
  try {
    parsed = stripe.webhooks.constructEvent(raw, signature, secret)
  }
  catch {
    throw createError({ statusCode: 400, statusMessage: 'bad signature' })
  }

  // Recorded before it is acted on, and only a delivery that was already handled
  // to completion is skipped. Stopping at "we have seen this id" would be wrong:
  // an event that failed halfway is exactly the one Stripe redelivers, and it
  // still has work left.
  //
  // Two deliveries arriving at once can therefore both run. That is what the
  // unique index on the ledger and the conflict clause on entitlements are for -
  // this check saves the work, those two make it safe.
  const fresh = await recordEvent({ id: parsed.id, type: parsed.type, payload: parsed })
  if (!fresh && await wasProcessed(parsed.id)) return { received: true, duplicate: true }

  try {
    await handleStripeEvent(parsed)
    await markProcessed(parsed.id)
  }
  catch (e) {
    await markFailed(parsed.id, e)
    console.error('[stripe] event failed', parsed.type, parsed.id, e)

    // Stripe retries on a non-2xx, and the row above is what stops the retry
    // from doing the work twice once it eventually succeeds.
    throw createError({ statusCode: 500, statusMessage: 'event not processed' })
  }

  return { received: true }
})
