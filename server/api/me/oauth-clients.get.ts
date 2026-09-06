
export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  return { clients: (await clientsOf(me.id)).map(publicClient) }
})
