export default defineEventHandler(async (event) => {
  const user = await requireCatalogRead(event)
  if (!user) throw createError({ statusCode: 404, statusMessage: 'no such organization' })

  const org = await orgBySlug(String(getRouterParam(event, 'slug') ?? ''))
  if (!org) throw createError({ statusCode: 404, statusMessage: 'no such organization' })

  const role = await isOrgMember(org.id, user.id)
  if (role !== 'owner' && role !== 'admin' && !isAdmin(user)) {
    throw createError({ statusCode: 404, statusMessage: 'no such organization' })
  }

  const body = await readBody<{
    name?: unknown
    summary?: unknown
    description?: unknown
    links?: unknown
  }>(event) ?? {}
  const current = orgMeta(org.metadata)

  const links: Record<string, string> = {}
  if (body.links && typeof body.links === 'object' && !Array.isArray(body.links)) {
    for (const [key, value] of Object.entries(body.links as Record<string, unknown>)) {
      if (typeof value === 'string' && value.trim()) {
        links[key.slice(0, 40)] = value.trim().slice(0, 500)
      }
    }
  }

  const name = typeof body.name === 'string' && body.name.trim()
    ? body.name.trim().slice(0, 120)
    : org.name

  const metadata = {
    summary: typeof body.summary === 'string' ? body.summary.trim().slice(0, 400) : current.summary,
    description: typeof body.description === 'string'
      ? body.description.slice(0, 100_000)
      : current.description,
    links: body.links === undefined ? current.links : links,
  }

  await exec('UPDATE organization SET name = $2, metadata = $3 WHERE id = $1',
    [org.id, name, JSON.stringify(metadata)])

  const updated = await orgBySlug(org.slug)
  return { org: publicOrg(updated!, orgMeta(updated!.metadata)) }
})
