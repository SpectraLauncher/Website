export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  rateLimit(event, { key: `launcher-sync-read:${user.id}`, limit: 30, windowMs: 60_000 })
  const row = await one<{ revision: string, object_key: string | null, size: string, updated: string | null }>(
    'SELECT revision, object_key, size, updated FROM launcher_cloud_sync WHERE user_id = $1', [user.id],
  )
  if (!row?.object_key) return { revision: 0, size: 0, updated: null, downloadUrl: null }
  const r2 = useR2()
  if (!r2) throw createError({ statusCode: 501, statusMessage: 'cloud storage is not configured' })
  return {
    revision: Number(row.revision), size: Number(row.size), updated: Number(row.updated),
    downloadUrl: await r2SignedGet(r2, row.object_key, 900),
  }
})
