export default defineEventHandler(async (event) => {
  await requireCatalogWrite(event)

  const id = String(getRouterParam(event, 'id') ?? '')
  if (!isPublicId(id)) throw createError({ statusCode: 404, statusMessage: 'no such image' })

  await removeGalleryImage(id)
  return { ok: true }
})
