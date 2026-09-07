export default defineEventHandler(async (event) => {
  const user = await requireCatalogRead(event)
  if (!user) throw createError({ statusCode: 404, statusMessage: 'no such organization' })

  const org = await orgBySlug(String(getRouterParam(event, 'slug') ?? ''))
  if (!org) throw createError({ statusCode: 404, statusMessage: 'no such organization' })

  // 404 rather than 403 throughout: whether an organization exists is not
  // something this route confirms to somebody who cannot act on it.
  const standing = await orgStanding(org.id, user)
  if (!standing || !(standing.mask & ORG_PERMISSIONS.delete_organization)) {
    throw createError({ statusCode: 404, statusMessage: 'no such organization' })
  }

  // The projects go too, through the cascade on project.org_id. Transferring
  // them to whoever pressed the button would hand somebody else's work to one
  // member; taking the organization down takes its work with it.
  await deleteOrganization(org.id)

  return { deleted: true }
})
