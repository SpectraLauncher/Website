export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)
  const user = await requireUser(event)

  rateLimit(event, { key: `verification:${user.id}`, limit: 5, windowMs: 60_000 })

  const body = await readBody<{
    kind?: unknown
    orgSlug?: unknown
    body?: unknown
    links?: unknown
  }>(event) ?? {}

  if (!isVerificationKind(body.kind)) {
    throw createError({ statusCode: 400, statusMessage: 'unknown application kind' })
  }

  const text = typeof body.body === 'string' ? body.body.trim().slice(0, 4000) : ''
  if (text.length < 40) {
    throw createError({ statusCode: 400, statusMessage: 'tell us a little more than that' })
  }

  const links: Record<string, string> = {}
  if (body.links && typeof body.links === 'object' && !Array.isArray(body.links)) {
    for (const [key, value] of Object.entries(body.links as Record<string, unknown>)) {
      if (typeof value === 'string' && value.trim()) {
        links[key.slice(0, 40)] = value.trim().slice(0, 500)
      }
    }
  }

  let userId: string | null = user.id
  let orgId: string | null = null

  if (body.kind === 'organization') {
    const org = await orgBySlug(String(body.orgSlug ?? ''))
    if (!org) throw createError({ statusCode: 404, statusMessage: 'no such organization' })

    // Only an owner may put the organization forward, because approval changes
    // what it is charged.
    const role = await isOrgMember(org.id, user.id)
    if (role !== 'owner') {
      throw createError({ statusCode: 404, statusMessage: 'no such organization' })
    }

    userId = null
    orgId = org.id
  }

  if (await openRequestFor(userId, orgId)) {
    throw createError({ statusCode: 409, statusMessage: 'an application is already open' })
  }

  const row = await submitRequest({ kind: body.kind, userId, orgId, body: text, links })
  setResponseStatus(event, 201)
  return { request: publicRequest(row) }
})
