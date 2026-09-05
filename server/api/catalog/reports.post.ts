
export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)
  const user = await requireUser(event)

  // A report reaches every moderator, so it is budgeted per account before
  // anything else happens.
  rateLimit(event, { key: `report:${user.id}`, limit: 5, windowMs: 300_000 })

  const body = await readBody<{
    reason?: unknown
    itemType?: unknown
    itemId?: unknown
    body?: unknown
  }>(event) ?? {}

  if (!isReportReason(body.reason)) {
    throw createError({ statusCode: 400, statusMessage: 'unknown reason' })
  }
  if (!isReportItemType(body.itemType)) {
    throw createError({ statusCode: 400, statusMessage: 'unknown item type' })
  }

  const itemId = String(body.itemId ?? '')
  // Same answer whether the thing is missing or the id was never real, so the
  // form cannot be used to find out which ids exist.
  if (!itemId || !await reportedItemExists(body.itemType, itemId)) {
    throw createError({ statusCode: 404, statusMessage: 'no such item' })
  }

  const text = String(body.body ?? '').trim().slice(0, MAX_REPORT_BODY)
  if (!text) throw createError({ statusCode: 400, statusMessage: 'say what is wrong' })

  const report = await createReport({
    reason: body.reason,
    itemType: body.itemType,
    itemId,
    reporterId: user.id,
    body: text,
  })

  await notifyStaff({ kind: 'report_received', actorId: user.id })

  return { report: publicReport(report, null) }
})
