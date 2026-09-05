
export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)
  const report = await reportForViewer(event)

  return { report: publicReport(report, await reportTarget(report)), messages: await reportThread(report.id) }
})
