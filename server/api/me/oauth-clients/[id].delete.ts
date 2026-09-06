
export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  const client = await requireOwnClient(event)

  await deleteClient(client.id, me.id)
  return { deleted: true }
})
