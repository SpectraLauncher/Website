
export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)
  const user = await requireUser(event)

  const { rows } = await listReports({ reporterId: user.id, limit: 50 })
  const targets = await Promise.all(rows.map(reportTarget))

  return { reports: rows.map((row, i) => publicReport(row, targets[i] ?? null)) }
})
