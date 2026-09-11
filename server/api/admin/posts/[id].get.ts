export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const post = await postById(String(getRouterParam(event, 'id') ?? ''))
  if (!post) throw createError({ statusCode: 404, statusMessage: 'no such post' })

  return { post: editablePost(post) }
})
