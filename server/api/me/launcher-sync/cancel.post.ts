export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  rateLimit(event, { key: `launcher-sync-write:${user.id}`, limit: 12, windowMs: 60_000 })
  const body = await readBody<{ baseRevision?: number, key?: string }>(event) ?? {}
  if (!validRevision(body.baseRevision) || typeof body.key !== 'string' || body.key.length > 200)
    throw createError({ statusCode: 400, statusMessage: 'invalid sync request' })
  const row = await one<{ pending_key: string }>(
    `UPDATE launcher_cloud_sync SET pending_key = NULL, pending_size = NULL, pending_at = NULL
     WHERE user_id = $1 AND revision = $2 AND pending_key = $3
     RETURNING pending_key`,
    [user.id, body.baseRevision, body.key],
  )
  if (row) {
    const r2 = useR2()
    if (r2) await r2Delete(r2, row.pending_key)
  }
  return { canceled: Boolean(row) }
})
