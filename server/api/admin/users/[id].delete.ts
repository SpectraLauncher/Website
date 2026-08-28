
export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'missing id' })

  const user = await one<{ id: string }>('SELECT id FROM "user" WHERE id = $1', [id])
  if (!user) throw createError({ statusCode: 404, statusMessage: 'no such user' })

  await deleteAccount(id)
  return { ok: true }
})
