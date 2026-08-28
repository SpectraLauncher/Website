const UUID_RE = /^[0-9a-f]{32}$/i

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const source = String(query.source ?? '')
  const name = String(query.name ?? '').trim()
  const uuid = String(query.uuid ?? '').replace(/-/g, '').trim()

  if (!isModCapeSource(source)) throw createError({ statusCode: 400, statusMessage: 'unknown source' })
  if (!/^[A-Za-z0-9_]{1,16}$/.test(name)) throw createError({ statusCode: 400, statusMessage: 'invalid name' })
  if (!UUID_RE.test(uuid)) throw createError({ statusCode: 400, statusMessage: 'invalid uuid' })

  const encoded = await cachedModCape(source, name, uuid)
  if (!encoded) throw createError({ statusCode: 404, statusMessage: 'no cape' })

  setHeader(event, 'content-type', 'image/png')
  setHeader(event, 'cache-control', 'public, max-age=21600')
  setHeader(event, 'access-control-allow-origin', '*')
  return Buffer.from(encoded, 'base64')
})
