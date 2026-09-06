
export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)
  const user = await requireUser(event)

  const project = await projectByIdOrSlug(String(getRouterParam(event, 'slug') ?? ''))
  if (!project) throw createError({ statusCode: 404, statusMessage: 'no such project' })

  await requireProjectPermission(project, user, 'remove_member')

  const userId = String(getRouterParam(event, 'userId') ?? '')
  if (userId === project.owner_id) {
    throw createError({ statusCode: 409, statusMessage: 'the owner cannot be removed' })
  }

  await removeProjectMember(project.id, userId)
  return { members: await projectMembers(project.id) }
})
