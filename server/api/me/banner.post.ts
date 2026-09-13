import { r2Put } from '../../utils/r2'

// Wide rather than square: it sits behind the profile the way a project wears
// its feature image, so the shape is the shape of the page, not of an avatar.
const MAX_BYTES = 6 * 1024 * 1024
const WIDTH = 1600

export default defineEventHandler(async (event) => {
  const me = await requireUser(event)

  const r2 = useR2()
  if (!r2) throw createError({ statusCode: 501, statusMessage: 'banner uploads are not configured' })

  const contentType = String(getHeader(event, 'content-type') || '').split(';')[0]!.trim()
  if (!(MOVING_IMAGE_TYPES as readonly string[]).includes(contentType)) {
    throw createError({
      statusCode: 415,
      statusMessage: `${acceptedLabel(MOVING_IMAGE_TYPES)} only`,
    })
  }

  const body = await readRawBody(event, false)
  if (!body?.length) throw createError({ statusCode: 400, statusMessage: 'empty body' })
  if (body.length > MAX_BYTES) throw createError({ statusCode: 413, statusMessage: 'image too large' })

  // 'inside' bounds the longest side and leaves the shape alone: a banner that
  // came back cropped to a square would be nobody's banner.
  const image = await reencodeWebp(body, { size: WIDTH, fit: 'inside', animated: true })

  const key = `banners/${me.id}.webp`
  await recordImage({ key, context: 'user', ownerId: me.id, subjectId: me.id, size: image.length })

  try {
    await r2Put(r2, key, image, 'image/webp')
  }
  catch (e) {
    console.error('[banner]', e)
    throw createError({ statusCode: 502, statusMessage: 'could not store the image' })
  }

  const url = `${r2.publicUrl}/${key}?v=${Date.now()}`
  await exec('UPDATE "user" SET banner = $1 WHERE id = $2', [url, me.id])
  return { url }
})
