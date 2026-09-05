
export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)
  const user = await requireUser(event)

  rateLimit(event, { key: `payout:${user.id}`, limit: 5, windowMs: 3_600_000 })

  const body = await readBody<{ sellerId?: unknown, currency?: unknown, amount?: unknown }>(event) ?? {}

  // The seller has to be one this account actually controls, or a payout could
  // be requested out of somebody else's balance.
  const ids = await sellerIdsFor(user)
  const sellerId = String(body.sellerId ?? ids[0] ?? '')
  if (!ids.includes(sellerId)) {
    throw createError({ statusCode: 404, statusMessage: 'no such seller account' })
  }

  const payout = await requestPayout({
    sellerId,
    currency: String(body.currency ?? 'eur'),
    amount: Number(body.amount),
  })

  return { payout: publicPayout(payout) }
})
