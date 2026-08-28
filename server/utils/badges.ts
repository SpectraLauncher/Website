export type BadgeParam = 'none' | 'number' | 'date' | 'text'

export interface BadgeRuleDef {
  id: string
  label: string
  hint: string
  param: BadgeParam
  where?: string
}

export const BADGE_RULES: BadgeRuleDef[] = [
  { id: 'manual', label: 'Ręcznie', param: 'none', hint: 'Przyznajesz sam z tego panelu.' },
  { id: 'code', label: 'Kod na /secret', param: 'text', hint: 'Wartość: kod do wpisania na stronie.' },

  { id: 'first_users', label: 'Pierwsze N kont', param: 'number', hint: 'Wartość: liczba kont, np. 100.', where: 's.rank <= $3::int' },
  { id: 'joined_before', label: 'Konto założone przed', param: 'date', hint: 'Wartość: data RRRR-MM-DD.', where: 's.created_at < $3::timestamptz' },
  { id: 'account_days', label: 'Wiek konta w dniach', param: 'number', hint: 'Wartość: liczba dni, np. 365.', where: 's.account_days >= $3::int' },

  { id: 'nick_length', label: 'Krótki nick Minecraft', param: 'number', hint: 'Wartość: maksymalna długość nicku, np. 4.', where: 's.nick_len BETWEEN 1 AND $3::int' },
  { id: 'nick_match', label: 'Nick pasuje do wzorca', param: 'text', hint: 'Wartość: wyrażenie regularne, np. ^[aeiou]+$.', where: 's.nick ~* $3' },

  { id: 'launch_day', label: 'Uruchomienie w dniu', param: 'date', hint: 'Wartość: data RRRR-MM-DD, np. 2026-12-24.', where: 'EXISTS (SELECT 1 FROM user_activity d WHERE d.user_id = s.id AND d.day = $3 AND d.launches > 0)' },
  { id: 'launches', label: 'Liczba uruchomień', param: 'number', hint: 'Wartość: łączna liczba uruchomień, np. 500.', where: 's.launches >= $3::int' },
  { id: 'streak', label: 'Seria dni pod rząd', param: 'number', hint: 'Wartość: długość najdłuższej serii, np. 7.', where: 's.streak >= $3::int' },
  { id: 'active_days', label: 'Dni z uruchomieniem', param: 'number', hint: 'Wartość: liczba dni, np. 30.', where: 's.active_days >= $3::int' },
  { id: 'playtime_hours', label: 'Godziny gry', param: 'number', hint: 'Wartość: łączny czas w godzinach, np. 100.', where: 's.seconds >= $3::int * 3600' },

  { id: 'friends', label: 'Liczba znajomych', param: 'number', hint: 'Wartość: liczba znajomych, np. 10.', where: 's.friends >= $3::int' },
  { id: 'packs', label: 'Udostępnione paczki', param: 'number', hint: 'Wartość: liczba paczek, np. 5.', where: 's.packs >= $3::int' },
  { id: 'downloads', label: 'Pobrania paczek', param: 'number', hint: 'Wartość: łączna liczba pobrań, np. 100.', where: 's.downloads >= $3::int' },
]

export const badgeRule = (id: string): BadgeRuleDef | undefined =>
  BADGE_RULES.find(r => r.id === id)

export interface BadgeRow {
  slug: string
  name: string
  description: string
  image: string | null
  rule: string
  rule_value: string | null
  created: string | number
}

const STATS = `
  WITH act AS (
    SELECT user_id,
           SUM(launches)::int AS launches,
           SUM(seconds)::int  AS seconds,
           COUNT(*)::int      AS active_days
    FROM user_activity GROUP BY user_id
  ),
  runs AS (
    SELECT user_id,
           day::date - (ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY day))::int AS grp
    FROM user_activity WHERE launches > 0
  ),
  streaks AS (
    SELECT user_id, MAX(n)::int AS best
    FROM (SELECT user_id, grp, COUNT(*) AS n FROM runs GROUP BY user_id, grp) r
    GROUP BY user_id
  ),
  fr AS (
    SELECT user_id, COUNT(*)::int AS friends FROM (
      SELECT requester_id AS user_id FROM friendship WHERE status = 'accepted'
      UNION ALL
      SELECT addressee_id AS user_id FROM friendship WHERE status = 'accepted'
    ) x GROUP BY user_id
  ),
  pk AS (
    SELECT owner_id AS user_id,
           COUNT(*)::int AS packs,
           COALESCE(SUM(downloads), 0)::int AS downloads
    FROM shares WHERE owner_id IS NOT NULL GROUP BY owner_id
  ),
  s AS (
    SELECT u.id,
           u."createdAt" AS created_at,
           (ROW_NUMBER() OVER (ORDER BY u."createdAt"))::int AS rank,
           FLOOR(EXTRACT(EPOCH FROM (now() - u."createdAt")) / 86400)::int AS account_days,
           COALESCE(u."mcUsername", '') AS nick,
           COALESCE(LENGTH(u."mcUsername"), 0) AS nick_len,
           COALESCE(a.launches, 0) AS launches,
           COALESCE(a.seconds, 0) AS seconds,
           COALESCE(a.active_days, 0) AS active_days,
           COALESCE(st.best, 0) AS streak,
           COALESCE(f.friends, 0) AS friends,
           COALESCE(p.packs, 0) AS packs,
           COALESCE(p.downloads, 0) AS downloads
    FROM "user" u
    LEFT JOIN act a     ON a.user_id = u.id
    LEFT JOIN streaks st ON st.user_id = u.id
    LEFT JOIN fr f      ON f.user_id = u.id
    LEFT JOIN pk p      ON p.user_id = u.id
  )
`

export async function award(userId: string, slug: string): Promise<void> {
  await exec(
    `INSERT INTO user_badge (user_id, slug, awarded) VALUES ($1, $2, $3)
     ON CONFLICT (user_id, slug) DO NOTHING`,
    [userId, slug, Date.now()],
  )
}

export async function revoke(userId: string, slug: string): Promise<void> {
  await exec('DELETE FROM user_badge WHERE user_id = $1 AND slug = $2', [userId, slug])
}

export function ruleQuery(where: string, forOneUser: boolean): string {
  // sql-safe: `where` pochodzi z BADGE_RULES, wartosc reguly leci przez $3
  return `${STATS}
     INSERT INTO user_badge (user_id, slug, awarded)
     SELECT s.id, $1, $2 FROM s WHERE ${where}${forOneUser ? ' AND s.id = $4' : ''}
     ON CONFLICT (user_id, slug) DO NOTHING`
}

export async function syncBadges(opts: { slug?: string, userId?: string } = {}): Promise<number> {
  const badges = opts.slug
    ? await q<BadgeRow>('SELECT * FROM badge WHERE slug = $1', [opts.slug])
    : await q<BadgeRow>('SELECT * FROM badge')

  let awarded = 0

  for (const badge of badges) {
    const rule = badgeRule(badge.rule)
    if (!rule?.where || !badge.rule_value) continue

    const params: unknown[] = [badge.slug, Date.now(), badge.rule_value]
    if (opts.userId) params.push(opts.userId)

    awarded += await exec(ruleQuery(rule.where, Boolean(opts.userId)), params)
  }

  return awarded
}

export async function awardForCode(userId: string, code: string): Promise<BadgeRow | null> {
  const clean = code.trim().toLowerCase()
  if (!clean) return null

  const badges = await q<BadgeRow>('SELECT * FROM badge WHERE rule = $1', ['code'])
  const hit = badges.find(b => (b.rule_value ?? '').trim().toLowerCase() === clean)
  if (!hit) return null

  await award(userId, hit.slug)
  return hit
}

export const badgesOf = (userId: string) =>
  q<{ slug: string, name: string, description: string, image: string | null, awarded: string }>(
    `SELECT b.slug, b.name, b.description, b.image, ub.awarded
     FROM user_badge ub JOIN badge b ON b.slug = ub.slug
     WHERE ub.user_id = $1
     ORDER BY ub.awarded`,
    [userId],
  )
