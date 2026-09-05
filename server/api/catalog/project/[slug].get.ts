export default defineEventHandler(async (event) => {
  const viewer = await requireCatalogRead(event)

  const project = await projectByIdOrSlug(String(getRouterParam(event, 'slug') ?? ''))
  if (!await visibleProject(project, viewer)) {
    throw createError({ statusCode: 404, statusMessage: 'no such project' })
  }

  if (notModified(event, project!)) return null

  const versions = await versionsOf(project!.id)
  const files = await filesForVersions(versions.map(v => v.id))
  const gallery = await galleryOf(project!.id)
  const owner = await projectOwner(project!.owner_id, project!.org_id)

  await recordView(event, project!.id).catch(e => console.error('[attribution] view', e))
  const price = Number(project!.price ?? 0)

  const owned = price > 0 && viewer
    ? isAdmin(viewer) || project!.owner_id === viewer.id
      || await hasPurchased(viewer.id, project!.id)
    : false

  const following = viewer ? await isFollowing(viewer.id, project!.id) : false
  const favourited = viewer ? await isFavourite(viewer.id, project!.id) : false

  return {
    project: {
      ...fullProject(project!, versions, files),
      owner,
      following,
      favourited,
      price,
      currency: project!.currency,
      owned,
    },
    gallery,
    listed: isListed(project!.status),
  }
})
