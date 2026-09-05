
export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)
  const user = await requireUser(event)
  const report = await reportForViewer(event)

  rateLimit(event, { key: `report-thread:${user.id}`, limit: 10, windowMs: 300_000 })

  const staff = isAdmin(user)
  const { body } = await readBody<{ body?: unknown }>(event) ?? {}

  await postMessage({
    reportId: report.id,
    authorId: user.id,
    staff,
    body: cleanBody(body),
  })

  // A question from a moderator has to reach the reporter, and an answer has to
  // reach the moderators. Same thread, opposite directions.
  if (staff) {
    if (report.reporter_id) {
      await notify({ userId: report.reporter_id, kind: 'report_closed', actorId: user.id })
    }
  }
  else {
    await notifyStaff({ kind: 'report_received', actorId: user.id })
  }

  return { ok: true }
})
