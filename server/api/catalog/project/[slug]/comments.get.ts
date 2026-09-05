
export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)
  const viewer = await optionalUser(event)

  const project = await projectByIdOrSlug(String(getRouterParam(event, 'slug') ?? ''))
  if (!await visibleProject(project, viewer)) {
    throw createError({ statusCode: 404, statusMessage: 'no such project' })
  }

  // A block is the viewer's own filter, so it applies to what they are shown
  // rather than to what exists.
  const hidden = viewer ? await blockedIds(viewer.id) : []

  return { comments: await listComments(project!.id, isAdmin(viewer), hidden) }
})
