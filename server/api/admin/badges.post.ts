export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const body = await readBody<{
    slug?: string
    name?: string
    description?: string
    image?: string | null
    rule?: string
    ruleValue?: string | null
  }>(event) ?? {}

  const slug = String(body.slug ?? '').trim().toLowerCase()
  if (!/^[a-z0-9][a-z0-9-]{1,38}$/.test(slug)) {
    throw createError({ statusCode: 400, statusMessage: 'slug: 2-39 znakow, male litery, cyfry i myslnik' })
  }

  const name = String(body.name ?? '').trim().slice(0, 60)
  if (!name) throw createError({ statusCode: 400, statusMessage: 'name is required' })

  const rule = badgeRule(String(body.rule ?? 'manual'))
  if (!rule) throw createError({ statusCode: 400, statusMessage: 'unknown rule' })

  const raw = body.ruleValue == null ? null : String(body.ruleValue).trim().slice(0, 120)
  const ruleValue = rule.param === 'none' ? null : raw

  if (rule.param === 'number' && !(Number(ruleValue) > 0)) {
    throw createError({ statusCode: 400, statusMessage: `${rule.label}: wymagana liczba wieksza od zera` })
  }
  if (rule.param === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(ruleValue ?? '')) {
    throw createError({ statusCode: 400, statusMessage: `${rule.label}: wymagana data RRRR-MM-DD` })
  }
  if (rule.param === 'text' && !ruleValue) {
    throw createError({ statusCode: 400, statusMessage: `${rule.label}: wymagana wartosc` })
  }

  await exec(
    `INSERT INTO badge (slug, name, description, image, rule, rule_value, created)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name,
                                      description = EXCLUDED.description,
                                      image = EXCLUDED.image,
                                      rule = EXCLUDED.rule,
                                      rule_value = EXCLUDED.rule_value`,
    [slug, name, String(body.description ?? '').slice(0, 400), body.image || null, rule.id, ruleValue, Date.now()],
  )

  return { ok: true, slug, awarded: await syncBadges({ slug }) }
})
