
export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)
  const user = await requireUser(event)

  const project = await projectByIdOrSlug(String(getRouterParam(event, 'slug') ?? ''))
  if (!await visibleProject(project, user)) {
    throw createError({ statusCode: 404, statusMessage: 'no such project' })
  }

  const favourites = await favouritesFor(user.id)
  await removeFromCollection(favourites.id, project!.id)

  return { favourited: false }
})
