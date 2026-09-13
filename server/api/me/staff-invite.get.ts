// The offer this account has open, if any. Its own route rather than a field on
// the session: it is asked for once, by the one page that can answer it.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)

  const invite = await pendingInviteFor(user.id)
  return { invite: invite ? publicInvite(invite) : null }
})
