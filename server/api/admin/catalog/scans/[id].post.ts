
// Re-run a scan by hand. The marker lists grow, so a file that looked clean in
// January is worth another look in June.
export default defineEventHandler(async (event) => {
  await requireCatalogWrite(event)

  const id = String(getRouterParam(event, 'id') ?? '')
  const file = await one<{ id: string }>('SELECT id FROM version_file WHERE id = $1', [id])
  if (!file) throw createError({ statusCode: 404, statusMessage: 'no such file' })

  queueScan(file.id)
  return { queued: true }
})
