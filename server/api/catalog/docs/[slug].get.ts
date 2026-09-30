export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)

  const slug = String(getRouterParam(event, 'slug') ?? '')
  if (!CATALOG_DOC_PAGES.includes(slug)) throw createError({ statusCode: 404, statusMessage: 'no such page' })

  const wanted = getQuery(event).locale === 'pl' ? 'pl' : 'en'
  const storage = useStorage('assets:server')
  for (const locale of [wanted, 'en']) {
    const raw = await storage.getItemRaw(`manual:${locale}:${slug}.md`)
    if (raw) return { markdown: typeof raw === 'string' ? raw : Buffer.from(raw as Uint8Array).toString('utf8') }
  }
  throw createError({ statusCode: 404, statusMessage: 'no such page' })
})
