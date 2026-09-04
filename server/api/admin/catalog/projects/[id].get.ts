export default defineEventHandler(async (event) => {
  await requireCatalogWrite(event)

  const project = await projectByIdOrSlug(String(getRouterParam(event, 'id') ?? ''))
  if (!project) throw createError({ statusCode: 404, statusMessage: 'no such project' })

  const versions = await versionsOf(project.id)
  const files = await filesForVersions(versions.map(v => v.id))
  const gallery = await galleryOf(project.id)
  const owner = await projectOwner(project.owner_id, project.org_id)

  return { project: { ...fullProject(project, versions, files), owner }, gallery }
})
