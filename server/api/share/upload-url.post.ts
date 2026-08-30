
export default defineEventHandler(async (event) => {
  const cfg = useRuntimeConfig()

  const owner = await requireUser(event)
  rateLimit(event, { key: `share-upload:${owner.id}`, limit: 10, windowMs: 60_000 })

  const r2 = useR2()
  if (!r2) throw createError({ statusCode: 501, statusMessage: 'pack storage is not configured' })

  const body = await readBody<{
    size?: number
    name?: string
    mc?: string
    loader?: string
    mods?: number
    instance?: string
  }>(event) ?? {}

  const size = Number(body.size)
  if (!Number.isFinite(size) || size <= 0) {
    throw createError({ statusCode: 400, statusMessage: 'missing pack size' })
  }
  if (size > MAX_PACK_BYTES) {
    throw createError({
      statusCode: 413,
      statusMessage: `pack too large (${Math.round(size / 1048576)} MB, max ${MAX_PACK_BYTES / 1073741824} GB)`,
    })
  }

  await pruneShares()

  const now = Date.now()
  const instanceId = clampStr(body.instance, 64) ?? null
  const meta = {
    name: clampStr(body.name, 80) ?? 'Minecraft instance',
    mc_version: clampStr(body.mc, 24) ?? null,
    loader: clampStr(body.loader, 24) ?? null,
    mods: Number(body.mods) || 0,
  }

  const existing = instanceId
    ? await one<{ code: string, revision: number, uploaded: boolean }>(
      'SELECT code, revision, uploaded FROM shares WHERE owner_id = $1 AND instance_id = $2',
      [owner.id, instanceId],
    )
    : undefined

  let code: string
  let revision: number

  if (existing) {
    code = existing.code
    revision = existing.uploaded ? existing.revision + 1 : existing.revision
    await exec(
      `UPDATE shares SET name = $1, mc_version = $2, loader = $3, mods = $4,
              pending_key = $5, pending_at = $6 WHERE code = $7`,
      [meta.name, meta.mc_version, meta.loader, meta.mods, packKey(code, revision), now, code],
    )
  } else {
    code = await newCode()
    revision = 1
    await exec(
      `INSERT INTO shares (code, created, expires, name, mc_version, loader, mods, size,
                           owner_id, instance_id, revision, uploaded, pending_key, pending_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8, $9, 1, FALSE, $10, $2)`,
      [code, now, expiryFor(now), meta.name, meta.mc_version, meta.loader, meta.mods,
        owner.id, instanceId, packKey(code, revision)],
    )
  }

  return {
    code,
    revision,
    url: `${cfg.public.siteUrl}/s/${code}`,
    uploadUrl: await r2SignedPut(r2, packKey(code, revision), UPLOAD_URL_TTL),
    maxBytes: MAX_PACK_BYTES,
  }
})
