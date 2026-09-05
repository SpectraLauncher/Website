
export default defineEventHandler(async (event) => {
  const me = await requireUser(event)

  await unblockUser(me.id, String(getRouterParam(event, 'id') ?? ''))
  return { blocked: false }
})
