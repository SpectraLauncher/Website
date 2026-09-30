const MAX_HASHES = 1000

export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)

  const body = await readBody<{ hashes?: unknown }>(event) ?? {}
  const hashes = (Array.isArray(body.hashes) ? body.hashes : [])
    .filter((h): h is string => typeof h === 'string')
    .map(h => h.toLowerCase())
    .filter(h => isHash(h, 'sha512'))

  if (hashes.length > MAX_HASHES) {
    throw createError({ statusCode: 400, statusMessage: `at most ${MAX_HASHES} hashes per request` })
  }

  return { revoked: await revokedAddonFiles([...new Set(hashes)]) }
})
