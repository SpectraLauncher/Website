/**
 * Offer somebody a place on the team.
 *
 * Owner only, the same as changing a role directly — an invitation that anybody
 * could send would be the same hole with an extra click in front of it.
 */
export default defineEventHandler(async (event) => {
  const staff = await requireOwner(event)

  const body = await readBody<{ username?: unknown, role?: unknown }>(event) ?? {}
  const username = String(body.username ?? '').trim().toLowerCase()

  if (!isInvitableRole(body.role)) {
    throw createError({ statusCode: 400, statusMessage: 'unknown role' })
  }

  const target = await one<{ id: string, username: string | null, role: string | null }>(
    'SELECT id, username, role FROM "user" WHERE lower(username) = $1', [username])
  if (!target) throw createError({ statusCode: 404, statusMessage: 'no such account' })

  const invite = await createInvite(target, body.role, staff)

  // Both channels, whatever the account has chosen: see ALWAYS_MAILED.
  await notify({ userId: target.id, kind: 'staff_invite', actorId: staff.id })

  await recordStaffAction({
    actor: staff,
    action: 'role.invite',
    subjectKind: 'user',
    subjectId: target.id,
    summary: `${target.username ?? target.id} zaproszony jako ${invite.role}`,
    meta: { role: invite.role, inviteId: invite.id },
  })

  return { invite: publicInvite(invite) }
})
