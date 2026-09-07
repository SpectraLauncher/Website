// Answers "is this rate worth it" before the rate changes, rather than after a
// month of sales. Admin only: it says nothing secret, but it is a tool for
// setting the commission, not something a seller needs.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const body = await readBody<{
    prices?: unknown
    mix?: unknown
    rateBps?: unknown
    minFeeMinor?: unknown
  }>(event) ?? {}

  const settings = await commissionSettings()

  const pricesMinor = (Array.isArray(body.prices) ? body.prices : [])
    .map(price => Math.round(Number(price)))
    .filter(price => Number.isFinite(price) && price > 0)
    .slice(0, 500)

  const mix = (body.mix && typeof body.mix === 'object')
    ? body.mix as Record<string, number>
    // The shape of a European store that has switched PayPal on.
    : { card: 0.7, cardInternational: 0.1, paypal: 0.2 }

  const rateBps = Number.isFinite(Number(body.rateBps))
    ? Math.max(0, Math.floor(Number(body.rateBps)))
    : settings.rateBps

  const minFeeMinor = Number.isFinite(Number(body.minFeeMinor))
    ? Math.max(0, Math.floor(Number(body.minFeeMinor)))
    : settings.minFeeMinor

  return {
    applied: { rateBps, minFeeMinor, mix },
    // Named so nobody reads the answer as a promise: Stripe's rates vary by
    // country and by agreement, and these are list prices.
    costs: METHOD_COSTS,
    result: simulate({ pricesMinor, mix, rateBps, minFeeMinor }),
  }
})
