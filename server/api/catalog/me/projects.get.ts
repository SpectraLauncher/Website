export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)
  const user = await requireUser(event)

  const orgs = await organizationsOf(user.id)
  const mine = await ownedProjects(user.id, orgs.map(org => org.id))

  return {
    projects: mine.map(project => ({
      ...shortProject(project),
      orgId: project.org_id,
    })),
    organizations: orgs,
  }
})
