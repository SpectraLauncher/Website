export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)
  const user = await requireUser(event)

  const balance = await balanceOf(user.id)
  const account = await connectedAccountFor(user.id)
  const { minPayoutMinor } = await transferSettings()

  return {
    balance,
    // What Stripe holds for them, which is the only figure a payout can be
    // drawn against. Our ledger stops at the transfer; after that the money is
    // theirs and Stripe is the one counting it.
    available: account && canReceive(account) ? await availableOnAccount(account) : 0,
    minimum: minPayoutMinor,
    payouts: (await payoutsFor(user.id)).map(publicPayout),
    entries: (await ledgerFor(user.id)).map(entry => ({
      id: entry.id,
      kind: entry.kind,
      state: entry.state,
      amountMinor: Number(entry.amount_minor),
      shareBps: entry.share_bps,
      title: entry.title,
      note: entry.note,
      created: Number(entry.created),
      settled: entry.settled === null ? null : Number(entry.settled),
    })),
  }
})
