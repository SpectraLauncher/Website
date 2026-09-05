export default defineEventHandler(async (event) => {
  const user = await requireCatalogRead(event)
  if (!user) throw createError({ statusCode: 404, statusMessage: 'no such organization' })

  const org = await orgBySlug(String(getRouterParam(event, 'slug') ?? ''))
  if (!org) throw createError({ statusCode: 404, statusMessage: 'no such organization' })

  const actor = await orgStanding(org.id, user)
  if (!actor) throw createError({ statusCode: 404, statusMessage: 'no such organization' })
  if (!has(actor.mask, 'edit_details')) {
    throw createError({ statusCode: 403, statusMessage: 'you cannot edit this organization' })
  }

  const body = await readBody<{
    name?: unknown
    summary?: unknown
    description?: unknown
    links?: unknown
  }>(event) ?? {}
  const current = orgMeta(org.metadata)

  const name = typeof body.name === 'string' && body.name.trim()
    ? body.name.trim().slice(0, 120)
    : org.name

  const metadata = {
    summary: typeof body.summary === 'string' ? body.summary.trim().slice(0, 400) : current.summary,
    description: typeof body.description === 'string'
      ? body.description.slice(0, 100_000)
      : current.description,
    links: body.links === undefined ? current.links : cleanLinks(body.links),
  }

  await exec('UPDATE organization SET name = $2, metadata = $3 WHERE id = $1',
    [org.id, name, JSON.stringify(metadata)])

  const updated = await orgBySlug(org.slug)
  return { org: publicOrg(updated!, orgMeta(updated!.metadata)) }
})
