
export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)
  const user = await requireUser(event)

  const ids = await sellerIdsFor(user)

  return {
    balances: await balances(ids),
    entries: (await ledgerFor(ids)).map(publicLedgerEntry),
    payouts: (await payoutsFor(ids)).map(publicPayout),
    minimum: MIN_PAYOUT_MINOR,
  }
})
