
export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)
  const user = await requireUser(event)

  const project = await projectByIdOrSlug(String(getRouterParam(event, 'slug') ?? ''))
  if (!project || !await canSeeThread(project, user)) {
    throw createError({ statusCode: 404, statusMessage: 'no such project' })
  }

  return { status: project.status, messages: await threadFor(project.id) }
})
