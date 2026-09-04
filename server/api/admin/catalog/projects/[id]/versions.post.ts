export default defineEventHandler(async (event) => {
  await requireCatalogWrite(event)

  const project = await projectByIdOrSlug(String(getRouterParam(event, 'id') ?? ''))
  if (!project) throw createError({ statusCode: 404, statusMessage: 'no such project' })

  const body = await readBody<VersionInput>(event) ?? {}
  const version = await createVersion(project.id, body)

  setResponseStatus(event, 201)
  return { version: shortVersion(version, []) }
})
