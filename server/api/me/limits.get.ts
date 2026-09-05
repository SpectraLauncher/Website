
export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  return { limits: await accountUsage(me.id) }
})
