export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const { slug, username, revoke: remove } = await readBody<{
    slug?: string, username?: string, revoke?: boolean
  }>(event) ?? {}

  const user = await one<{ id: string }>(
    'SELECT id FROM "user" WHERE lower(username) = $1', [String(username ?? '').trim().toLowerCase()])

  if (!user) throw createError({ statusCode: 404, statusMessage: 'nie ma takiego gracza' })

  const badge = String(slug ?? '').toLowerCase()
  if (remove) await revoke(user.id, badge)
  else await award(user.id, badge)

  return { ok: true }
})
