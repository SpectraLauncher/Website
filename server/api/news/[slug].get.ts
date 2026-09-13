export default defineEventHandler(async (event) => {
  const post = await publishedArticle(String(getRouterParam(event, 'slug') ?? ''))
  if (!post) throw createError({ statusCode: 404, statusMessage: 'no such article' })

  // The reader's own picks come back with the counts, so the buttons are drawn
  // right on the first paint rather than filling in afterwards.
  const viewer = await optionalUser(event)

  return {
    article: publicPost(post),
    reactions: await reactionsFor(post.id, viewer?.id ?? null),
  }
})
