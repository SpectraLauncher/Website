
import type { H3Event } from 'h3'

import { r2Put, useR2 } from './r2'

// Images are re-encoded rather than stored as uploaded: whatever arrives is
// decoded by sharp and written back out as webp, so a file that is not really an
// image never reaches storage, and neither does anything hidden after the pixels.
export async function storeProjectImage(event: H3Event, options: {
  key: string
  size: number
  accepted: string[]
  maxBytes: number
  fit?: 'cover' | 'contain'
  // Recorded so the sweep can find this object again once its subject is gone.
  context?: ImageContext
  subjectId?: string | null
  ownerId?: string | null
}): Promise<string> {
  const r2 = useR2()
  if (!r2) throw createError({ statusCode: 501, statusMessage: 'image storage is not configured' })

  const contentType = String(getHeader(event, 'content-type') || '').split(';')[0]!.trim()
  if (!options.accepted.includes(contentType)) {
    throw createError({ statusCode: 415, statusMessage: 'png, jpeg or webp only' })
  }

  const body = await readRawBody(event, false)
  if (!body?.length) throw createError({ statusCode: 400, statusMessage: 'empty body' })
  if (body.length > options.maxBytes) {
    throw createError({ statusCode: 413, statusMessage: 'image too large' })
  }

  const image = await reencodeWebp(body, { size: options.size, fit: options.fit ?? 'cover' })

  try {
    await r2Put(r2, options.key, image, 'image/webp')
  } catch (e) {
    console.error('[catalog image]', e)
    throw createError({ statusCode: 502, statusMessage: 'could not store the image' })
  }

  if (options.context) {
    await recordImage({
      key: options.key,
      context: options.context,
      ownerId: options.ownerId ?? null,
      subjectId: options.subjectId ?? null,
      size: image.length,
    })
  }

  return `${r2.publicUrl}/${options.key}?v=${Date.now()}`
}
