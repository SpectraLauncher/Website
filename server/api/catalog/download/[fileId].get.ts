export default defineEventHandler(async (event) => {
  const viewer = await requireCatalogRead(event)

  const fileId = String(getRouterParam(event, 'fileId') ?? '')
  if (!isPublicId(fileId)) throw createError({ statusCode: 404, statusMessage: 'no such file' })

  const found = await downloadTarget(fileId)
  if (!found || !await visibleProject(found.project, viewer)) {
    throw createError({ statusCode: 404, statusMessage: 'no such file' })
  }

  // A price turns the download into an entitlement check. The owner and an admin
  // never have to buy their own project.
  //
  // A guest has no account to hold an entitlement, so the token from their
  // receipt stands in for one. It only opens the projects that were actually in
  // that sale.
  if (Number(found.project.price ?? 0) > 0) {
    const token = String(getQuery(event).token ?? '')

    const owns = (viewer && (isAdmin(viewer)
      || found.project.owner_id === viewer.id
      || await ownsProject(viewer.id, found.project.id)))
      || (token ? await tokenOpensProject(token, found.project.id) : false)

    if (!owns) throw createError({ statusCode: 402, statusMessage: 'this download has to be bought' })
  }

  await countDownload(found.version.id, found.project.id)
  await recordDownload(found.project.id).catch(e => console.error('[attribution] download', e))

  const url = publicContentUrl(found.file.object_key)
  if (!url) throw createError({ statusCode: 501, statusMessage: 'content storage is not configured' })

  return sendRedirect(event, url, 302)
})
