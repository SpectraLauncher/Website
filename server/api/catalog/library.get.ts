export default defineEventHandler(async (event) => {
  await requireCatalogRead(event)
  const user = await requireUser(event)

  const rows = await libraryOf(user.id)

  return {
    items: rows.map(row => ({
      projectId: row.project_id,
      title: row.title,
      slug: row.slug,
      icon: row.icon,
      // A project that has since been removed keeps its row and its title, but
      // there is nowhere left to send anyone.
      path: row.slug && row.type ? projectPath(row.type as never, row.slug) : null,
      priceMinor: Number(row.price_minor ?? 0),
      granted: Number(row.granted),
    })),
  }
})
