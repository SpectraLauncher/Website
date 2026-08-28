export default defineCachedEventHandler(async () => {
  return await q<{ slug: string, name: string, description: string, image: string | null, holders: number }>(
    `SELECT b.slug, b.name, b.description, b.image,
            (SELECT COUNT(*)::int FROM user_badge ub WHERE ub.slug = b.slug) AS holders
     FROM badge b ORDER BY holders DESC, b.name`,
  )
}, { name: 'badges', maxAge: 60, getKey: () => 'all' })
