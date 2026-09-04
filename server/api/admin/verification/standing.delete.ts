export default defineEventHandler(async (event) => {
  await requireCatalogWrite(event)

  const body = await readBody<{ kind?: unknown, subjectId?: unknown }>(event) ?? {}
  if (!isVerificationKind(body.kind)) {
    throw createError({ statusCode: 400, statusMessage: 'unknown application kind' })
  }

  const subjectId = String(body.subjectId ?? '')
  if (!subjectId) throw createError({ statusCode: 400, statusMessage: 'subjectId is required' })

  await revokeStanding(body.kind, subjectId)
  return { ok: true }
})
