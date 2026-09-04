const MAX_HASHES = 1000

export default defineEventHandler(async (event) => {
  const viewer = await requireCatalogRead(event)
  allowAnyOrigin(event)

  const body = await readBody<{ hashes?: unknown, algorithm?: unknown }>(event) ?? {}
  const algorithm = hashAlgorithm(body.algorithm)

  const hashes = (Array.isArray(body.hashes) ? body.hashes : [])
    .filter((h): h is string => typeof h === 'string')
    .map(h => h.toLowerCase())
    .filter(h => isHash(h, algorithm))

  if (hashes.length > MAX_HASHES) {
    throw createError({ statusCode: 400, statusMessage: `at most ${MAX_HASHES} hashes per request` })
  }

  const matches = await versionsByHash([...new Set(hashes)], algorithm)
  const visible = matches.filter(m => visibleProject(m.project, viewer))
  const files = await filesForVersions(visible.map(m => m.version.id))
  const byVersion = groupFiles(files)

  // Keyed by the hash that was asked about, which is how the caller looks the
  // answer back up. A hash we do not know is simply absent.
  const out: Record<string, unknown> = {}
  for (const match of visible) {
    out[match.hash] = v2Version(match.version, byVersion.get(match.version.id) ?? [])
  }
  return out
})
