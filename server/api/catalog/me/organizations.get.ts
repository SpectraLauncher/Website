export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)
  const user = await requireUser(event)

  const orgs = await organizationsOf(user.id)

  return {
    organizations: await Promise.all(orgs.map(async org => ({
      ...org,
      projects: (await orgProjects(org.id, true)).length,
    }))),
  }
})
