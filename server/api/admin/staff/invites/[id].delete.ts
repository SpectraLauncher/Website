export default defineEventHandler(async (event) => {
  const staff = await requireOwner(event)

  const invite = await revokeInvite(String(getRouterParam(event, 'id') ?? ''))
  if (!invite) throw createError({ statusCode: 404, statusMessage: 'no open invitation' })

  await recordStaffAction({
    actor: staff,
    action: 'role.uninvite',
    subjectKind: 'user',
    subjectId: invite.user_id,
    summary: `cofnięte zaproszenie na ${invite.role}`,
    meta: { role: invite.role, inviteId: invite.id },
  })

  setResponseStatus(event, 204)
  return null
})
