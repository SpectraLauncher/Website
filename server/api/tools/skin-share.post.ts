export default defineEventHandler(async (event) => {
  rateLimit(event, { key: `skin-share:${clientIp(event)}`, limit: 30, windowMs: 3_600_000 })

  const body = await readRawBody(event, false)
  const png = body ? Buffer.from(body) : null
  if (!png || !isSkinPng(png)) {
    throw createError({ statusCode: 400, statusMessage: 'send a 64×64 or 64×32 skin as PNG' })
  }

  return { id: shareSkin(png) }
})
