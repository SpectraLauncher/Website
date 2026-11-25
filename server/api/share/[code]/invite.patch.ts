
// Only the owner hands out or takes back the right to push.
export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  const code = normalizeCode(getRouterParam(event, 'code'))
  const { userId, canPush } = await readBody<{ userId?: string, canPush?: boolean }>(event) ?? {}
  if (typeof userId !== 'string' || typeof canPush !== 'boolean') {
    throw createError({ statusCode: 400, statusMessage: 'userId and canPush are required' })
  }

  const share = await one<{ owner_id: string | null, name: string | null, revision: number }>(
    'SELECT owner_id, name, revision FROM shares WHERE code = $1 AND expires > $2', [code, Date.now()])
  if (share?.owner_id !== me.id) throw createError({ statusCode: 404, statusMessage: 'no such share' })

  const before = await one<{ can_push: boolean }>(
    'SELECT can_push FROM share_recipient WHERE code = $1 AND user_id = $2', [code, userId])
  if (!before) throw createError({ statusCode: 404, statusMessage: 'not shared with this person' })

  await exec('UPDATE share_recipient SET can_push = $1 WHERE code = $2 AND user_id = $3',
    [canPush, code, userId])

  if (canPush && !before.can_push) {
    await notify({
      userId,
      kind: 'instance_collab',
      actorId: me.id,
      shareCode: code,
      data: { name: share.name, revision: share.revision },
    })
  }

  return { ok: true }
})
