export default defineEventHandler(async (event) => {
  const { project } = await editableProject(event, 'edit_details')

  const id = String(getRouterParam(event, 'image') ?? '')
  const owned = (await galleryOf(project.id)).some(image => image.id === id)
  if (!owned) throw createError({ statusCode: 404, statusMessage: 'no such image' })

  const body = await readBody<{ title?: unknown, featured?: unknown, ordering?: unknown }>(event) ?? {}

  const image = await updateGalleryImage(id, {
    title: typeof body.title === 'string' ? body.title.slice(0, 200) : undefined,
    featured: typeof body.featured === 'boolean' ? body.featured : undefined,
    ordering: Number.isFinite(Number(body.ordering)) ? Number(body.ordering) : undefined,
  })

  return { image }
})
