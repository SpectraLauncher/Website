
export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)
  const collection = await requireOwnCollection(event)

  const projectId = String(getQuery(event).projectId ?? '')
  if (!projectId) throw createError({ statusCode: 400, statusMessage: 'projectId is required' })

  await removeFromCollection(collection.id, projectId)
  return { removed: true }
})
