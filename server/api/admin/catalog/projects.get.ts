export default defineEventHandler(async (event) => {
  await requireCatalogWrite(event)

  const query = getQuery(event)
  const list = await listProjects({
    type: typeof query.type === 'string' ? query.type : undefined,
    statuses: typeof query.status === 'string' ? [query.status] : PROJECT_STATUSES,
    query: typeof query.q === 'string' ? query.q : undefined,
    sort: query.sort === 'updated' || query.sort === 'created' ? query.sort : 'updated',
    offset: Number(query.offset) || 0,
    limit: Number(query.limit) || 20,
  })

  return {
    hits: list.hits.map(shortProject),
    total: list.total,
    offset: list.offset,
    limit: list.limit,
  }
})
