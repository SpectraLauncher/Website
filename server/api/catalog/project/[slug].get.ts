export default defineEventHandler(async (event) => {
  const viewer = await requireCatalogRead(event)

  const project = await projectByIdOrSlug(String(getRouterParam(event, 'slug') ?? ''))
  if (!await visibleProject(project, viewer)) {
    throw createError({ statusCode: 404, statusMessage: 'no such project' })
  }

  if (notModified(event, project!)) return null

  const versions = await versionsOf(project!.id)
  const files = await filesForVersions(versions.map(v => v.id))
  const deps = await dependenciesForVersions(versions.map(v => v.id))
  const dependents = await dependentsOf(project!.id)
  const gallery = await galleryOf(project!.id)
  const owner = await projectOwner(project!.owner_id, project!.org_id)

  await recordView(event, project!.id).catch(e => console.error('[attribution] view', e))
  const following = viewer ? await isFollowing(viewer.id, project!.id) : false
  const favourited = viewer ? await isFavourite(viewer.id, project!.id) : false

  return {
    project: {
      ...fullProject(project!, versions, files, deps),
      owner,
      following,
      dependents,
      favourited,
    },
    gallery,
    listed: isListed(project!.status),
  }
})
