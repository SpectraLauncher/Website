export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const badges = await q(
    `SELECT b.*, (SELECT COUNT(*)::int FROM user_badge ub WHERE ub.slug = b.slug) AS holders
     FROM badge b ORDER BY b.created DESC`,
  )

  return { badges, rules: BADGE_RULES.map(({ id, label, hint, param }) => ({ id, label, hint, param })) }
})
