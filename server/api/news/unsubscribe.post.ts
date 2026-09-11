export default defineEventHandler(async (event) => {
  const body = await readBody<{ token?: unknown }>(event) ?? {}
  const token = String(body.token ?? '')

  if (!token) throw createError({ statusCode: 400, statusMessage: 'no token' })

  // The same answer either way: a token that was already used, or never
  // existed, must not become a way to test tokens.
  await unsubscribeByToken(token)
  return { ok: true }
})
