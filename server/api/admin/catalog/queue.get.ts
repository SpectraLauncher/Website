
export default defineEventHandler(async (event) => {
  await requireCatalogWrite(event)

  const query = getQuery(event)
  const status = typeof query.status === 'string' && isProjectStatus(query.status)
    ? [query.status]
    : QUEUED_STATUSES

  // Oldest first: a queue that shows the newest submission on top leaves the
  // person who has waited longest at the bottom of the page.
  const list = await listProjects({
    type: typeof query.type === 'string' ? query.type : undefined,
    statuses: status,
    sort: 'created',
    direction: 'asc',
    offset: Number(query.offset) || 0,
    limit: Math.min(Number(query.limit) || 25, 100),
  })

  const owners = await Promise.all(list.hits.map(row => projectOwner(row.owner_id, row.org_id)))

  return {
    hits: list.hits.map((row, i) => ({
      ...shortProject(row),
      waiting: Date.now() - num(row.created),
      owner: owners[i] ?? null,
    })),
    total: list.total,
    offset: list.offset,
    limit: list.limit,
    counts: await queueCounts(),
  }
})
