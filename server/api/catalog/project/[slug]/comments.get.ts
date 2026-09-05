
export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)
  const viewer = await optionalUser(event)

  const project = await projectByIdOrSlug(String(getRouterParam(event, 'slug') ?? ''))
  if (!await visibleProject(project, viewer)) {
    throw createError({ statusCode: 404, statusMessage: 'no such project' })
  }

  return { comments: await listComments(project!.id, isAdmin(viewer)) }
})
