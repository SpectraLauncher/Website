
export default defineEventHandler(async (event) => {
  const me = await requireUser(event)

  return {
    blockers: await closureBlockers(me.id),
    footprint: await accountFootprint(me.id),
  }
})
