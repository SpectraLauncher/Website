// The public article list. No gate: the blog is not the catalog, and it is the
// one part of this that is meant to be read before anybody signs in.
export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const limit = Math.min(Math.max(Number(query.limit) || 12, 1), 50)
  const offset = Math.max(Number(query.offset) || 0, 0)

  return {
    articles: (await publishedArticles(limit, offset)).map(postCard),
    total: await countPublishedArticles(),
  }
})
