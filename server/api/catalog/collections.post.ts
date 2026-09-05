
export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)
  const user = await requireUser(event)

  const body = await readBody<Record<string, unknown>>(event) ?? {}
  const collection = await createCollection(user.id, body)

  return { collection: publicCollection(collection) }
})
