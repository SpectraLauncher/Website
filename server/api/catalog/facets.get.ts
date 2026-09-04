export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)

  const type = getQuery(event).type
  return await catalogFacets(typeof type === 'string' && type ? type : undefined)
})
