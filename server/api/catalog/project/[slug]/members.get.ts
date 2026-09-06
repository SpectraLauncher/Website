
export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)
  const user = await requireUser(event)

  const project = await projectByIdOrSlug(String(getRouterParam(event, 'slug') ?? ''))
  if (!project) throw createError({ statusCode: 404, statusMessage: 'no such project' })

  const standing = await projectStanding(project, user)
  if (!standing.mask) throw createError({ statusCode: 404, statusMessage: 'no such project' })

  return {
    members: await projectMembers(project.id),
    mine: projectMaskToList(standing.mask),
    owner: standing.owner || standing.siteAdmin,
  }
})
