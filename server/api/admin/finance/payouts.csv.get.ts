/**
 * The payout list as a spreadsheet.
 *
 * A download rather than JSON because the one thing anybody does with this is
 * open it next to a bank statement.
 */
export default defineEventHandler(async (event) => {
  const staff = await requireAdmin(event)

  const rows = await payoutQueue(500)

  await recordStaffAction({
    actor: staff,
    action: 'finance.export',
    subjectKind: 'platform',
    summary: `${rows.length} wypłat`,
  })

  setResponseHeader(event, 'content-type', 'text/csv; charset=utf-8')
  setResponseHeader(event, 'content-disposition',
    `attachment; filename="payouts-${new Date().toISOString().slice(0, 10)}.csv"`)

  return payoutsCsv(rows)
})
