export default defineEventHandler(async (event) => {
  await requireAdmin(event)

  return { ok: true, awarded: await syncBadges() }
})
