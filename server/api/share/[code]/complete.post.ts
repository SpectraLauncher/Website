
export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  const code = normalizeCode(getRouterParam(event, 'code'))

  const row = await one<{
    code: string
    owner_id: string | null
    revision: number
    uploaded: boolean
    object_key: string | null
    pending_key: string | null
    name: string | null
  }>(
    'SELECT code, owner_id, revision, uploaded, object_key, pending_key, name FROM shares WHERE code = $1',
    [code],
  )

  if (!row || row.owner_id !== me.id) {
    throw createError({ statusCode: 404, statusMessage: 'no such share' })
  }
  if (!row.pending_key) {
    throw createError({ statusCode: 409, statusMessage: 'nothing was being uploaded' })
  }

  const revision = row.uploaded ? row.revision + 1 : row.revision
  if (row.pending_key !== packKey(code, revision)) {
    throw createError({ statusCode: 409, statusMessage: 'this upload is out of date' })
  }

  const r2 = useR2()
  if (!r2) throw createError({ statusCode: 501, statusMessage: 'pack storage is not configured' })

  const stored = await r2Size(r2, row.pending_key)
  if (stored === null) {
    throw createError({ statusCode: 409, statusMessage: 'the pack never arrived in storage' })
  }
  if (stored > MAX_PACK_BYTES) {
    await r2Delete(r2, row.pending_key)
    await exec('UPDATE shares SET pending_key = NULL, pending_at = NULL WHERE code = $1', [code])
    throw createError({
      statusCode: 413,
      statusMessage: `pack too large (${Math.round(stored / 1048576)} MB, max ${MAX_PACK_BYTES / 1073741824} GB)`,
    })
  }

  const previous = row.object_key
  const now = Date.now()
  const expires = expiryFor(now)
  await exec(
    `UPDATE shares SET object_key = $1, pending_key = NULL, pending_at = NULL, uploaded = TRUE,
            size = $2, revision = $3, expires = $4
     WHERE code = $5`,
    [row.pending_key, stored, revision, expires, code],
  )

  if (previous && previous !== row.pending_key) await r2Delete(r2, previous)

  if (revision > 1) {
    const recipients = await q<{ user_id: string }>(
      'SELECT user_id FROM share_recipient WHERE code = $1', [code])
    for (const r of recipients) {
      await notify({
        userId: r.user_id,
        kind: 'instance_update',
        actorId: me.id,
        shareCode: code,
        data: { name: row.name, revision },
      })
    }
  }

  return { code, revision, expires, pushed: revision > 1 }
})
