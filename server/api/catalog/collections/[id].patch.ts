
export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)
  const collection = await requireOwnCollection(event)

  const body = await readBody<Record<string, unknown>>(event) ?? {}
  return { collection: publicCollection(await updateCollection(collection.id, body)) }
})
