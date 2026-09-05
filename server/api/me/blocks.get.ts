
export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  return { blocked: await blockedList(me.id) }
})
