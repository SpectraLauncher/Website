
export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  const code = normalizeCode(getRouterParam(event, 'code'))

  const row = await one<{ owner_id: string | null, object_key: string | null }>(
    'SELECT owner_id, object_key FROM shares WHERE code = $1', [code])
  if (!row || row.owner_id !== me.id) {
    throw createError({ statusCode: 404, statusMessage: 'no such share' })
  }

  const r2 = useR2()
  if (row.object_key && r2) await r2Delete(r2, row.object_key)

  await exec(
    `UPDATE shares SET expires = $1, object_key = NULL, pending_key = NULL, pending_at = NULL
     WHERE code = $2`,
    [Date.now(), code],
  )
  await exec('DELETE FROM share_recipient WHERE code = $1', [code])

  return { ok: true }
})
