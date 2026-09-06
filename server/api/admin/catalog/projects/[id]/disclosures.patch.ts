
// A moderator writes the lock, which is the one part of a disclosure an author
// cannot touch. Everything else they edit through the ordinary project save.
export default defineEventHandler(async (event) => {
  await requireCatalogWrite(event)

  const project = await projectByIdOrSlug(String(getRouterParam(event, 'id') ?? ''))
  if (!project) throw createError({ statusCode: 404, statusMessage: 'no such project' })

  const body = await readBody<{ disclosures?: unknown }>(event) ?? {}
  const wanted = cleanDisclosures(body.disclosures)

  await exec('UPDATE project SET disclosures = $2, updated = $3 WHERE id = $1',
    [project.id, JSON.stringify(wanted), Date.now()])

  const updated = await projectByIdOrSlug(project.id)
  return { disclosures: updated!.disclosures }
})
