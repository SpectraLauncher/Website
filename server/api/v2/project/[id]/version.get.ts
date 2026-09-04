export default defineEventHandler(async (event) => {
  const viewer = await requireCatalogRead(event)
  allowAnyOrigin(event)

  const project = await projectByIdOrSlug(String(getRouterParam(event, 'id') ?? ''))
  if (!await visibleProject(project, viewer)) {
    throw createError({ statusCode: 404, statusMessage: 'no such project' })
  }

  const versions = await versionsOf(project!.id)
  const files = await filesForVersions(versions.map(v => v.id))
  const byVersion = groupFiles(files)

  return versions.map(v => v2Version(v, byVersion.get(v.id) ?? []))
})
