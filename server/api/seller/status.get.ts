export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)
  const user = await requireUser(event)

  const account = await connectedAccountFor(user.id)

  // Only chased while something is still missing. Once transfers are on, the
  // account.updated webhook is what keeps this row honest, and polling Stripe on
  // every page view would buy nothing.
  const synced = account && !account.transfers_enabled
    ? await refreshAccount(account).catch(() => account)
    : account

  return {
    account: publicAccount(synced),
    countries: TRANSFER_COUNTRIES,
    configured: Boolean(useStripe() && useRuntimeConfig().public.stripeKey),
  }
})
