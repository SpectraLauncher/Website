export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  rateLimit(event, { key: `launcher-sync-write:${user.id}`, limit: 12, windowMs: 60_000 })
  const r2 = useR2()
  if (!r2) throw createError({ statusCode: 501, statusMessage: 'cloud storage is not configured' })
  const body = await readBody<{ baseRevision?: number, size?: number }>(event) ?? {}
  if (!validRevision(body.baseRevision) || !Number.isSafeInteger(body.size) || !body.size || body.size < 1)
    throw createError({ statusCode: 400, statusMessage: 'invalid sync request' })
  if (body.size > MAX_LAUNCHER_SYNC_BYTES)
    throw createError({ statusCode: 413, statusMessage: 'sync archive is too large' })

  const now = Date.now()
  const key = launcherSyncKey(user.id)
  const uploadUrl = await r2SignedPut(r2, key, 1800)
  await exec('INSERT INTO launcher_cloud_sync (user_id) VALUES ($1) ON CONFLICT DO NOTHING', [user.id])
  const row = await one<{ revision: string }>(
    `UPDATE launcher_cloud_sync SET pending_key = $3, pending_size = $4, pending_at = $5
     WHERE user_id = $1 AND revision = $2
       AND (pending_key IS NULL OR pending_at < $6)
     RETURNING revision`,
    [user.id, body.baseRevision, key, body.size, now, now - LAUNCHER_SYNC_PENDING_MS],
  )
  if (!row) throw createError({ statusCode: 409, statusMessage: 'cloud copy changed or another upload is in progress' })
  return { key, uploadUrl }
})
