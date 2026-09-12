export default defineEventHandler(async (event) => {
  const staff = await requireAdmin(event)

  const id = String(getRouterParam(event, 'id') ?? '')
  const post = await postById(id)

  // Takes its pictures out of the bucket with it, rather than leaving them for
  // a sweep to find.
  await deletePost(id)

  if (post) {
    await recordStaffAction({
      actor: staff,
      action: 'post.delete',
      subjectKind: 'post',
      subjectId: id,
      summary: post.title || id,
      meta: { kind: post.kind },
    })
  }

  setResponseStatus(event, 204)
  return null
})
