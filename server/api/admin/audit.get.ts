export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const query = getQuery(event)

  const rows = await staffActions({
    actorId: query.actor ? String(query.actor) : undefined,
    action: query.action ? String(query.action) : undefined,
    subjectKind: query.subjectKind ? String(query.subjectKind) : undefined,
    subjectId: query.subjectId ? String(query.subjectId) : undefined,
    limit: Number(query.limit) || 50,
    offset: Number(query.offset) || 0,
  })

  return { entries: rows.map(auditEntry), total: await countStaffActions() }
})
