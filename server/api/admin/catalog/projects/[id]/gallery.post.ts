const MAX_BYTES = 8 * 1024 * 1024
const ACCEPTED = ['image/webp', 'image/png', 'image/jpeg']
const MAX_IMAGES = 20

export default defineEventHandler(async (event) => {
  await requireCatalogWrite(event)

  const project = await projectByIdOrSlug(String(getRouterParam(event, 'id') ?? ''))
  if (!project) throw createError({ statusCode: 404, statusMessage: 'no such project' })

  const existing = await galleryOf(project.id)
  if (existing.length >= MAX_IMAGES) {
    throw createError({ statusCode: 409, statusMessage: `at most ${MAX_IMAGES} images` })
  }

  const id = newId()
  const url = await storeProjectImage(event, {
    key: `catalog/gallery/${project.id}/${id}.webp`,
    size: 1280,
    fit: 'inside',
    accepted: ACCEPTED,
    maxBytes: MAX_BYTES,
    context: 'project',
    subjectId: project.id,
  })

  const image = await addGalleryImage(id, project.id, url, existing.length)
  setResponseStatus(event, 201)
  return { image }
})
