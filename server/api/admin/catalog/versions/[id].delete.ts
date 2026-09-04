export default defineEventHandler(async (event) => {
  await requireCatalogWrite(event)

  const id = String(getRouterParam(event, 'id') ?? '')
  if (!/^\d+$/.test(id)) throw createError({ statusCode: 404, statusMessage: 'no such version' })

  await deleteVersion(id)
  return { ok: true }
})
