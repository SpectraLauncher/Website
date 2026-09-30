export default defineEventHandler((event) => {
  const id = getRouterParam(event, 'id')
  const png = isSkinShareId(id) ? sharedSkinPng(id) : null
  if (!png) throw createError({ statusCode: 404, statusMessage: 'this skin is no longer here' })

  setResponseHeader(event, 'cache-control', 'no-store')
  return { png: png.toString('base64') }
})
