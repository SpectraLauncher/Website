export default defineEventHandler(async (event) => {
  const body = await readBody<{ token?: unknown }>(event) ?? {}
  const token = String(body.token ?? '')

  if (!token) throw createError({ statusCode: 400, statusMessage: 'no token' })

  // The same answer either way: a token already used, or never real, must not
  // become a way to test tokens.
  await confirmByToken(token)
  return { ok: true }
})
