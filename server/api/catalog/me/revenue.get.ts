export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)
  const user = await requireUser(event)

  const orgs = await organizationsOf(user.id)
  const sellers = [
    await sellerFor(user.id, null),
    ...await Promise.all(orgs.filter(o => o.role === 'owner').map(o => sellerFor(null, o.id))),
  ].filter(Boolean)

  const sales = await salesFor(sellers.map(s => s!.id))
  const standing = { partner: Boolean((user as { partner?: boolean }).partner), verifiedOrg: false }

  return {
    // Net is what actually reaches the seller: gross less the commission Stripe
    // already routed away at the time of the charge.
    totals: sales.reduce((acc, sale) => {
      const bucket = acc[sale.currency] ?? { gross: 0, fee: 0, net: 0, count: 0 }
      bucket.gross += sale.amount
      bucket.fee += sale.fee
      bucket.net += sale.amount - sale.fee
      bucket.count++
      acc[sale.currency] = bucket
      return acc
    }, {} as Record<string, { gross: number, fee: number, net: number, count: number }>),
    rate: commissionRate(standing),
    sales: sales.slice(0, 100),
    connected: sellers.some(s => s!.charges_enabled),
  }
})
