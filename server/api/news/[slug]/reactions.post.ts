/**
 * Pick a reaction, or take it back.
 *
 * Signing in is the whole rate limit: one row per person per kind, enforced by
 * the key. Letting anonymous readers react would mean counting something —
 * addresses, a cookie — that anybody can produce more of.
 */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)

  const post = await publishedArticle(String(getRouterParam(event, 'slug') ?? ''))
  if (!post) throw createError({ statusCode: 404, statusMessage: 'no such article' })

  const body = await readBody<{ kind?: unknown }>(event) ?? {}
  if (!isReaction(body.kind)) {
    throw createError({ statusCode: 400, statusMessage: 'unknown reaction' })
  }

  await toggleReaction(post.id, user.id, body.kind)

  return { reactions: await reactionsFor(post.id, user.id) }
})
