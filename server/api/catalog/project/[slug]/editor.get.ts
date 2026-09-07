// Everything the settings area needs in one answer: the project as its author
// sees it — drafts and all — the gallery, and what this person may change.
export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)
  const user = await requireUser(event)

  const project = await projectByIdOrSlug(String(getRouterParam(event, 'slug') ?? ''))
  if (!project) throw createError({ statusCode: 404, statusMessage: 'no such project' })

  const standing = await projectStanding(project, user)

  // No rights at all is indistinguishable from the project not being there.
  if (!standing.mask) throw createError({ statusCode: 404, statusMessage: 'no such project' })

  const versions = await versionsOf(project.id)
  const files = await filesForVersions(versions.map(v => v.id))
  const owner = await projectOwner(project.owner_id, project.org_id)

  return {
    project: {
      ...fullProject(project, versions, files),
      owner,
      status: project.status,
      requestedStatus: project.requested_status,
    },
    gallery: await galleryOf(project.id),
    permissions: projectMaskToList(standing.mask),
  }
})
