// The whole manifest, not just the release ids: the picker groups snapshots
// under the release they lead to, and it cannot do that without the type and
// the date. Behind the catalog gate because only somebody publishing needs it.
export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)

  const versions = await minecraftVersions().catch(() => [])

  return {
    versions,
    releases: releaseIds(versions),
  }
})
