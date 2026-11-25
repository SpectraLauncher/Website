
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
    pending_by: string | null
    name: string | null
    can_push: boolean | null
  }>(
    `SELECT s.code, s.owner_id, s.revision, s.uploaded, s.object_key, s.pending_key, s.pending_by,
            s.name, r.can_push
     FROM shares s LEFT JOIN share_recipient r ON r.code = s.code AND r.user_id = $2
     WHERE s.code = $1`,
    [code, me.id],
  )

  const role = row ? shareRole(row.owner_id, me.id, row.can_push) : null
  if (!row || !role) {
    throw createError({ statusCode: 404, statusMessage: 'no such share' })
  }
  if (!row.pending_key) {
    throw createError({ statusCode: 409, statusMessage: 'nothing was being uploaded' })
  }
  // An upload started before pending_by existed can only have been the owner's.
  if ((row.pending_by ?? row.owner_id) !== me.id) {
    throw createError({ statusCode: 409, statusMessage: 'this upload is out of date' })
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
    `UPDATE shares SET object_key = $1, pending_key = NULL, pending_at = NULL, pending_by = NULL,
            uploaded = TRUE,
            size = $2, revision = $3, expires = $4
     WHERE code = $5`,
    [row.pending_key, stored, revision, expires, code],
  )

  if (previous && previous !== row.pending_key) await r2Delete(r2, previous)

  if (role === 'collaborator') {
    await exec('UPDATE share_recipient SET imported_revision = $1 WHERE code = $2 AND user_id = $3',
      [revision, code, me.id])
  }

  if (revision > 1) {
    const recipients = await q<{ user_id: string }>(
      'SELECT user_id FROM share_recipient WHERE code = $1', [code])
    for (const userId of updateAudience(row.owner_id, recipients.map(r => r.user_id), me.id)) {
      await notify({
        userId,
        kind: 'instance_update',
        actorId: me.id,
        shareCode: code,
        data: { name: row.name, revision },
      })
    }
  }

  return { code, revision, expires, pushed: revision > 1 }
})
