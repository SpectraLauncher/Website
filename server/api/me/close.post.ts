
export default defineEventHandler(async (event) => {
  // A leaked token must not be able to delete the account it was scoped to.
  if (tokenFromEvent(event)) {
    throw createError({ statusCode: 403, statusMessage: 'tokens cannot close an account' })
  }

  const me = await requireUser(event)
  const body = await readBody<{ confirm?: unknown }>(event) ?? {}

  // Typing the username is the confirmation. A yes/no dialog is too easy to
  // click through for something with no undo.
  if (String(body.confirm ?? '').trim().toLowerCase() !== String(me.username ?? '').toLowerCase()) {
    throw createError({ statusCode: 400, statusMessage: 'type your username to confirm' })
  }

  const blockers = await closureBlockers(me.id)
  if (blockers.length) {
    throw createError({ statusCode: 409, statusMessage: 'resolve the listed items first' })
  }

  await closeAccount(me.id)
  return { closed: true }
})
