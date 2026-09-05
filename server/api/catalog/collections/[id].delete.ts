
export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)
  const collection = await requireOwnCollection(event)

  await deleteCollection(collection.id)
  return { deleted: true }
})
