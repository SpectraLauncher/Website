export default defineEventHandler(async (event) => {
  await requireCatalogWrite(event)

  const id = String(getRouterParam(event, 'id') ?? '')
  if (!isPublicId(id)) throw createError({ statusCode: 404, statusMessage: 'no such version' })

  const version = await versionById(id)
  if (!version) throw createError({ statusCode: 404, statusMessage: 'no such version' })

  const body = await readBody<{
    filename?: string
    size?: number
    sha1?: string
    sha512?: string
    primary?: boolean
  }>(event) ?? {}

  const sha1 = String(body.sha1 ?? '')
  const sha512 = String(body.sha512 ?? '')
  const size = Number(body.size)

  if (!/^[0-9a-f]{40}$/.test(sha1) || !/^[0-9a-f]{128}$/.test(sha512)) {
    throw createError({ statusCode: 400, statusMessage: 'malformed hashes' })
  }
  if (!Number.isFinite(size) || size <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'malformed size' })
  }

  const filename = safeFilename(String(body.filename ?? ''))
  const key = contentKey(sha512, filename)

  // The object has to already be in storage, put there by the analyze route.
  // Size is checked with it, so a descriptor cannot point at a different file
  // than the one that was uploaded.
  //
  // sha1 is taken on the caller's word because recomputing it means
  // pulling the object back out of R2. Fine while writes are admin-only; the
  // open-upload stage has to hash server-side instead.
  if (!await contentExists(key, size)) {
    throw createError({ statusCode: 409, statusMessage: 'upload the file first' })
  }

  const file = await attachFile(version.id, {
    filename,
    size,
    sha1,
    sha512,
    key,
    primary: body.primary !== false,
  })

  // The bytes are already in storage, so the scan reads them back off the
  // request path rather than making the upload wait on it.
  queueScan(file.id)

  setResponseStatus(event, 201)
  return { file: publicFile(file) }
})
