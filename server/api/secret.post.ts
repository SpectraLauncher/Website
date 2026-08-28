export default defineEventHandler(async (event) => {
  const me = await requireUser(event)

  const { code } = await readBody<{ code?: string }>(event) ?? {}
  if (!code || code.length > 64) throw createError({ statusCode: 400, statusMessage: 'bad code' })

  const badge = await awardForCode(me.id, code)
  if (!badge) return { ok: false }

  return { ok: true, badge: { slug: badge.slug, name: badge.name, image: badge.image } }
})
