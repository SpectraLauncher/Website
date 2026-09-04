export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)
  const user = await requireUser(event)

  const row = await requestById(String(getRouterParam(event, 'id') ?? ''))
  if (!row || row.status !== 'pending') {
    throw createError({ statusCode: 404, statusMessage: 'no such application' })
  }

  const mine = row.user_id === user.id
    || (row.org_id ? await isOrgMember(row.org_id, user.id) === 'owner' : false)

  if (!mine) throw createError({ statusCode: 404, statusMessage: 'no such application' })

  await withdrawRequest(row.id)
  return { ok: true }
})
