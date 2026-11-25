
export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  const code = normalizeCode(getRouterParam(event, 'code'))
  const { userIds, canPush } = await readBody<{ userIds?: string[], canPush?: boolean }>(event) ?? {}

  const share = await one<{
    code: string
    name: string | null
    owner_id: string | null
    revision: number
    can_push: boolean | null
  }>(
    `SELECT s.code, s.name, s.owner_id, s.revision, r.can_push
     FROM shares s LEFT JOIN share_recipient r ON r.code = s.code AND r.user_id = $3
     WHERE s.code = $1 AND s.expires > $2`,
    [code, Date.now(), me.id],
  )
  const role = share ? shareRole(share.owner_id, me.id, share.can_push) : null
  if (!share || !role) {
    throw createError({ statusCode: 404, statusMessage: 'no such share' })
  }

  // Collaborators bring in their own friends, but only the owner hands out the
  // right to push.
  const grant = role === 'owner' && canPush === true

  let sent = 0
  for (const userId of (userIds ?? []).slice(0, 50)) {
    if (typeof userId !== 'string' || userId === share.owner_id) continue
    if (!(await areFriends(me.id, userId))) continue
    await exec(
      `INSERT INTO share_recipient (code, user_id, sent, can_push) VALUES ($1, $2, $3, $4)
       ON CONFLICT (code, user_id) DO UPDATE
         SET sent = EXCLUDED.sent, can_push = share_recipient.can_push OR EXCLUDED.can_push`,
      [code, userId, Date.now(), grant],
    )
    await notify({
      userId,
      kind: grant ? 'instance_collab' : 'instance_invite',
      actorId: me.id,
      shareCode: code,
      data: { name: share.name, revision: share.revision },
    })
    sent++
  }

  return { sent }
})
