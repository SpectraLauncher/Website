
export default defineEventHandler(async (event) => {
  const me = await requireUser(event)

  await revokeGrant(String(getRouterParam(event, 'id') ?? ''), me.id)
  return { revoked: true }
})
