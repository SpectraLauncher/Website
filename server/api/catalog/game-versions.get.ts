// The list the version form offers. Behind the catalog gate rather than open,
// because it is only useful to somebody who can publish, and the upstream call
// it wraps is cached anyway.
export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)

  const versions = await minecraftVersions().catch(() => [])

  return { releases: releaseIds(versions) }
})
