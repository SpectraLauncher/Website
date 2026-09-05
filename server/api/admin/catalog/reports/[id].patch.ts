
export default defineEventHandler(async (event) => {
  const moderator = await requireCatalogWrite(event)

  const report = await reportById(String(getRouterParam(event, 'id') ?? ''))
  if (!report) throw createError({ statusCode: 404, statusMessage: 'no such report' })

  const body = await readBody<{ status?: unknown, note?: unknown }>(event) ?? {}
  if (!isReportStatus(body.status) || body.status === 'open') {
    throw createError({ statusCode: 400, statusMessage: 'unknown decision' })
  }

  const note = String(body.note ?? '').trim().slice(0, MAX_REPORT_BODY)

  // The note goes into the thread as well, so the whole exchange reads in one
  // place instead of ending in a field nobody scrolls to.
  if (note) {
    await postMessage({
      reportId: report.id,
      authorId: moderator.id,
      staff: true,
      body: note,
      status: body.status,
    })
  }

  const updated = await closeReport({
    id: report.id,
    status: body.status,
    note,
    moderatorId: moderator.id,
  })

  // The person who reported it hears what happened; without that, reporting
  // feels like shouting into a hole and people stop doing it.
  if (report.reporter_id) {
    await notify({
      userId: report.reporter_id,
      kind: 'report_closed',
      actorId: moderator.id,
    })
  }

  return { report: publicReport(updated, await reportTarget(updated)) }
})
