
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  rateLimit(event, { key: `oauth-authorize:${user.id}`, limit: 20, windowMs: 60_000 })

  const body = await readBody<{
    clientId?: unknown
    redirectUri?: unknown
    scope?: unknown
    state?: unknown
    approve?: unknown
  }>(event) ?? {}

  const client = await clientById(String(body.clientId ?? ''))
  if (!client) throw createError({ statusCode: 400, statusMessage: 'unknown client' })

  const redirect = pickRedirect(client.redirect_uris, body.redirectUri)
  if (!redirect) throw createError({ statusCode: 400, statusMessage: 'redirect_uri is not registered' })

  const state = cleanState(body.state)

  if (body.approve !== true) {
    return { redirect: buildRedirect(redirect, { error: 'access_denied', state }) }
  }

  const asked = body.scope
    ? expandImplied(scopesToMask(String(body.scope).split(/[\s,]+/)))
    : Number(client.max_scopes)

  // The client's ceiling is the last word, whatever the request asked for.
  if (asked & ~Number(client.max_scopes)) {
    return { redirect: buildRedirect(redirect, { error: 'invalid_scope', state }) }
  }

  await saveGrant(client.id, user.id, asked)

  const code = await issueCode({
    clientId: client.id,
    userId: user.id,
    scopes: asked,
    redirectUri: redirect,
  })

  return { redirect: buildRedirect(redirect, { code, state }) }
})
