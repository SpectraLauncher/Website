export default defineEventHandler(async (event) => {
  const staff = await requireAdmin(event)

  const { slug, username, revoke: remove } = await readBody<{
    slug?: string, username?: string, revoke?: boolean
  }>(event) ?? {}

  const user = await one<{ id: string }>(
    'SELECT id FROM "user" WHERE lower(username) = $1', [String(username ?? '').trim().toLowerCase()])

  if (!user) throw createError({ statusCode: 404, statusMessage: 'nie ma takiego gracza' })

  const badge = String(slug ?? '').toLowerCase()
  if (remove) await revoke(user.id, badge)
  else await award(user.id, badge)

  await recordStaffAction({
    actor: staff,
    action: remove ? 'badge.revoke' : 'badge.award',
    subjectKind: 'user',
    subjectId: user.id,
    summary: `${badge} ${remove ? 'zdjęta z' : 'przyznana'} ${String(username ?? '').trim()}`,
    meta: { badge },
  })

  return { ok: true }
})
