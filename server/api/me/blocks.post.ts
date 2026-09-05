
export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  const { username } = await readBody<{ username?: unknown }>(event) ?? {}

  const target = await one<{ id: string }>(
    'SELECT id FROM "user" WHERE lower(username) = lower($1)',
    [String(username ?? '')],
  )
  if (!target) throw createError({ statusCode: 404, statusMessage: 'no such user' })

  await blockUser(me.id, target.id)
  return { blocked: true }
})
