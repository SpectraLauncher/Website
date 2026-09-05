
export default defineEventHandler(async (event) => {
  await requireCatalogWrite(event)

  const query = getQuery(event)
  const status = isReportStatus(query.status) ? query.status : 'open'

  const list = await listReports({
    status,
    limit: Number(query.limit) || 50,
    offset: Number(query.offset) || 0,
  })

  const targets = await Promise.all(list.rows.map(reportTarget))
  const reporters = await Promise.all(list.rows.map(row => (row.reporter_id
    ? one<{ username: string | null, name: string | null }>(
      'SELECT username, name FROM "user" WHERE id = $1', [row.reporter_id])
    : Promise.resolve(undefined))))

  return {
    reports: list.rows.map((row, i) => ({
      ...publicReport(row, targets[i] ?? null),
      reporter: reporters[i]
        ? { username: reporters[i]!.username, name: reporters[i]!.name }
        : null,
    })),
    total: list.total,
    open: await openReportCount(),
  }
})
