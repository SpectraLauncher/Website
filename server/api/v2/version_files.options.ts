export default defineEventHandler((event) => {
  // A preflight carries no credentials, so it cannot ask who is calling — but
  // answering 204 would still confirm the route exists to anyone who probes it.
  // While the catalog is closed, it does not.
  if (!catalogIsPublic()) throw createError({ statusCode: 404, statusMessage: 'not found' })

  setHeader(event, 'access-control-allow-origin', '*')
  setHeader(event, 'access-control-allow-methods', 'POST, OPTIONS')
  setHeader(event, 'access-control-allow-headers', 'content-type')
  setHeader(event, 'access-control-max-age', '86400')
  setResponseStatus(event, 204)
  return null
})
