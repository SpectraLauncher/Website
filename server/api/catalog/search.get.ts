export default defineEventHandler(async (event) => {
  const viewer = await requireCatalogRead(event)

  const query = getQuery(event)
  const list = await listProjects({
    type: typeof query.type === 'string' ? query.type : undefined,
    status: isAdmin(viewer) && query.status === 'any' ? undefined : 'published',
    query: typeof query.q === 'string' ? query.q : undefined,
    gameVersions: listParam(query.gameVersions),
    loaders: listParam(query.loaders),
    categories: listParam(query.categories),
    sort: query.sort === 'updated' || query.sort === 'created' ? query.sort : 'downloads',
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
