export default defineEventHandler(async (event) => {
  const post = await publishedArticle(String(getRouterParam(event, 'slug') ?? ''))
  if (!post) throw createError({ statusCode: 404, statusMessage: 'no such article' })

  return { article: publicPost(post) }
})
