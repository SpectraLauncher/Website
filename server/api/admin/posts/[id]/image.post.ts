const MAX_BYTES = 8 * 1024 * 1024


// A picture inside an article or an issue. Same store, same ownership record and
// the same sweep as a project's: recorded against the post, so when the post
// goes, or when the picture is taken out of it, the object goes too.
export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const post = await postById(String(getRouterParam(event, 'id') ?? ''))
  if (!post) throw createError({ statusCode: 404, statusMessage: 'no such post' })

  const url = await storeProjectImage(event, {
    key: `post/${post.id}/${newId()}.webp`,
    size: 1600,
    fit: 'inside',
    accepted: [...MOVING_IMAGE_TYPES],
    animated: true,
    maxBytes: MAX_BYTES,
    context: 'post',
    subjectId: post.id,
  })

  setResponseStatus(event, 201)
  return { url }
})
