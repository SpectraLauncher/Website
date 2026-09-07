export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)
  const user = await requireUser(event)

  const org = await orgBySlug(String(getRouterParam(event, 'slug') ?? ''))
  const role = org ? await isOrgMember(org.id, user.id) : null

  // Who gets paid what is an owner's decision, and an admin's. Everyone else
  // has no business seeing the arrangement, so this is a 404 rather than a 403.
  if (!org || (role !== 'owner' && role !== 'admin')) {
    throw createError({ statusCode: 404, statusMessage: 'no such organization' })
  }

  return { shares: await splitFor(org.id), members: await splitMembers(org.id) }
})
