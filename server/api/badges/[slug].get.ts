export default defineEventHandler(async (event) => {
  const slug = String(getRouterParam(event, 'slug') ?? '').toLowerCase()

  const badge = await one<{ slug: string, name: string, description: string, image: string | null }>(
    'SELECT slug, name, description, image FROM badge WHERE slug = $1', [slug])

  if (!badge) throw createError({ statusCode: 404, statusMessage: 'no such badge' })

  const holders = await q<{ username: string, name: string, image: string | null, awarded: string }>(
    `SELECT u.username, u.name, u.image, ub.awarded
     FROM user_badge ub JOIN "user" u ON u.id = ub.user_id
     WHERE ub.slug = $1
     ORDER BY ub.awarded`,
    [slug],
  )

  return { badge, holders: holders.map(h => ({ ...h, awarded: Number(h.awarded) })) }
})
