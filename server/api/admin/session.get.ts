export default defineEventHandler(async (event) => {
  const user = await requireAdmin(event)

  return { ok: true, username: user.username ?? null }
})
