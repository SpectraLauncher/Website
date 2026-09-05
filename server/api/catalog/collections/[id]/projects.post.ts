
export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)
  const user = await requireUser(event)
  const collection = await requireOwnCollection(event)

  const { projectId } = await readBody<{ projectId?: unknown }>(event) ?? {}
  const project = await projectByIdOrSlug(String(projectId ?? ''))

  // Saving a project nobody can see would leak its existence through the
  // collection, so the same visibility rule applies here as anywhere else.
  if (!await visibleProject(project, user)) {
    throw createError({ statusCode: 404, statusMessage: 'no such project' })
  }

  await addToCollection(collection.id, project!.id)
  return { added: true }
})
