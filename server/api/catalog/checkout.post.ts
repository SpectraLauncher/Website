export default defineEventHandler(async (event) => {
  const viewer = await requireCatalogRead(event)

  rateLimit(event, {
    key: `checkout:${viewer?.id ?? getRequestIP(event, { xForwardedFor: true }) ?? 'anon'}`,
    limit: 20,
    windowMs: 60_000,
  })

  const body = await readBody<{ items?: unknown, consent?: unknown, email?: unknown }>(event) ?? {}

  // An EU buyer keeps the right to withdraw from a digital purchase unless they
  // waive it before delivery. No waiver, no payment - refusing here is the whole
  // reason the checkbox exists, and defaulting it to checked would make the
  // waiver worthless.
  if (body.consent !== true) {
    throw createError({ statusCode: 400, statusMessage: 'the delivery consent has to be given' })
  }

  // A guest has no account to put the files in, so the address is the only way
  // to reach them afterwards. It is not optional for them, and it is not asked
  // of somebody already signed in.
  const email = viewer?.email ?? readEmail(body.email)

  const cart = await priceCart(viewer, body.items, await commissionSettings())
  if (!cart.lines.length) {
    throw createError({ statusCode: 400, statusMessage: 'nothing to buy' })
  }

  const stripe = requireStripe()

  // Written first, on purpose. If the intent were created before the sale, a
  // failure in between would leave Stripe holding a charge that nothing here
  // records - the one failure that costs somebody money. This way the worst case
  // is a pending row nobody uses.
  const { saleId } = await openSale({
    buyerId: viewer?.id ?? null,
    buyerEmail: email,
    cart,
    consentAt: Date.now(),
  })

  const intent = await stripeCall(() => stripe.paymentIntents.create({
    amount: cart.totalMinor,
    currency: CURRENCY,
    receipt_email: email,
    // The charge lands on the platform account and is transferred onwards after
    // the grace period, so there is no transfer_data here and no destination.
    automatic_payment_methods: { enabled: true },
    metadata: { saleId, buyerId: viewer?.id ?? '' },
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

function readEmail(value: unknown): string {
  const email = String(value ?? '').trim().toLowerCase()

  // Deliberately loose. The address only has to be somewhere a receipt can go,
  // and a stricter pattern rejects real addresses more often than it catches
  // typos - which a confirmation mail catches anyway.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
    throw createError({ statusCode: 400, statusMessage: 'a valid email is needed for the receipt' })
  }

  return email
}
