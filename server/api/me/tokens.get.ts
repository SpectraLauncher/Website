
export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  return { tokens: (await tokensOf(me.id)).map(publicToken) }
})
