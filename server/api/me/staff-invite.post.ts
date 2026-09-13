/**
 * Answer the offer.
 *
 * The role comes from the stored invitation, never from the request: a body
 * saying `role: 'owner'` has nothing to attach to. Accepting is idempotent —
 * the row is claimed in the same statement that reads it, so a replay finds
 * nothing pending and changes nothing.
 */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)

  const body = await readBody<{ accept?: unknown }>(event) ?? {}

  if (body.accept !== true) {
    return { role: null, declined: await declineInvite(user.id) }
  }

  const role = await acceptInvite(user.id)
  if (!role) throw createError({ statusCode: 409, statusMessage: 'no open invitation' })

  await recordStaffAction({
    actor: user,
    action: 'role.accept',
    subjectKind: 'user',
    subjectId: user.id,
    summary: `dołączył do zespołu jako ${role}`,
    meta: { role },
  })

  return { role, declined: false }
})
