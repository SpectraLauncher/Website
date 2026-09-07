export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)
  const user = await requireUser(event)

  const org = await orgBySlug(String(getRouterParam(event, 'slug') ?? ''))
  const role = org ? await isOrgMember(org.id, user.id) : null

  if (!org || (role !== 'owner' && role !== 'admin')) {
    throw createError({ statusCode: 404, statusMessage: 'no such organization' })
  }

  const body = await readBody<{ shares?: unknown }>(event) ?? {}
  await saveSplit(org.id, body.shares)

  return { shares: await splitFor(org.id) }
})
