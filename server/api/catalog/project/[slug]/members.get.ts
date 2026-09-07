
export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)
  const user = await requireUser(event)

  const project = await projectByIdOrSlug(String(getRouterParam(event, 'slug') ?? ''))
  if (!project) throw createError({ statusCode: 404, statusMessage: 'no such project' })

  const standing = await projectStanding(project, user)
  if (!standing.mask) throw createError({ statusCode: 404, statusMessage: 'no such project' })

  // project_member only holds the people granted rights on this one project.
  // The owner and, when an organization owns it, its members hold rights too —
  // a list that leaves them out is a list of everybody except who is actually
  // working on it.
  return {
    members: await projectMembers(project.id),
    owner: await projectOwner(project.owner_id, project.org_id),
    inherited: project.org_id ? await orgMembers(project.org_id) : [],
    mine: projectMaskToList(standing.mask),
    isOwner: standing.owner || standing.siteAdmin,
  }
})
