
export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const query = getQuery(event)
  const search = String(query.q ?? '').trim().toLowerCase()
  const limit = Math.min(Math.max(Number(query.limit) || 100, 1), 500)

  const rows = await q<{
    id: string
    name: string | null
    username: string | null
    email: string
    image: string | null
    emailVerified: boolean
    banned: boolean | null
    mcUsername: string | null
    createdAt: string
    lastSeen: string | null
    friends: number
    shares: number
  }>(
    `SELECT u.id, u.name, u.username, u.email, u.image, u."emailVerified", u.banned,
            u."mcUsername", u."createdAt", u."lastSeen",
            (SELECT count(*)::int FROM friendship f
              WHERE f.status = 'accepted' AND (f.requester_id = u.id OR f.addressee_id = u.id)) AS friends,
            (SELECT count(*)::int FROM shares s WHERE s.owner_id = u.id) AS shares
     FROM "user" u
     WHERE $1 = ''
        OR lower(u.email) LIKE '%' || $1 || '%' ESCAPE '\'
        OR lower(coalesce(u.username, '')) LIKE '%' || $1 || '%' ESCAPE '\'
        OR lower(coalesce(u.name, '')) LIKE '%' || $1 || '%' ESCAPE '\'
        OR lower(coalesce(u."mcUsername", '')) LIKE '%' || $1 || '%' ESCAPE '\'
     ORDER BY u."createdAt" DESC
     LIMIT $2`,
    [search.replace(/[\\%_]/g, c => `\\${c}`), limit],
  )

  const total = await one<{ n: number }>('SELECT count(*)::int AS n FROM "user"')

  return {
    total: total?.n ?? 0,
    users: rows.map(r => ({
      ...r,
      banned: !!r.banned,
      createdAt: new Date(r.createdAt).getTime(),
      lastSeen: r.lastSeen ? Number(r.lastSeen) : null,
    })),
  }
})
