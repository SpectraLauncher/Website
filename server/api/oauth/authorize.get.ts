
// What the consent screen needs to render. It answers, it does not redirect:
// the decision belongs to a page the person can read.
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const query = getQuery(event)

  const client = await clientById(String(query.client_id ?? ''))
  if (!client) throw createError({ statusCode: 400, statusMessage: 'unknown client' })

  // Refused here rather than redirected, because an unregistered redirect is
  // exactly the thing that must not receive anything.
  const redirect = pickRedirect(client.redirect_uris, query.redirect_uri)
  if (!redirect) throw createError({ statusCode: 400, statusMessage: 'redirect_uri is not registered' })

  const asked = query.scope
    ? expandImplied(scopesToMask(String(query.scope).split(/[\s,]+/)))
    : Number(client.max_scopes)

  if (asked & ~Number(client.max_scopes)) {
    return {
      error: 'scopes_too_broad',
      redirect: buildRedirect(redirect, {
        error: 'invalid_scope',
        state: cleanState(query.state),
      }),
    }
  }

  const existing = await grantFor(client.id, user.id)

  return {
    client: { id: client.id, name: client.name, icon: client.icon },
    scopes: maskToScopes(asked),
    redirect,
    state: cleanState(query.state),
    // Already agreed to at least this much before, so the screen can say so.
    known: Boolean(existing && (asked & ~existing.scopes) === 0),
  }
})
