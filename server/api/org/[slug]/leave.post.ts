
export default defineEventHandler(async (event) => {
  const user = await requireCatalogRead(event)
  if (!user) throw createError({ statusCode: 404, statusMessage: 'no such organization' })

  const org = await orgBySlug(String(getRouterParam(event, 'slug') ?? ''))
  if (!org) throw createError({ statusCode: 404, statusMessage: 'no such organization' })

  const role = await isOrgMember(org.id, user.id)
  if (!role) throw createError({ statusCode: 404, statusMessage: 'no such organization' })

  // Nobody left behind: the organization goes, and its projects with it through
  // the cascade on org_id. Keeping an empty organization alive would leave
  // projects nobody can publish a fix for or take down.
  if (await memberCount(org.id) < 2) {
    await deleteOrganization(org.id)
    return { left: true, deleted: true }
  }

  // Somebody is still here, so there has to be an owner for them. Handing over
  // is a different decision from walking out and is made on purpose.
  if (role === 'owner' && await ownerCount(org.id) < 2) {
    throw createError({ statusCode: 409, statusMessage: 'hand the organization over first' })
  }

  await removeMember(org.id, user.id)
  return { left: true, deleted: false }
})
