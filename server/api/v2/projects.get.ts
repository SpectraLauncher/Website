const MAX_IDS = 200

export default defineEventHandler(async (event) => {
  const viewer = await requireCatalogRead(event)
  allowAnyOrigin(event)

  const raw = String(getQuery(event).ids ?? '')
  let ids: string[]
  try {
    const parsed = raw.trim().startsWith('[') ? JSON.parse(raw) : raw.split(',')
    ids = (Array.isArray(parsed) ? parsed : [])
      .filter((v): v is string => typeof v === 'string')
      .map(v => v.trim())
      .filter(Boolean)
  } catch {
    throw createError({ statusCode: 400, statusMessage: 'malformed ids' })
  }

  if (ids.length > MAX_IDS) {
    throw createError({ statusCode: 400, statusMessage: `at most ${MAX_IDS} ids per request` })
  }

  const out = []
  for (const id of [...new Set(ids)]) {
    const project = await projectByIdOrSlug(id)
    if (!visibleProject(project, viewer)) continue
    const versions = await versionsOf(project!.id)
    out.push(v2Project(project!, versions.map(v => v.id)))
  }
  return out
})
