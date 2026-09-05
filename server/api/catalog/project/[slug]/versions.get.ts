export default defineEventHandler(async (event) => {
  const viewer = await requireCatalogRead(event)

  const project = await projectByIdOrSlug(String(getRouterParam(event, 'slug') ?? ''))
  if (!await visibleProject(project, viewer)) {
    throw createError({ statusCode: 404, statusMessage: 'no such project' })
  }

  const versions = await versionsOf(project!.id)
  const files = await filesForVersions(versions.map(v => v.id))
  const byVersion = groupFiles(files)

  return {
    versions: await Promise.all(versions.map(async v => ({
      ...fullVersion(v, byVersion.get(v.id) ?? []),
      dependencies: await dependenciesOf(v.id),
    }))),
  }
})
