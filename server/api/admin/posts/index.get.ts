export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const kind = getQuery(event).kind
  if (!isPostKind(kind)) throw createError({ statusCode: 400, statusMessage: 'unknown kind' })

  return { posts: (await postsOfKind(kind)).map(editablePost) }
})
