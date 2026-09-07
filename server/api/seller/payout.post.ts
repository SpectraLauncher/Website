export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)
  const user = await requireUser(event)

  rateLimit(event, { key: `payout:${user.id}`, limit: 5, windowMs: 3_600_000 })

  const account = await connectedAccountFor(user.id)
  if (!account?.payouts_enabled) {
    throw createError({ statusCode: 409, statusMessage: 'this account cannot pay out yet' })
  }

  const { minPayoutMinor } = await transferSettings()
  const available = await availableOnAccount(account)

  const body = await readBody<{ amount?: unknown }>(event) ?? {}
  const amount = body.amount === undefined ? available : Math.floor(Number(body.amount))

  if (!Number.isFinite(amount) || amount < minPayoutMinor) {
    throw createError({ statusCode: 400, statusMessage: 'below the minimum payout' })
  }
  if (amount > available) {
    throw createError({ statusCode: 409, statusMessage: 'more than is available' })
  }

  return { payout: publicPayout(await requestPayout(user.id, account.stripe_account, amount)) }
})
