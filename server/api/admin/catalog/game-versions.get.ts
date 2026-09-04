export default defineEventHandler(async (event) => {
  await requireCatalogWrite(event)

  const versions = await minecraftVersions()
  return {
    releases: releaseIds(versions),
    all: versions.map(v => ({ id: v.id, type: v.type })),
  }
})
