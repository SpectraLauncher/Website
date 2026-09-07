// Handing a project to an organization. Not an edit: whoever holds edit_details
// can change the name, and that is a long way from giving the project away.
export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)
  const user = await requireUser(event)

  const project = await projectByIdOrSlug(String(getRouterParam(event, 'slug') ?? ''))
  if (!project) throw createError({ statusCode: 404, statusMessage: 'no such project' })

  const standing = await projectStanding(project, user)
  if (!standing.mask) throw createError({ statusCode: 404, statusMessage: 'no such project' })
  if (!standing.owner && !standing.siteAdmin) {
    throw createError({ statusCode: 403, statusMessage: 'only the owner can transfer a project' })
  }

  const body = await readBody<{ orgId?: unknown }>(event) ?? {}
  const orgId = typeof body.orgId === 'string' ? body.orgId.trim() : ''
  if (!orgId) throw createError({ statusCode: 400, statusMessage: 'pick an organization' })

  // You can only hand it to a group you are in, and only where you would have
  // been allowed to create it in the first place.
  const org = await orgStanding(orgId, user)
  if (!org || !(org.mask & ORG_PERMISSIONS.add_project)) {
    throw createError({ statusCode: 404, statusMessage: 'no such organization' })
  }

  const updated = await updateProject(project.id, { orgId })

  return { project: fullProject(updated, [], []) }
})
