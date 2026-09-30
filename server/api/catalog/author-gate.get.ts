export default defineEventHandler(async (event) => {
  await requireCatalogAuthor(event)
  return { ok: true }
})
