export default defineEventHandler(async (event) => {
  const admin = await requireCatalogWrite(event)
  rateLimit(event, { key: `catalog-upload:${admin.id}`, limit: 30, windowMs: 60_000 })

  const filename = safeFilename(String(getQuery(event).filename ?? 'file'))

  const body = await readRawBody(event, false)
  if (!body?.length) throw createError({ statusCode: 400, statusMessage: 'empty body' })

  const stored = await storeContent(body, filename)
  const analysis = await analyzeUpload(body, stored.filename, stored.sha512)

  return { file: { ...stored, url: publicContentUrl(stored.key) }, analysis }
})
