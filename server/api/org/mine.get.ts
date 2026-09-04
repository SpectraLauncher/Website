export default defineEventHandler(async (event) => {
  const user = await requireCatalogRead(event)
  if (!user) return { organizations: [] }

  return { organizations: await organizationsOf(user.id) }
})
