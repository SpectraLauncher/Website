
export default defineEventHandler(async (event) => {
  const me = await requireUser(event)
  const [friends, pending, mine] = await Promise.all([
    friendsOf(me.id),
    pendingFor(me.id),
    one<{ presence: string | null }>('SELECT presence FROM "user" WHERE id = $1', [me.id]),
  ])
  return { friends, ...pending, presence: mine?.presence ?? 'visible' }
})
