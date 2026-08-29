export default defineEventHandler(async (event) => {
  const me = await requireUser(event)

  rateLimit(event, { key: `secret:${me.id}`, limit: 1, windowMs: 60_000 })

  const { code } = await readBody<{ code?: string }>(event) ?? {}
  if (!code || code.length > 64) throw createError({ statusCode: 400, statusMessage: 'bad code' })

  const badge = await awardForCode(me.id, code)
  if (!badge) return { ok: false }

  return { ok: true, badge: { slug: badge.slug, name: badge.name, image: badge.image } }
})
