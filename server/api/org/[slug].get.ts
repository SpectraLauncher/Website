export default defineEventHandler(async (event) => {
  const viewer = await requireCatalogRead(event)

  const org = await orgBySlug(String(getRouterParam(event, 'slug') ?? ''))
  if (!org) throw createError({ statusCode: 404, statusMessage: 'no such organization' })

  const role = viewer ? await isOrgMember(org.id, viewer.id) : null
  const canSeeDrafts = Boolean(role) || isAdmin(viewer)

  const [members, projects] = await Promise.all([
    orgMembers(org.id),
    orgProjects(org.id, canSeeDrafts),
  ])

  return {
    org: publicOrg(org, orgMeta(org.metadata)),
    members,
    projects: projects.map(orgProjectCard),
    role,
  }
})
