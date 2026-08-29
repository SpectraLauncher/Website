
import { r2Delete, r2Put, useR2 } from '../../../utils/r2'

const MAX_BYTES = 512 * 1024
const ACCEPTED = ['image/webp', 'image/png', 'image/jpeg']
const STALE = ['png', 'jpg', 'jpeg']
const SIZE = 256

export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const r2 = useR2()
  if (!r2) throw createError({ statusCode: 501, statusMessage: 'przechowywanie plikow nie jest skonfigurowane' })

  const slug = String(getQuery(event).slug ?? '').trim().toLowerCase()
  if (!/^[a-z0-9][a-z0-9-]{1,38}$/.test(slug)) {
    throw createError({ statusCode: 400, statusMessage: 'najpierw podaj poprawny slug odznaki' })
  }

  const contentType = String(getHeader(event, 'content-type') || '').split(';')[0]!.trim()
  if (!ACCEPTED.includes(contentType)) {
    throw createError({ statusCode: 415, statusMessage: 'tylko png, jpeg albo webp' })
  }

  const body = await readRawBody(event, false)
  if (!body?.length) throw createError({ statusCode: 400, statusMessage: 'pusty plik' })
  if (body.length > MAX_BYTES) throw createError({ statusCode: 413, statusMessage: 'obrazek jest za duzy' })

  const image = await reencodeWebp(body, { size: SIZE, fit: 'contain' })
  const key = `badges/${slug}.webp`

  try {
    await r2Put(r2, key, image, 'image/webp')
  }
  catch (e) {
    console.error('[badge image]', e)
    throw createError({ statusCode: 502, statusMessage: 'nie udalo sie zapisac obrazka' })
  }

  for (const other of STALE) {
    await r2Delete(r2, `badges/${slug}.${other}`)
      .catch(e => console.error('[badge image] stale', other, e))
  }

  return { url: `${r2.publicUrl}/${key}?v=${Date.now()}` }
})
