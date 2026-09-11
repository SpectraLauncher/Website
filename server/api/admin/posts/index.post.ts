export default defineEventHandler(async (event) => {
  const admin = await requireAdmin(event)

  const body = await readBody<{ kind?: unknown }>(event) ?? {}
  if (!isPostKind(body.kind)) throw createError({ statusCode: 400, statusMessage: 'unknown kind' })

  setResponseStatus(event, 201)
  return { post: editablePost(await createPost(body.kind, admin.id)) }
})
