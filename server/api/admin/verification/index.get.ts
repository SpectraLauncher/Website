export default defineEventHandler(async (event) => {
  await requireCatalogWrite(event)

  const pending = await pendingQueue()
  return { requests: await Promise.all(pending.map(describeRequest)) }
})
