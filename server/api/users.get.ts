
export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  const query = String(getQuery(event).q ?? '')
  return { users: await searchUsers(query, me.id) }
})
