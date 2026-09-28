export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  rateLimit(event, { key: `launcher-sync-write:${user.id}`, limit: 12, windowMs: 60_000 })
  const r2 = useR2()
  if (!r2) throw createError({ statusCode: 501, statusMessage: 'cloud storage is not configured' })
  const body = await readBody<{ baseRevision?: number, key?: string }>(event) ?? {}
  if (!validRevision(body.baseRevision) || typeof body.key !== 'string' || body.key.length > 200)
    throw createError({ statusCode: 400, statusMessage: 'invalid sync request' })
  const current = await one<{ pending_key: string | null, pending_size: string | null, pending_at: string | null, object_key: string | null }>(
    'SELECT pending_key, pending_size, pending_at, object_key FROM launcher_cloud_sync WHERE user_id = $1 AND revision = $2',
    [user.id, body.baseRevision],
  )
  if (!current || current.pending_key !== body.key || !current.pending_at
      || Number(current.pending_at) < Date.now() - LAUNCHER_SYNC_PENDING_MS)
    throw createError({ statusCode: 409, statusMessage: 'sync upload is no longer current' })
  const size = await r2Size(r2, body.key)
  if (size === null || size !== Number(current.pending_size) || size > MAX_LAUNCHER_SYNC_BYTES)
    throw createError({ statusCode: 400, statusMessage: 'uploaded archive size does not match' })

  const updated = Date.now()
  const row = await one<{ revision: string }>(
    `UPDATE launcher_cloud_sync
     SET revision = revision + 1, object_key = $3, size = $4, updated = $5,
         pending_key = NULL, pending_size = NULL, pending_at = NULL
     WHERE user_id = $1 AND revision = $2 AND pending_key = $3
     RETURNING revision`,
    [user.id, body.baseRevision, body.key, size, updated],
  )
  if (!row) throw createError({ statusCode: 409, statusMessage: 'cloud copy changed during upload' })
  if (current.object_key && current.object_key !== body.key) await r2Delete(r2, current.object_key)
  return { revision: Number(row.revision), updated }
})
