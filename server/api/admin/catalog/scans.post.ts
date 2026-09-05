
// Queues every file nobody has looked at yet. Needed once after the scanner
// ships, and again whenever the marker lists grow.
export default defineEventHandler(async (event) => {
  await requireCatalogWrite(event)

  return { queued: await queueUnscanned() }
})
