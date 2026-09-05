
export default defineEventHandler(async (event) => {
  const me = await requireUser(event)

  const gone = await revokeToken(me.id, String(getRouterParam(event, 'id') ?? ''))
  if (!gone) throw createError({ statusCode: 404, statusMessage: 'no such token' })

  return { revoked: true }
})
