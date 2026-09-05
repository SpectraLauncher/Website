export default defineEventHandler(async (event) => {
  await requireCatalogWrite(event)

  const query = getQuery(event)
  const days = Math.min(Math.max(Number(query.days) || 30, 1), 365)

  const to = metricDay()
  const from = metricDay(Date.now() - days * 86_400_000)

  const rows = await metricsBetween(from, to)
  const shares = revenueShares(rows)

  // pruning rides along with the report, which is the only thing that
  // reads this table regularly. Move it to a scheduled task if the report stops
  // being opened.
  await pruneViewSeen().catch(e => console.error('[attribution] prune', e))

  const titles = await projectTitles(shares.map(s => s.projectId))

  return {
    from,
    to,
    totals: {
      views: rows.reduce((sum, r) => sum + Number(r.views), 0),
      downloads: rows.reduce((sum, r) => sum + Number(r.downloads), 0),
    },
    shares: shares.map(share => ({
      ...share,
      title: titles.get(share.projectId) ?? null,
    })),
  }
})
