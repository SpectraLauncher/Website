export default defineEventHandler(async (event) => {
  const viewer = await requireCatalogRead(event)
  allowAnyOrigin(event)

  const project = await projectByIdOrSlug(String(getRouterParam(event, 'id') ?? ''))
  if (!await visibleProject(project, viewer)) {
    throw createError({ statusCode: 404, statusMessage: 'no such project' })
  }
  if (notModified(event, project!)) return null

  const versions = await versionsOf(project!.id)
  return v2Project(project!, versions.map(v => v.id))
})
