export default defineEventHandler(async (event) => {
  const viewer = await requireCatalogRead(event)
  allowAnyOrigin(event)

  const id = String(getRouterParam(event, 'id') ?? '')
  if (!/^\\d+$/.test(id)) throw createError({ statusCode: 404, statusMessage: 'no such version' })

  const version = await versionById(id)
  if (!version) throw createError({ statusCode: 404, statusMessage: 'no such version' })

  const project = await projectByIdOrSlug(version.project_id)
  if (!await visibleProject(project, viewer)) {
    throw createError({ statusCode: 404, statusMessage: 'no such version' })
  }

  return v2Version(version, await filesOf(version.id))
})
