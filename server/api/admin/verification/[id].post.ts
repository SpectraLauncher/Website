export default defineEventHandler(async (event) => {
  const moderator = await requireCatalogWrite(event)

  const row = await requestById(String(getRouterParam(event, 'id') ?? ''))
  if (!row) throw createError({ statusCode: 404, statusMessage: 'no such application' })
  if (row.status !== 'pending') {
    throw createError({ statusCode: 409, statusMessage: 'this application was already decided' })
  }

  const body = await readBody<{ approve?: unknown, note?: unknown }>(event) ?? {}
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 2000) : ''

  if (body.approve !== true && body.approve !== false) {
    throw createError({ statusCode: 400, statusMessage: 'approve has to be true or false' })
  }

  // A rejection without a reason is not a decision anyone can act on.
  if (!body.approve && !note) {
    throw createError({ statusCode: 400, statusMessage: 'a rejection needs a reason' })
  }

  await decideRequest(row, body.approve, moderator.id, note)
  return { request: publicRequest((await requestById(row.id))!) }
})
