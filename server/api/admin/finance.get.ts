export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const [totals, months, payouts, commission] = await Promise.all([
    financeTotals(),
    grossByMonth(12),
    payoutQueue(100),
    commissionSettings(),
  ])

  return { totals, months, payouts, commission }
})
