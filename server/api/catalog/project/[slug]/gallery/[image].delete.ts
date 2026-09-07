export default defineEventHandler(async (event) => {
  const { project } = await editableProject(event, 'edit_details')

  const id = String(getRouterParam(event, 'image') ?? '')

  // The image has to belong to this project. Without that check, edit rights on
  // one project would be edit rights on every gallery.
  const owned = (await galleryOf(project.id)).some(image => image.id === id)
  if (!owned) throw createError({ statusCode: 404, statusMessage: 'no such image' })

  await removeGalleryImage(id)
  return { ok: true }
})
