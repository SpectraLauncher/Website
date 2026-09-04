export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)
  return { ok: true }
})
