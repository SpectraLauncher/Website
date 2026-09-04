export default defineEventHandler(async (event) => {
  const viewer = await requireCatalogRead(event)
  allowAnyOrigin(event)

  const algorithm = hashAlgorithm(getQuery(event).algorithm)
  const hash = String(getRouterParam(event, 'hash') ?? '').toLowerCase()
  if (!isHash(hash, algorithm)) {
    throw createError({ statusCode: 400, statusMessage: 'malformed hash' })
  }

  const [match] = await versionsByHash([hash], algorithm)
  if (!match || !visibleProject(match.project, viewer)) {
    throw createError({ statusCode: 404, statusMessage: 'no version matches that hash' })
  }

  const files = await filesOf(match.version.id)
  return v2Version(match.version, files)
})
