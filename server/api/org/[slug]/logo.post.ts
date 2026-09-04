const MAX_BYTES = 2 * 1024 * 1024
const ACCEPTED = ['image/webp', 'image/png', 'image/jpeg']
const SIZE = 256

export default defineEventHandler(async (event) => {
  const user = await requireCatalogRead(event)
  if (!user) throw createError({ statusCode: 404, statusMessage: 'no such organization' })

  const org = await orgBySlug(String(getRouterParam(event, 'slug') ?? ''))
  if (!org) throw createError({ statusCode: 404, statusMessage: 'no such organization' })

  const role = await isOrgMember(org.id, user.id)
  if (role !== 'owner' && role !== 'admin' && !isAdmin(user)) {
    throw createError({ statusCode: 404, statusMessage: 'no such organization' })
  }

  const r2 = useR2()
  if (!r2) throw createError({ statusCode: 501, statusMessage: 'logo uploads are not configured' })

  const contentType = String(getHeader(event, 'content-type') || '').split(';')[0]!.trim()
  if (!ACCEPTED.includes(contentType)) {
    throw createError({ statusCode: 415, statusMessage: 'png, jpeg or webp only' })
  }

  const body = await readRawBody(event, false)
  if (!body?.length) throw createError({ statusCode: 400, statusMessage: 'empty body' })
  if (body.length > MAX_BYTES) throw createError({ statusCode: 413, statusMessage: 'image too large' })

  const image = await reencodeWebp(body, { size: SIZE, fit: 'cover' })
  const key = `orgs/${org.id}.webp`

  try {
    await r2Put(r2, key, image, 'image/webp')
  } catch (e) {
    console.error('[org logo]', e)
    throw createError({ statusCode: 502, statusMessage: 'could not store the image' })
  }

  const url = `${r2.publicUrl}/${key}?v=${Date.now()}`
  await exec('UPDATE organization SET logo = $2 WHERE id = $1', [org.id, url])
  return { logo: url }
})
