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

  // Two different questions, and folding them together made the buy button
  // unreachable: an admin was marked as owning everything, and while the catalog
  // is admin-only that is everyone who can see the page at all.
  //
  // owned is whether this person actually holds it - they wrote it, or they
  // bought it. An author does not buy their own project.
  const owned = price > 0 && viewer
    ? project!.owner_id === viewer.id || await ownsProject(viewer.id, project!.id)
    : false

  // Whether the file will actually come back. An admin may take anything down,
  // which means being able to look at it first.
  const canDownload = price <= 0 || owned || Boolean(viewer && isAdmin(viewer))

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
      canDownload,
    },
    gallery,
    listed: isListed(project!.status),
  }
})
