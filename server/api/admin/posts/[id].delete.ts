export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  // Takes its pictures out of the bucket with it, rather than leaving them for
  // a sweep to find.
  await deletePost(String(getRouterParam(event, 'id') ?? ''))

  setResponseStatus(event, 204)
  return null
})
