
export default defineEventHandler(async (event) => {
  await requireCatalogWrite(event)

  return {
    flagged: await flaggedFiles(50),
    unscanned: await unscannedCount(),
    queue: queueDepth(),
  }
})
