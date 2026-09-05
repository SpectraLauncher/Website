
export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)
  const viewer = await optionalUser(event)

  const collection = await collectionById(String(getRouterParam(event, 'id') ?? ''))
  if (!collection || !collectionVisible(collection, viewer)) {
    throw createError({ statusCode: 404, statusMessage: 'no such collection' })
  }

  const isOwner = collection.user_id === viewer?.id
  const owner = await collectionOwner(collection.user_id)

  return {
    collection: publicCollection(collection),
    owner,
    isOwner,
    projects: (await collectionProjects(collection.id, isOwner)).map(shortProject),
  }
})
