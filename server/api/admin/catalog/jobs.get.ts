
export default defineEventHandler(async (event) => {
  await requireCatalogWrite(event)
  return { queue: await queueDepth() }
})
