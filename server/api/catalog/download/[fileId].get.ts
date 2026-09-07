export default defineEventHandler(async (event) => {
  const viewer = await requireCatalogRead(event)

  const fileId = String(getRouterParam(event, 'fileId') ?? '')
  if (!isPublicId(fileId)) throw createError({ statusCode: 404, statusMessage: 'no such file' })

  const found = await downloadTarget(fileId)
  if (!found || !await visibleProject(found.project, viewer)) {
    throw createError({ statusCode: 404, statusMessage: 'no such file' })
  }

  // Entitlements are being rebuilt on the new order model. Until they land there
  // is nothing that can prove a purchase, so a priced file is refused to
  // everyone but its owner rather than handed out for free.
  if (Number(found.project.price ?? 0) > 0) {
    const owns = viewer && (isAdmin(viewer) || found.project.owner_id === viewer.id)
    if (!owns) throw createError({ statusCode: 402, statusMessage: 'this download has to be bought' })
  }

  await countDownload(found.version.id, found.project.id)
  await recordDownload(found.project.id).catch(e => console.error('[attribution] download', e))

  const url = publicContentUrl(found.file.object_key)
  if (!url) throw createError({ statusCode: 501, statusMessage: 'content storage is not configured' })

  return sendRedirect(event, url, 302)
})
