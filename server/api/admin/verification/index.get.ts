export default defineEventHandler(async (event) => {
  await requireModeration(event)

  const pending = await pendingQueue()
  return { requests: await Promise.all(pending.map(describeRequest)) }
})
