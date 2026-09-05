
// Sweeping runs on demand rather than on a timer: it deletes things, and a
// delete loop nobody asked for is how a bad query erases a bucket.
export default defineEventHandler(async (event) => {
  await requireCatalogWrite(event)

  queueSweep()
  return { queued: true }
})
