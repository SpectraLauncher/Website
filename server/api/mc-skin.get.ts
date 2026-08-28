export default defineCachedEventHandler(async (event) => {
  const q = String(getQuery(event).q ?? '').trim()

  if (!q) throw createError({ statusCode: 400, statusMessage: 'missing q' })
  if (q.length > 36) throw createError({ statusCode: 400, statusMessage: 'too long' })
  if (!isValidLookup(q)) throw createError({ statusCode: 400, statusMessage: 'invalid query' })

  const profile = await resolveProfile(q)
  if (!profile) throw createError({ statusCode: 404, statusMessage: 'player not found' })

  return profile
}, {
  name: 'mc-skin',
  maxAge: 60 * 60 * 6,
  getKey: event => 'skin:' + String(getQuery(event).q ?? '').toLowerCase()
})
