export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)
  const buyer = await requireUser(event)

  rateLimit(event, { key: `buy:${buyer.id}`, limit: 20, windowMs: 60_000 })

  const project = await projectByIdOrSlug(String(getRouterParam(event, 'slug') ?? ''))
  if (!await visibleProject(project, buyer)) {
    throw createError({ statusCode: 404, statusMessage: 'no such project' })
  }

  const price = Number(project!.price ?? 0)
  if (!price) throw createError({ statusCode: 400, statusMessage: 'this project is free' })

  if (await hasPurchased(buyer.id, project!.id)) {
    throw createError({ statusCode: 409, statusMessage: 'you already own this' })
  }

  const stripe = requireStripe()

  // An attempt already under way is resumed rather than duplicated. Paying twice
  // for one project is money taken that no entitlement would record.
  const pending = await pendingPurchase(buyer.id, project!.id)
  if (pending?.session_id) {
    const existing = await stripe.checkout.sessions.retrieve(pending.session_id)
      .catch(() => null)

    if (existing?.status === 'open' && existing.url) return { url: existing.url }
    await failPurchase(pending.session_id)
  }

  const seller = await sellerFor(project!.owner_id, project!.org_id)
  if (!canSell(seller)) {
    throw createError({ statusCode: 409, statusMessage: 'this seller cannot take payments yet' })
  }

  const standing = await sellerStanding(project!.owner_id, project!.org_id)
  const fee = commissionMinorUnits(price, standing)

  const site = String(useRuntimeConfig().public.siteUrl).replace(/\/$/, '')
  const currency = String(project!.currency ?? 'eur').toLowerCase()

  const session = await stripeCall(() => stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: buyer.email,
    line_items: [{
      quantity: 1,
      price_data: {
        currency,
        unit_amount: price,
        product_data: { name: project!.title, description: project!.summary || undefined },
      },
    }],
    // A destination charge: the money lands on the seller's connected account
    // and only the commission stays here.
    payment_intent_data: {
      application_fee_amount: fee,
      transfer_data: { destination: seller!.stripe_account },
    },
    success_url: `${site}${projectPath(project!.type, project!.slug)}?bought=1`,
    cancel_url: `${site}${projectPath(project!.type, project!.slug)}`,
    metadata: { projectId: project!.id, buyerId: buyer.id },
  }))

  await openPurchase({
    buyerId: buyer.id,
    projectId: project!.id,
    sellerId: seller!.id,
    amount: price,
    currency,
    standing,
    sessionId: session.id,
  })

  return { url: session.url }
})
