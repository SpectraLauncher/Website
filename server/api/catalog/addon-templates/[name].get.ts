export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)

  const name = String(getRouterParam(event, 'name') ?? '').replace(/\.zip$/, '')
  if (!isAddonTemplate(name)) throw createError({ statusCode: 404, statusMessage: 'no such template' })

  const storage = useStorage('assets:server')
  const prefix = `addon-templates:${name}:`
  const keys = (await storage.getKeys(`addon-templates:${name}`)).filter(key => key.startsWith(prefix)).sort()

  const files = await Promise.all(keys.map(async (key) => {
    const raw = await storage.getItemRaw(key)
    return {
      name: key.slice(prefix.length).split(':').join('/'),
      data: typeof raw === 'string' ? Buffer.from(raw) : Buffer.from(raw as Uint8Array),
    }
  }))
  if (!files.length) throw createError({ statusCode: 404, statusMessage: 'no such template' })

  setResponseHeaders(event, {
    'content-type': 'application/zip',
    'content-disposition': `attachment; filename="spectra-addon-${name}.zip"`,
  })
  return writeZip(files)
})
