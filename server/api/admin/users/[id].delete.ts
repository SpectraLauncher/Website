
export default defineEventHandler(async (event) => {
  const staff = await requireAdmin(event)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'missing id' })

  const user = await one<{ id: string, username: string | null, email: string | null }>(
    'SELECT id, username, email FROM "user" WHERE id = $1', [id])
  if (!user) throw createError({ statusCode: 404, statusMessage: 'no such user' })

  await deleteAccount(id)

  // Written after the account is gone, which is why the log copies the name in
  // rather than joining it: there is nothing left to join to.
  await recordStaffAction({
    actor: staff,
    action: 'user.delete',
    subjectKind: 'user',
    subjectId: id,
    summary: `usunięte konto ${user.username ?? user.email ?? id}`,
  })

  return { ok: true }
})
