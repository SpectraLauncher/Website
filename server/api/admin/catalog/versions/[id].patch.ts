export default defineEventHandler(async (event) => {
  await requireCatalogWrite(event)

  const id = String(getRouterParam(event, 'id') ?? '')
  if (!isPublicId(id)) throw createError({ statusCode: 404, statusMessage: 'no such version' })

  const body = await readBody<VersionInput>(event) ?? {}
  const version = await updateVersion(id, body)

  return { version: shortVersion(version, await filesOf(id)) }
})
