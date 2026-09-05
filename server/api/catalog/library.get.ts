export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)
  const user = await requireUser(event)

  const purchases = await purchasesOf(user.id)
  const projects = await projectsByIds(purchases.map(p => p.project_id))

  return {
    items: purchases.map((purchase) => {
      const project = projects.get(purchase.project_id)
      return {
        id: purchase.id,
        amount: purchase.amount,
        currency: purchase.currency,
        completed: purchase.completed ? Number(purchase.completed) : null,
        project: project ? shortProject(project) : null,
      }
    }),
  }
})
