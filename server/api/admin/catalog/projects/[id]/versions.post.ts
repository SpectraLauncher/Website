export default defineEventHandler(async (event) => {
  const admin = await requireCatalogWrite(event)

  const project = await projectByIdOrSlug(String(getRouterParam(event, 'id') ?? ''))
  if (!project) throw createError({ statusCode: 404, statusMessage: 'no such project' })

  await requireHeadroom(project.id, 'versionsPerProject', project.owner_id ?? admin.id)

  const body = await readBody<VersionInput>(event) ?? {}
  const version = await createVersion(project.id, body)

  setResponseStatus(event, 201)
  return { version: shortVersion(version, []) }
})
