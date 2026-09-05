
export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)
  const user = await requireUser(event)

  const project = await projectByIdOrSlug(String(getRouterParam(event, 'slug') ?? ''))
  if (!await visibleProject(project, user)) {
    throw createError({ statusCode: 404, statusMessage: 'no such project' })
  }

  await commentRateLimit(event, user.id)

  const body = await readBody<{ body?: unknown, parentId?: unknown }>(event) ?? {}
  const parentId = body.parentId ? String(body.parentId) : null

  const { id } = await addComment({
    projectId: project!.id,
    authorId: user.id,
    body: cleanBody(body.body),
    parentId,
  })

  await notifyComment({ project: project!, actorId: user.id, parentId })

  return { id }
})
