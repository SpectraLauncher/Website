export default defineEventHandler(async (event) => {
  await requireCatalogWrite(event)

  const id = String(getRouterParam(event, 'id') ?? '')
  if (!isPublicId(id)) throw createError({ statusCode: 404, statusMessage: 'no such image' })

  const body = await readBody<{ title?: unknown, ordering?: unknown, featured?: unknown }>(event)
    ?? {}

  const image = await updateGalleryImage(id, {
    title: typeof body.title === 'string' ? body.title.trim().slice(0, 200) : undefined,
    ordering: body.ordering === undefined ? undefined : Math.max(0, Number(body.ordering) || 0),
    featured: typeof body.featured === 'boolean' ? body.featured : undefined,
  })

  if (!image) throw createError({ statusCode: 404, statusMessage: 'no such image' })
  return { image }
})
