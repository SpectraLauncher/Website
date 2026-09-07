export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)
  const user = await requireUser(event)

  rateLimit(event, { key: `checkout:${user.id}`, limit: 20, windowMs: 60_000 })

  const body = await readBody<{ items?: unknown, consent?: unknown }>(event) ?? {}

  // An EU buyer keeps the right to withdraw from a digital purchase unless they
  // waive it before delivery. No waiver, no payment - refusing here is the whole
  // reason the checkbox exists, and defaulting it to checked would make the
  // waiver worthless.
  if (body.consent !== true) {
    throw createError({ statusCode: 400, statusMessage: 'the delivery consent has to be given' })
  }

  const cart = await priceCart(user, body.items, await commissionSettings())
  if (!cart.lines.length) {
    throw createError({ statusCode: 400, statusMessage: 'nothing to buy' })
  }

  const stripe = requireStripe()

  // Written first, on purpose. If the intent were created before the sale, a
  // failure in between would leave Stripe holding a charge that nothing here
  // records - the one failure that costs somebody money. This way the worst case
  // is a pending row nobody uses.
  const saleId = await openSale({ buyerId: user.id, cart, consentAt: Date.now() })

  const intent = await stripeCall(() => stripe.paymentIntents.create({
    amount: cart.totalMinor,
    currency: CURRENCY,
    // The charge lands on the platform account and is transferred onwards after
    // the grace period, so there is no transfer_data here and no destination.
    automatic_payment_methods: { enabled: true },
    metadata: { saleId, buyerId: user.id },
    // Groups this payment with the transfers made against it later.
    transfer_group: saleId,
  }))

  await attachIntent(saleId, intent.id)

  return {
    saleId,
    clientSecret: intent.client_secret,
    totalMinor: cart.totalMinor,
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
  }
})
