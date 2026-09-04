export default defineEventHandler(async (event) => {
  const viewer = await requireCatalogRead(event)

  const fileId = String(getRouterParam(event, 'fileId') ?? '')
  if (!/^\d+$/.test(fileId)) throw createError({ statusCode: 404, statusMessage: 'no such file' })

  const found = await downloadTarget(fileId)
  if (!found || !await visibleProject(found.project, viewer)) {
    throw createError({ statusCode: 404, statusMessage: 'no such file' })
  }

  await countDownload(found.version.id, found.project.id)

  const url = publicContentUrl(found.file.object_key)
  if (!url) throw createError({ statusCode: 501, statusMessage: 'content storage is not configured' })

  return sendRedirect(event, url, 302)
})
