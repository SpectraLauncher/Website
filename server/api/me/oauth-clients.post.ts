
export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  rateLimit(event, { key: `oauth-client:${me.id}`, limit: 5, windowMs: 3_600_000 })

  const body = await readBody<Record<string, unknown>>(event) ?? {}

  const { row, secret } = await createClient({
    ownerId: me.id,
    name: String(body.name ?? ''),
    redirectUris: body.redirectUris,
    scopes: body.scopes,
  })

  // The only time the secret is returned.
  return { client: publicClient(row), secret }
})
