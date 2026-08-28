
export default defineEventHandler(async (event) => {
  const username = String(getRouterParam(event, 'username') ?? '').toLowerCase()

  const user = await one<{
    id: string
    name: string
    username: string
    image: string | null
    mcUsername: string | null
    mcUuid: string | null
    friendsVisibility: string | null
    presence: string | null
    lastSeen: string | number | null
    createdAt: string
  }>(
    `SELECT id, name, username, image, "mcUsername", "mcUuid", "friendsVisibility",
            presence, "lastSeen", "createdAt"
     FROM "user" WHERE lower(username) = $1`,
    [username],
  )

  if (!user) throw createError({ statusCode: 404, statusMessage: 'no such user' })

  const visibility = user.friendsVisibility === 'public' ? 'public' : 'mutual'

  const friends = await friendsOf(user.id)
  const viewer = await optionalUser(event)

  let visible = friends

  if (visibility !== 'public') {
    if (!viewer) {
      visible = []
    }
    else if (viewer.id !== user.id) {
      const mine = new Set((await friendsOf(viewer.id)).map(f => f.id))
      visible = friends.filter(f => mine.has(f.id))
    }
  }

  const packs = await one<{ packs: number, downloads: number }>(
    `SELECT COUNT(*)::int AS packs, COALESCE(SUM(downloads), 0)::int AS downloads
     FROM shares WHERE owner_id = $1`,
    [user.id],
  )

  const since = new Date(Date.now() - 371 * 86_400_000).toISOString().slice(0, 10)
  const activity = await q<{ day: string, launches: number, seconds: number }>(
    `SELECT day, launches, seconds FROM user_activity
     WHERE user_id = $1 AND day >= $2 ORDER BY day`,
    [user.id, since],
  )

  const totals = await one<{ firstDay: string | null, seconds: number, activeDays: number }>(
    `SELECT MIN(day) AS "firstDay",
            COALESCE(SUM(seconds), 0)::int AS seconds,
            COUNT(*)::int AS "activeDays"
     FROM user_activity WHERE user_id = $1`,
    [user.id],
  )

  const week = await one<{ seconds: number }>(
    `SELECT COALESCE(SUM(seconds), 0)::int AS seconds FROM user_activity
     WHERE user_id = $1 AND day >= $2`,
    [user.id, new Date(Date.now() - 6 * 86_400_000).toISOString().slice(0, 10)],
  )

  const hidden = (user.presence ?? 'visible') === 'hidden'
  const lastSeen = hidden ? null : Number(user.lastSeen ?? 0) || null

  const badges = await badgesOf(user.id)

  const { friendsVisibility, presence, lastSeen: _raw, ...safe } = user

  return {
    user: safe,
    friends: visible,
    visibility,
    isOwner: viewer?.id === user.id,
    stats: {
      packs: packs?.packs ?? 0,
      downloads: packs?.downloads ?? 0,
      firstDay: totals?.firstDay ?? null,
      seconds: totals?.seconds ?? 0,
      activeDays: totals?.activeDays ?? 0,
      week: week?.seconds ?? 0,
      lastSeen,
    },
    activity,
    badges,
  }
})
