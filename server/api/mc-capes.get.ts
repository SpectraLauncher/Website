const UUID_RE = /^[0-9a-f]{32}$/i

export default defineCachedEventHandler(async (event) => {
  const query = getQuery(event)
  const name = String(query.name ?? '').trim()
  const uuid = String(query.uuid ?? '').replace(/-/g, '').trim()

  if (!/^[A-Za-z0-9_]{1,16}$/.test(name)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid name' })
  }
  if (!UUID_RE.test(uuid)) {
    throw createError({ statusCode: 400, statusMessage: 'invalid uuid' })
  }

  const [found, owned] = await Promise.all([
    Promise.all(CAPE_SOURCES.map(async source => ({
      source,
      exists: Boolean(await cachedModCape(source, name, uuid).catch(() => ''))
    }))),
    cachedOwnedCapes(uuid).catch(() => [])
  ])

  return {
    capes: found.filter(c => c.exists).map(c => ({ source: c.source })),
    owned
  }
}, {
  name: 'mc-capes',
  maxAge: 60 * 60 * 6,
  getKey: event => 'capes:' + String(getQuery(event).uuid ?? '').replace(/-/g, '').toLowerCase()
})
