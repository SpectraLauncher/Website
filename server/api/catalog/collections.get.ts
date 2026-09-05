
export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)
  const user = await requireUser(event)

  const projectId = String(getQuery(event).holding ?? '')

  return {
    collections: (await collectionsOf(user.id, user.id)).map(publicCollection),
    // Which of them already hold a given project, so the picker can show it
    // without a request per collection.
    holding: projectId ? await collectionsHolding(user.id, projectId) : [],
  }
})
