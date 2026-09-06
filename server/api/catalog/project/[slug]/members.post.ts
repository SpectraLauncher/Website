
export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)
  const user = await requireUser(event)

  const project = await projectByIdOrSlug(String(getRouterParam(event, 'slug') ?? ''))
  if (!project) throw createError({ statusCode: 404, statusMessage: 'no such project' })

  const standing = await requireProjectPermission(project, user, 'edit_member')

  const body = await readBody<{ username?: unknown, permissions?: unknown }>(event) ?? {}

  const target = await one<{ id: string }>(
    'SELECT id FROM "user" WHERE lower(username) = lower($1)',
    [String(body.username ?? '')],
  )
  if (!target) throw createError({ statusCode: 404, statusMessage: 'no such user' })

  if (target.id === project.owner_id) {
    throw createError({ statusCode: 409, statusMessage: 'the owner already holds everything' })
  }

  const wanted = projectListToMask(body.permissions)
  if (!canGrantProject(standing.mask, wanted)) {
    throw createError({ statusCode: 403, statusMessage: 'you cannot grant what you do not have' })
  }

  await setProjectMember(project.id, target.id, wanted)
  return { members: await projectMembers(project.id) }
})
