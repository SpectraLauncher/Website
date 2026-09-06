
// The application, not the browser, calls this — it carries the client secret.
export default defineEventHandler(async (event) => {
  const body = await readBody<Record<string, unknown>>(event) ?? {}

  if (String(body.grant_type ?? '') !== 'authorization_code') {
    throw createError({ statusCode: 400, statusMessage: 'unsupported grant_type' })
  }

  const client = await clientById(String(body.client_id ?? ''))
  if (!client || !verifySecret(client, String(body.client_secret ?? ''))) {
    throw createError({ statusCode: 401, statusMessage: 'bad client credentials' })
  }

  rateLimit(event, { key: `oauth-token:${client.id}`, limit: 60, windowMs: 60_000 })

  const redirectUri = String(body.redirect_uri ?? '')
  const redeemed = await redeemCode({
    code: String(body.code ?? ''),
    clientId: client.id,
    redirectUri,
  })

  // One answer for expired, already used, wrong client and wrong redirect: none
  // of them should tell the caller which of the four it was.
  if (!redeemed) throw createError({ statusCode: 400, statusMessage: 'invalid_grant' })

  const { token, expiresIn } = await issueOAuthToken({
    clientId: client.id,
    userId: redeemed.userId,
    scopes: redeemed.scopes,
  })

  return {
    access_token: token,
    token_type: 'Bearer',
    expires_in: expiresIn,
    scope: maskToScopes(redeemed.scopes).join(' '),
  }
})
