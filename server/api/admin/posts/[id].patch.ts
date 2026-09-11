export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = String(getRouterParam(event, 'id') ?? '')
  if (!await postById(id)) throw createError({ statusCode: 404, statusMessage: 'no such post' })

  const body = await readBody<PostInput>(event) ?? {}
  return { post: editablePost(await updatePost(id, body)) }
})
