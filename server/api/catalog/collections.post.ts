
export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)
  const user = await requireUser(event)

  rateLimit(event, { key: `collection:${user.id}`, limit: 20, windowMs: 60_000 })

  const body = await readBody<Record<string, unknown>>(event) ?? {}
  const collection = await createCollection(user.id, body)

  return { collection: publicCollection(collection) }
})
