
// Needed once after the scanner ships, and again whenever the marker lists grow.
export default defineEventHandler(async (event) => {
  await requireModeration(event)

  return { queued: await queueUnscanned() }
})
