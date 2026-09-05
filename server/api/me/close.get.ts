
// What would happen, asked before it happens. A destructive action the person
// cannot preview is one they cannot consent to.
export default defineEventHandler(async (event) => {
  const me = await requireUser(event)

  return {
    blockers: await closureBlockers(me.id),
    footprint: await accountFootprint(me.id),
  }
})
