
export default defineEventHandler(async (event) => {
  // Deliberately a session-only route: a token must never be able to mint
  // another token, or a narrow leak widens itself.
  if (tokenFromEvent(event)) {
    throw createError({ statusCode: 403, statusMessage: 'tokens cannot create tokens' })
  }

  const me = await requireUser(event)
  rateLimit(event, { key: `token:${me.id}`, limit: 10, windowMs: 3_600_000 })

  const body = await readBody<{ name?: unknown, scopes?: unknown, expiresInDays?: unknown }>(event) ?? {}

  const { row, token } = await createToken({
    userId: me.id,
    name: String(body.name ?? ''),
    scopes: body.scopes,
    expiresInDays: Number(body.expiresInDays) || null,
  })

  // The only time the secret is ever returned.
  return { token, meta: publicToken(row) }
})
