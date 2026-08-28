const UUID_RE = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i

interface MojangProfile { id: string, name: string }

export default defineCachedEventHandler(async (event) => {
  const q = String(getQuery(event).q ?? '').trim()

  if (!q) throw createError({ statusCode: 400, statusMessage: 'missing q' })
  if (q.length > 36) throw createError({ statusCode: 400, statusMessage: 'too long' })

  const isUuid = UUID_RE.test(q)
  if (!isUuid && !/^[A-Za-z0-9_]{1,16}$/.test(q)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid query' })
  }

  const url = isUuid
    ? `https://sessionserver.mojang.com/session/minecraft/profile/${q.replace(/-/g, '')}`
    : `https://api.mojang.com/users/profiles/minecraft/${encodeURIComponent(q)}`

  const profile = await $fetch<MojangProfile>(url).catch(() => null)
  if (!profile?.id) throw createError({ statusCode: 404, statusMessage: 'player not found' })

  return { uuid: profile.id, name: profile.name }
}, {
  maxAge: 60 * 60 * 6,
  getKey: event => 'profile:' + String(getQuery(event).q ?? '').toLowerCase()
})
