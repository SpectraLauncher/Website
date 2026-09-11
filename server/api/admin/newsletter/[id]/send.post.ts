export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const post = await postById(String(getRouterParam(event, 'id') ?? ''))
  if (!post || post.kind !== 'newsletter') {
    throw createError({ statusCode: 404, statusMessage: 'no such issue' })
  }

  if (!post.title.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'the issue needs a subject' })
  }

  const origin = String(useRuntimeConfig().public.siteUrl).replace(/\/$/, '')
  return { queued: await sendIssue(post, origin) }
})
