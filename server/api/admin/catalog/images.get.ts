
export default defineEventHandler(async (event) => {
  await requireCatalogWrite(event)
  return { stats: await imageStats() }
})
