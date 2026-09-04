export default defineEventHandler(async (event) => {
  const user = await requireCatalogRead(event)
  if (!user) throw createError({ statusCode: 404, statusMessage: 'no such organization' })

  const org = await orgBySlug(String(getRouterParam(event, 'slug') ?? ''))
  if (!org) throw createError({ statusCode: 404, statusMessage: 'no such organization' })

  const role = await isOrgMember(org.id, user.id)
  if (role !== 'owner' && role !== 'admin') {
    throw createError({ statusCode: 404, statusMessage: 'no such organization' })
  }

  rateLimit(event, { key: `org-invite:${user.id}`, limit: 10, windowMs: 60_000 })

  const body = await readBody<{ username?: unknown, role?: unknown }>(event) ?? {}
  const username = String(body.username ?? '').trim()
  if (!username) throw createError({ statusCode: 400, statusMessage: 'username is required' })

  const email = await emailForUsername(username)

  // Same answer whether the account exists or not: this form would otherwise
  // tell anyone which usernames are registered.
  if (!email) return { ok: true }

  const invited = body.role === 'admin' ? 'admin' : 'member'

  await useAuth().api.createInvitation({
    body: { email, role: invited, organizationId: org.id },
    headers: event.headers,
  }).catch((e: unknown) => {
    console.error('[org invite]', e)
  })

  return { ok: true }
})
