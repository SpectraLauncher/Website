export default defineEventHandler(async (event) => {
  await requireCatalogWrite(event)

  const project = await projectByIdOrSlug(String(getRouterParam(event, 'id') ?? ''))
  if (!project) throw createError({ statusCode: 404, statusMessage: 'no such project' })

  const versions = await versionsOf(project.id)
  const files = await filesForVersions(versions.map(v => v.id))
  const gallery = await galleryOf(project.id)

  return { project: fullProject(project, versions, files), gallery }
})
