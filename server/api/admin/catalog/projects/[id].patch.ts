export default defineEventHandler(async (event) => {
  await requireCatalogWrite(event)

  const project = await projectByIdOrSlug(String(getRouterParam(event, 'id') ?? ''))
  if (!project) throw createError({ statusCode: 404, statusMessage: 'no such project' })

  const body = await readBody<ProjectInput>(event) ?? {}
  const updated = await updateProject(project.id, body)

  return { project: fullProject(updated, [], []) }
})
