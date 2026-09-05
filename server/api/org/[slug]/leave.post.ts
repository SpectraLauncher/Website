
export default defineEventHandler(async (event) => {
  const user = await requireCatalogRead(event)
  if (!user) throw createError({ statusCode: 404, statusMessage: 'no such organization' })

  const org = await orgBySlug(String(getRouterParam(event, 'slug') ?? ''))
  if (!org) throw createError({ statusCode: 404, statusMessage: 'no such organization' })

  const role = await isOrgMember(org.id, user.id)
  if (!role) throw createError({ statusCode: 404, statusMessage: 'no such organization' })

  // The last owner has to hand the organization over or delete it; walking out
  // would leave projects nobody can administer.
  if (role === 'owner' && await ownerCount(org.id) < 2) {
    throw createError({ statusCode: 409, statusMessage: 'hand the organization over first' })
  }

  await removeMember(org.id, user.id)
  return { left: true }
})
