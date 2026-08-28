
export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  const code = normalizeCode(getRouterParam(event, 'code'))

  const row = await one<{ owner_id: string | null, expires: string }>(
    'SELECT owner_id, expires FROM shares WHERE code = $1', [code])
  if (!row || row.owner_id !== me.id) {
    throw createError({ statusCode: 404, statusMessage: 'no such share' })
  }

  const now = Date.now()
  const expires = Number(row.expires)
  if (expires < now) {
    throw createError({ statusCode: 410, statusMessage: 'this code has already expired' })
  }
  if (expires - now > EXTEND_WINDOW_MS) {
    throw createError({
      statusCode: 409,
      statusMessage: `too early — you can extend in the last ${EXTEND_WINDOW_MS / 3_600_000} hours`,
    })
  }

  const next = expiryFor(now)
  await exec('UPDATE shares SET expires = $1 WHERE code = $2', [next, code])
  await pruneShares()

  return { code, expires: next }
})
